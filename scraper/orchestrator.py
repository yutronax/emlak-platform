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
from typing import Set

from api_key_manager import get_default_manager
from fingerprint import compute_fingerprint
from parser import parse_listing_message
from quality_gate import is_safe_to_auto_approve, score_listing
from supabase_client import fingerprint_exists, get_client, insert_raw_listing

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper.orchestrator")

MAX_WORKERS = 10

message_queue: "Queue[dict]" = Queue()
# Aynı mesaj ID'sinin kuyrukta iki kez işlenmesini önleyen bellek-içi set
# (DB'deki unique index son savunma hattı, bu set ise anlık race-condition koruması).
_active_ids_lock = threading.Lock()
_active_ids: Set[str] = set()


def handle_message(payload: dict) -> None:
    message_id = str(payload.get("id") or "")
    text = (payload.get("text") or "").strip()
    group = payload.get("group")

    if not text:
        return

    try:
        client = get_client()
        key_manager = get_default_manager()

        parsed = asyncio.run(parse_listing_message(text, key_manager))
        if parsed is None:
            logger.info("Mesaj ilan değil veya parse edilemedi, atlandı: %s", message_id)
            return

        fingerprint = compute_fingerprint(parsed)
        if fingerprint_exists(client, fingerprint):
            logger.info("Mükerrer ilan (fingerprint eşleşti), atlandı: %s", message_id)
            return

        score, issues = score_listing(parsed)
        record = {
            "source": "whatsapp",
            "source_group": group,
            "source_message_id": message_id or None,
            "raw_text": text,
            "parsed": parsed,
            "fingerprint": fingerprint,
            "quality_score": score,
            "status": "pending",
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
