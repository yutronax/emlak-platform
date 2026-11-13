# -*- coding: utf-8 -*-
"""Scraper worker giriş noktası.

Baileys sidecar'ın POST ettiği /baileys-webhook mesajlarını kalıcı kuyruğa (durable_queue)
yazar, sabit boyutlu bir thread pool ile paralel işler: parse (Gemini) -> quality
gate -> fingerprint dedup -> raw_listings'e yaz. Geçici Gemini ve altyapı arızalarında kayıt
silinmez, backoff ile yeniden denenir (ATDD kalici-parse-kuyrugu).

Mimari, maviLojistik/src/parsers/veri_cekici_ayristirici.py'deki
kuyruk + ThreadPoolExecutor + üç katmanlı dedup desenine karşılık gelir.
"""

import asyncio
import hmac
import json
import logging
import os
import sys
import threading
import time
import weakref
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional

from api_key_manager import get_default_manager
from durable_queue import DurableQueue, default_path
from fingerprint import compute_fingerprint
from parser import GeminiUnavailable, parse_listing_message
from quality_gate import is_safe_to_auto_approve, score_listing
from supabase_client import (
    bump_sidecar_counter,
    fingerprint_exists,
    get_client,
    ingest_personal_listing,
    insert_raw_listing,
    is_group_selected,
    purge_expired_parse_cache,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper.orchestrator")

MAX_WORKERS = 10
MAX_DRAIN_BYTES = 1024 * 1024
# Kişisel yol (agentId'li payload) yalnız yerel sidecar'dan kabul edilir (red-team tur 3).
LOOPBACK_ADDRESSES = frozenset({"127.0.0.1", "::1"})
IDLE_POLL_SECONDS = 1.0

# Kalıcı kuyruk. run() başlamadan önce kurulur; testler bu modül değişkenini değiştirir.
inbox: Optional[DurableQueue] = None

# Altyapı hatası: kayıt silinmez, process_entry geri alır (AC-10). Mesaj içeriği taşımaz.
class RetryableError(Exception):
    """Veritabanı/altyapı hatası; nihai sonuç değil, kayıt yeniden denenecek."""


# Kuyruk başına eşzamanlı iş sayacı (AC-11). Anahtar kuyruk nesnesi; bu sayede farklı kuyruklar
# (ör. test kurulumları) birbirinin kapasitesini etkilemez.
_capacity_lock = threading.Lock()
_in_flight: "weakref.WeakKeyDictionary[DurableQueue, int]" = weakref.WeakKeyDictionary()


def _adjust_in_flight(queue: DurableQueue, delta: int) -> None:
    with _capacity_lock:
        _in_flight[queue] = max(0, _in_flight.get(queue, 0) + delta)


def _log_error(stage: str, exc: BaseException) -> None:
    """Hata dalını içeriksiz loglar: sabit aşama ve hata sınıfı. Mesaj metni ve traceback yok (AC-S5)."""
    logger.warning("handle_error stage=%s kind=%s", stage, type(exc).__name__)


def _queue_op(operation: str, action) -> None:
    """Kuyruk durum güncellemesi; hata içeriksiz loglanır, dışarı sızmaz."""
    try:
        action()
    except Exception as exc:  # noqa: BLE001 - kayıt kuyrukta kalır, recover ile döner
        logger.warning("queue_error operation=%s kind=%s", operation, type(exc).__name__)


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
    aksi halde pending (admin kuyruğu). Yazma hatasında sayaç artar ve RetryableError yükselir
    (kısmi yazım yok, fallback yok, kayıt silinmez).
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
    except Exception as exc:  # noqa: BLE001 - altyapı hatası: sayaç, sonra kayıt geri alınır
        _log_error("personal_write", exc)
        _count_personal(client, "personal_write_error", agent_id)
        raise RetryableError from None

    return _log_personal_outcome(_personal_outcome_key(outcome, score), agent_id)


def handle_message(payload: dict) -> Optional[str]:
    """Bir mesajı işler. Nihai sonuçlarda normal döner; altyapı/beklenmeyen hatada RetryableError,
    Gemini geçici arızasında GeminiUnavailable yükseltir (kayıt silinmez)."""
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
            except Exception as exc:  # noqa: BLE001 - Gemini'ye gidilmez; kayıt geri alınır
                _log_error("personal_selection", exc)
                _count_personal(client, "personal_selection_check_error", agent_id)
                raise RetryableError from None
            if not selected:
                return _count_personal(client, "personal_unselected", agent_id)
            try:
                parsed = asyncio.run(parse_listing_message(text, key_manager, raise_unavailable=True))
            except GeminiUnavailable:
                raise  # kuyruk yeniden dener; parse hatası olarak sayılmaz
            except Exception as exc:  # noqa: BLE001 - beklenmeyen/geçici: sayaç, kayıt geri alınır (AC-14)
                _log_error("personal_parse", exc)
                _count_personal(client, "personal_parse_error", agent_id)
                raise RetryableError from None
            if parsed is None:
                return _count_personal(client, "personal_not_listing", agent_id)
            return _handle_personal(client, agent_id, payload, message_id, text, parsed)

        parsed = asyncio.run(parse_listing_message(text, key_manager, raise_unavailable=True))

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
    except (GeminiUnavailable, RetryableError):
        raise
    except Exception as exc:  # noqa: BLE001 - beklenmeyen hata kaydı silmez, process_entry geri alır
        _log_error("handle", exc)
        raise RetryableError from None
    return None


def process_entry(row_id: int, payload: dict) -> None:
    """Kuyruktan alınmış bir kaydı işler. Nihai sonuçta siler; her hatada geri alır.

    Kapasite her durumda (finally) geri verilir. Hiçbir istisna dışarı sızmaz.
    """
    queue = inbox
    try:
        try:
            handle_message(payload)
        except Exception:  # noqa: BLE001 - GeminiUnavailable/RetryableError/beklenmeyen: kayıt silinmez
            _queue_op("retry", lambda: queue.retry_later(row_id, time.time()))
            return
        _queue_op("complete", lambda: queue.complete(row_id))
    finally:
        _adjust_in_flight(queue, -1)


def dispatch_due(executor: ThreadPoolExecutor, now: float) -> int:
    """Boş kapasite kadar zamanı gelmiş kayıt claim eder ve executor'a verir. Dönüş: verilen sayı.

    Kapasite yoksa claim etmez. Submit hatasında gönderilemeyen kayıtlar pending'e döner; istisna dışarı sızmaz.
    """
    queue = inbox
    with _capacity_lock:
        free = MAX_WORKERS - _in_flight.get(queue, 0)
        if free <= 0:
            return 0
        rows = queue.claim_due(free, now)
        _in_flight[queue] = _in_flight.get(queue, 0) + len(rows)

    dispatched = 0
    for index, (row_id, payload) in enumerate(rows):
        try:
            executor.submit(process_entry, row_id, payload)
        except Exception as exc:  # noqa: BLE001 - içeriksiz log; kalan kayıtlar pending'e döner
            logger.warning("queue_error operation=submit kind=%s", type(exc).__name__)
            for rest_id, _ in rows[index:]:
                _queue_op("release", lambda rid=rest_id: queue.release(rid))
                _adjust_in_flight(queue, -1)
            return dispatched
        dispatched += 1
    return dispatched


def _background_worker_loop(executor: ThreadPoolExecutor) -> None:
    while True:
        try:
            dispatched = dispatch_due(executor, time.time())
        except Exception as exc:  # noqa: BLE001 - kuyruk arızası worker döngüsünü düşürmez
            logger.warning("queue_error operation=dispatch kind=%s", type(exc).__name__)
            dispatched = 0
        if dispatched == 0:
            time.sleep(IDLE_POLL_SECONDS)


PARSE_CACHE_PURGE_INTERVAL_SECONDS = 60 * 60


def _parse_cache_purge_loop() -> None:
    """Süresi dolmuş parse_cache satırlarını, 7 günü geçen failed kuyruk kayıtlarını ve WAL'ı
    başlangıçta ve saatlik temizler. Hatada devam eder."""
    while True:
        try:
            removed = purge_expired_parse_cache(get_client())
            logger.info("parse_cache_purged count=%d", removed)
        except Exception as error:  # noqa: BLE001 - temizlik arızası worker'ı düşürmez
            logger.warning("cache_error operation=cleanup error=%s", type(error).__name__)
        try:
            failed_removed = inbox.purge_failed(time.time())
            logger.info("queue_failed_purged count=%d", failed_removed)
            inbox.checkpoint()
        except Exception:  # noqa: BLE001 - temizlik arızası worker'ı düşürmez
            logger.warning("queue_error operation=purge")
        time.sleep(PARSE_CACHE_PURGE_INTERVAL_SECONDS)


class WebhookHandler(BaseHTTPRequestHandler):
    # Soket zaman aşımı: yarım gövdede bağlantının asılı kalmasını önler.
    timeout = 10

    def _discard_body(self) -> None:
        """Erken dönüşlerde (404/401) gövdeyi okuyup atar; okunmamış veri TCP RST riskini önler.

        Gövde içeriği ve uzunluğu loglanmaz.
        """
        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        if length < 0:
            length = 0
        if length == 0:
            return
        if length > MAX_DRAIN_BYTES:
            self.close_connection = True
            return
        try:
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(remaining)
                if not chunk:
                    self.close_connection = True
                    break
                remaining -= len(chunk)
        except (OSError, TimeoutError):
            self.close_connection = True

    def do_POST(self) -> None:  # noqa: N802 - http.server API ismi
        if self.path != "/baileys-webhook":
            self._discard_body()
            self.send_response(404)
            self.end_headers()
            return

        secret = os.getenv("BAILEYS_WEBHOOK_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else ""
        if not secret or not hmac.compare_digest(token, secret):
            self._discard_body()
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

        try:
            is_new = inbox.enqueue(payload, time.time())
        except Exception:  # noqa: BLE001 - yazma hatası içeriksiz; gönderen tekrar dener
            response = json.dumps({"error": "queue_unavailable"}).encode("utf-8")
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return
        if is_new:
            logger.info("queue_enqueued")

        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - http.server imzası
        logger.debug("%s - %s", self.address_string(), format % args)


def run() -> None:
    global inbox
    if not os.getenv("BAILEYS_WEBHOOK_SECRET", ""):
        logger.error("BAILEYS_WEBHOOK_SECRET env değişkeni set edilmemiş, sunucu başlatılmıyor.")
        sys.exit(1)

    host = os.getenv("BAILEYS_WEBHOOK_HOST", "127.0.0.1")
    port = int(os.getenv("BAILEYS_WEBHOOK_PORT", "8090"))

    if inbox is None:
        inbox = DurableQueue(default_path())
    # Bind önce (AC-13): port alınamazsa kurtarma yapılmadan hata yükselir; ikinci süreç
    # çalışan sürecin processing kayıtlarını geri almaz.
    server = HTTPServer((host, port), WebhookHandler)
    recovered = inbox.recover_processing()
    logger.info("queue_recovered count=%d", recovered)

    executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    worker_thread = threading.Thread(target=_background_worker_loop, args=(executor,), daemon=True)
    worker_thread.start()

    purge_thread = threading.Thread(target=_parse_cache_purge_loop, daemon=True)
    purge_thread.start()

    logger.info("Scraper worker %s:%s/baileys-webhook adresinde dinliyor.", host, port)
    server.serve_forever()


if __name__ == "__main__":
    run()
