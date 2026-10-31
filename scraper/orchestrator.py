# -*- coding: utf-8 -*-
"""Scraper worker giriş noktası.

Baileys sidecar'ın POST ettiği /baileys-webhook mesajlarını kuyruğa alır,
sabit boyutlu bir thread pool ile paralel işler: parse (Gemini) -> quality
gate -> fingerprint dedup -> raw_listings'e yaz.

Mimari, maviLojistik/src/parsers/veri_cekici_ayristirici.py'deki
queue.Queue + ThreadPoolExecutor + üç katmanlı dedup desenine karşılık gelir.
"""

import asyncio
import hmac
import json
import logging
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, HTTPServer
from queue import Queue
from typing import Optional, Set

from api_key_manager import get_default_manager
from fingerprint import compute_fingerprint
from parser import parse_listing_message
from quality_gate import is_safe_to_auto_approve, score_listing
from supabase_client import (
    bump_sidecar_counter,
    fingerprint_exists,
    get_client,
    ingest_personal_listing,
    insert_raw_listing,
    is_group_selected,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper.orchestrator")

MAX_WORKERS = 10
# Kişisel yol (agentId'li payload) yalnız yerel sidecar'dan kabul edilir (red-team tur 3).
LOOPBACK_ADDRESSES = frozenset({"127.0.0.1", "::1"})

message_queue: "Queue[dict]" = Queue()
# Aynı mesaj ID'sinin kuyrukta iki kez işlenmesini önleyen bellek-içi set
# (DB'deki unique index son savunma hattı, bu set ise anlık race-condition koruması).
_active_ids_lock = threading.Lock()
_active_ids: Set[str] = set()


def _personal_outcome_key(status: str, score: Optional[float]) -> str:
    """Kişisel yazım sonucunu sayaç anahtarına çevirir (Davranış Sözleşmesi satır 1-3, 7, seçim).

    Bu anahtarları DB (ingest_personal_listing) zaten sayar; burada yalnız içeriksiz log için kullanılır.
    """
    if status == "approved":
        return "personal_auto_approved"
    if status == "duplicate":
        return "personal_duplicate"
    if status == "unselected":
        return "personal_unselected"
    if status == "not_connected":
        return "personal_not_connected"
    if score is None:
        return "personal_queued_noscore"
    return "personal_queued"


def _log_personal_outcome(key: str, agent_id: str) -> str:
    """Sayaç anahtarını içeriksiz tek satır olarak loglar (mesaj metni/numara/jid yok)."""
    logger.info("personal_outcome=%s agent=%s", key, agent_id)
    return key


def _count_personal(client, key: str, agent_id: str) -> str:
    """Orchestrator'ın kendi sonucunu DB sayacına yazar (best-effort) ve içeriksiz loglar."""
    bump_sidecar_counter(client, key)
    return _log_personal_outcome(key, agent_id)


def _handle_personal(
    client,
    agent_id: str,
    payload: dict,
    message_id: str,
    text: str,
    parsed: dict,
) -> str:
    """Kişisel ilan yolu: owner yalnız agent_id'den gelir (AC-S3). Ortak insert/dedup'a girmez.

    Gönderen numarası record'a yazılmaz (AC-S4). Eşik: quality_score >= eşik ise approved,
    aksi halde pending (admin kuyruğu). Yazma hatası yutulur; fallback yapılmaz (kısmi yazım yok).
    """
    score, _issues = score_listing(parsed)
    # Eşik kararı tek yerde, DB'de verilir (ingest_personal_listing içinde, app_settings'ten).
    # Python eşiği okumaz; record "status" alanı yalnız şekil uyumluluğu için sabit "pending"dir,
    # DB bu alanı okumaz.
    record = {
        "source": "whatsapp",
        "source_group": payload.get("group"),
        "source_group_name": payload.get("groupName"),
        "source_message_id": message_id or None,
        "raw_text": text,
        "parsed": parsed,
        "fingerprint": compute_fingerprint(parsed),
        "quality_score": score,
        "status": "pending",
    }
    try:
        outcome = ingest_personal_listing(client, agent_id, record)
    except Exception:  # noqa: BLE001 - içeriksiz logla, worker'ı düşürme
        logger.exception("Kişisel ilan yazılamadı (içerik loglanmaz)")
        return _count_personal(client, "personal_write_error", agent_id)

    return _log_personal_outcome(_personal_outcome_key(outcome, score), agent_id)


def handle_message(payload: dict) -> Optional[str]:
    message_id = str(payload.get("id") or "")
    text = (payload.get("text") or "").strip()
    group = payload.get("group")
    agent_id = payload.get("agentId")

    if not text:
        return None

    try:
        client = get_client()
        key_manager = get_default_manager()

        if agent_id:
            # KVKK: seçim önbelleği (sidecar, 60 sn) eski olabilir; metin parse'a (Gemini) gitmeden
            # önce grubun bu emlakçı için HÂLÂ seçili olduğu DB'den doğrulanır.
            try:
                selected = is_group_selected(client, agent_id, group)
            except Exception:  # noqa: BLE001 - pesimist: doğrulanamazsa parse etme, içerik loglanmaz
                logger.warning("Seçim doğrulanamadı, mesaj parse edilmedi (içerik loglanmaz)")
                return _count_personal(client, "personal_selection_check_error", agent_id)
            if not selected:
                return _count_personal(client, "personal_unselected", agent_id)
            try:
                parsed = asyncio.run(parse_listing_message(text, key_manager))
            except Exception:  # noqa: BLE001 - içerik loglanmaz, yalnız sayaç
                return _count_personal(client, "personal_parse_error", agent_id)
            if parsed is None:
                return _count_personal(client, "personal_not_listing", agent_id)
            return _handle_personal(client, agent_id, payload, message_id, text, parsed)

        parsed = asyncio.run(parse_listing_message(text, key_manager))

        if parsed is None:
            logger.info("Mesaj ilan değil veya parse edilemedi, atlandı: %s", message_id)
            return None

        fingerprint = compute_fingerprint(parsed)
        if fingerprint_exists(client, fingerprint):
            logger.info("Mükerrer ilan (fingerprint eşleşti), atlandı: %s", message_id)
            return None

        score, issues = score_listing(parsed)
        record = {
            "source": "whatsapp",
            "source_group": group,
            "source_group_name": payload.get("groupName"),
            "source_message_id": message_id or None,
            "raw_text": text,
            "parsed": parsed,
            "fingerprint": fingerprint,
            "quality_score": score,
            "status": "pending",
            "owner_agent_id": None,
        }
        _inserted_row, inserted = insert_raw_listing(client, record)
        if inserted:
            logger.info(
                "raw_listings'e yazıldı: %s (skor=%.2f, auto_approve_uygun=%s, sorunlar=%s)",
                message_id,
                score,
                is_safe_to_auto_approve(score, float(os.getenv("QUALITY_GATE_THRESHOLD", "0.5"))),
                issues,
            )
        else:
            logger.info(
                "Mükerrer ilan (fingerprint çakışması, DB seviyesinde atlandı): %s",
                message_id,
            )
    except Exception:  # noqa: BLE001 - worker thread hatayı yutmasın, logla ve devam et
        logger.exception("Mesaj işlenirken hata: %s", message_id)
    finally:
        with _active_ids_lock:
            _active_ids.discard(message_id)
    return None


def _background_worker_loop(executor: ThreadPoolExecutor) -> None:
    while True:
        payload = message_queue.get()
        executor.submit(handle_message, payload)


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802 - http.server API ismi
        if self.path != "/baileys-webhook":
            self.send_response(404)
            self.end_headers()
            return

        secret = os.getenv("BAILEYS_WEBHOOK_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else ""
        if not secret or not hmac.compare_digest(token, secret):
            body = json.dumps({"error": "unauthorized"}).encode("utf-8")
            self.send_response(401)
            self.send_header("WWW-Authenticate", "Bearer")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            # Body içeriği loglanmaz (PII riski).
            logger.warning("Geçersiz webhook body (JSON/UTF-8 çözülemedi), 400 dönüldü.")
            response = json.dumps({"error": "invalid_body"}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return

        if payload.get("agentId") and self.client_address[0] not in LOOPBACK_ADDRESSES:
            # Kişisel yol loopback dışından gelemez; hiçbir işlem yapılmaz. İçerik ve IP loglanmaz.
            logger.warning("Loopback dışı kişisel webhook isteği reddedildi (403).")
            response = json.dumps({"error": "forbidden"}).encode("utf-8")
            self.send_response(403)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return

        if not payload.get("text"):
            # Metinsiz mesaj kuyruğa alınmaz; 200 ile "işlendi" denir (WhatsApp tekrar göndermesin).
            response = b"{}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return

        message_id = str(payload.get("id") or "")
        with _active_ids_lock:
            if message_id and message_id in _active_ids:
                self.send_response(200)
                self.end_headers()
                return
            if message_id:
                _active_ids.add(message_id)

        message_queue.put(payload)

        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - http.server imzası
        logger.debug("%s - %s", self.address_string(), format % args)


def run() -> None:
    if not os.getenv("BAILEYS_WEBHOOK_SECRET", ""):
        logger.error("BAILEYS_WEBHOOK_SECRET env değişkeni set edilmemiş, sunucu başlatılmıyor.")
        sys.exit(1)

    host = os.getenv("BAILEYS_WEBHOOK_HOST", "127.0.0.1")
    port = int(os.getenv("BAILEYS_WEBHOOK_PORT", "8090"))
    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    worker_thread = threading.Thread(target=_background_worker_loop, args=(executor,), daemon=True)
    worker_thread.start()

    server = HTTPServer((host, port), WebhookHandler)
    logger.info("Scraper worker %s:%s/baileys-webhook adresinde dinliyor.", host, port)
    server.serve_forever()


if __name__ == "__main__":
    run()
