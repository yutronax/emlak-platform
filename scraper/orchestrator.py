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
import math
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from queue import Queue
from typing import Any, Optional, Set, Tuple

from api_key_manager import get_default_manager
from fingerprint import compute_fingerprint
from parser import ERROR, LISTING, RETRYABLE_REASONS, ParseOutcome, parse_listing_outcome
from quality_gate import is_safe_to_auto_approve, score_listing
from supabase_client import (
    bump_sidecar_counter,
    delete_pending,
    fetch_due_pending,
    fingerprint_exists,
    get_client,
    ingest_personal_listing,
    insert_raw_listing,
    is_group_selected,
    park_raw_message,
    purge_expired_parse_cache,
    purge_expired_pending,
    reschedule_pending,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper.orchestrator")

MAX_WORKERS = 10
MAX_DRAIN_BYTES = 1024 * 1024
# Kişisel yol (agentId'li payload) yalnız yerel sidecar'dan kabul edilir (red-team tur 3).
LOOPBACK_ADDRESSES = frozenset({"127.0.0.1", "::1"})

message_queue: "Queue[dict]" = Queue()
# Aynı mesajın (emlakçı + mesaj ID'si) kuyrukta iki kez işlenmesini önleyen bellek-içi set
# (DB'deki unique index son savunma hattı, bu set ise anlık race-condition koruması).
# Anahtar _active_key ile üretilir: ortak hesap ve kişisel oturumlar aynı mesaj ID'sini alabilir.
_active_ids_lock = threading.Lock()
_active_ids: Set[Tuple[str, str]] = set()

# Parse yeniden denemesi (yalnız geçici hatalar; parser.RETRYABLE_REASONS).
# Worker thread'i bloklar: üst sınırlar kasıtlı olarak dar tutulur.
PARSE_MAX_ATTEMPTS_ENV = "PARSE_MAX_ATTEMPTS"
PARSE_RETRY_BASE_ENV = "PARSE_RETRY_BASE_SECONDS"
DEFAULT_PARSE_MAX_ATTEMPTS = 3
PARSE_MAX_ATTEMPTS_LIMIT = 6
DEFAULT_PARSE_RETRY_BASE_SECONDS = 2.0
PARSE_RETRY_MAX_DELAY_SECONDS = 30.0
PARSE_RETRY_JITTER_RATIO = 0.1

# Bekletilen (parse hatası) ham mesajların arka plan drain döngüsü (pending_raw_messages).
PENDING_DRAIN_INTERVAL_ENV = "PENDING_DRAIN_INTERVAL_SECONDS"
PENDING_MAX_ATTEMPTS_ENV = "PENDING_MAX_ATTEMPTS"
DEFAULT_PENDING_DRAIN_INTERVAL_SECONDS = 300
PENDING_DRAIN_INTERVAL_MIN_SECONDS = 30
PENDING_DRAIN_INTERVAL_MAX_SECONDS = 3600
DEFAULT_PENDING_MAX_ATTEMPTS = 8
PENDING_MAX_ATTEMPTS_LIMIT = 20
PENDING_DRAIN_BATCH = 20
PENDING_BACKOFF_BASE = timedelta(minutes=5)
PENDING_BACKOFF_MAX = timedelta(hours=6)

# Replay sonucu (drain için). DONE: işlendi/düşürüldü -> satır silinir. RETRY: parse error, geçici
# DB hatası ya da beklenmeyen istisna -> ertelenir. BUSY: aynı mesaj canlı yolda işleniyor -> bu tur atlanır.
DISPOSITION_DONE = "done"
DISPOSITION_RETRY = "retry"
DISPOSITION_BUSY = "busy"
# Replay'de parse error'ın _process_message dönüş işareti (sayaç anahtarlarıyla çakışmaz; DB'ye yazılmaz).
REPLAY_PARSE_FAILED = "replay_parse_failed"
# Kişisel yolda yutulan geçici DB hataları (sayaç anahtarı olarak döner).
PERSONAL_WRITE_ERROR = "personal_write_error"
PERSONAL_SELECTION_CHECK_ERROR = "personal_selection_check_error"
# Replay'de bu sonuçlar satırı silmez, ertelenir (geçici arıza mesajı kalıcı olarak düşürmemeli).
REPLAY_RETRY_RESULTS = frozenset({REPLAY_PARSE_FAILED, PERSONAL_WRITE_ERROR, PERSONAL_SELECTION_CHECK_ERROR})
# Canlı yolda parse SONRASI beklenmeyen istisna: mesaj bu içeriksiz nedenle bekletilir
# (pending_raw_messages.reason CHECK: ^[a-z_]{1,40}$).
PROCESS_ERROR_REASON = "process_error"

# Testlerde patch'lenen bekleme, jitter ve saat noktaları (gerçek uyku olmasın diye).
_sleep = time.sleep


def _active_key(payload: Any) -> Optional[Tuple[str, str]]:
    """İşlem-içi dedup anahtarı: (agentId ya da "", mesaj ID'si). ID yoksa / payload dict değilse None."""
    if not isinstance(payload, dict):
        return None
    message_id = str(payload.get("id") or "")
    if not message_id:
        return None
    return str(payload.get("agentId") or ""), message_id


def _has_text(payload: Any) -> bool:
    """payload dict ve text boşluk dışı içerikli bir string mi?"""
    if not isinstance(payload, dict):
        return False
    text = payload.get("text")
    return isinstance(text, str) and bool(text.strip())


def _jitter(upper: float) -> float:
    return random.uniform(0, upper)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_max_attempts() -> int:
    """PARSE_MAX_ATTEMPTS: varsayılan 3, 1..6 aralığına sıkıştırılır; geçersiz değer varsayılana döner."""
    try:
        value = int(os.getenv(PARSE_MAX_ATTEMPTS_ENV, ""))
    except ValueError:
        return DEFAULT_PARSE_MAX_ATTEMPTS
    return max(1, min(PARSE_MAX_ATTEMPTS_LIMIT, value))


def _parse_retry_base_seconds() -> float:
    """PARSE_RETRY_BASE_SECONDS: varsayılan 2.0; geçersiz, negatif veya sonlu olmayan değer varsayılana döner."""
    try:
        value = float(os.getenv(PARSE_RETRY_BASE_ENV, ""))
    except ValueError:
        return DEFAULT_PARSE_RETRY_BASE_SECONDS
    if not math.isfinite(value) or value < 0:
        return DEFAULT_PARSE_RETRY_BASE_SECONDS
    return value


def _retry_delay(attempt: int, base: float) -> float:
    """base * 2**(attempt-1) + en fazla %10 jitter; üst sınır PARSE_RETRY_MAX_DELAY_SECONDS."""
    delay = base * 2 ** (attempt - 1)
    return min(PARSE_RETRY_MAX_DELAY_SECONDS, delay + _jitter(delay * PARSE_RETRY_JITTER_RATIO))


def _parse_with_retry(text: str, key_manager, *, max_attempts: Optional[int] = None) -> ParseOutcome:
    """Parse'ı çalıştırır; geçici hatada üstel geri çekilmeyle yeniden dener (worker thread'inde, senkron).

    listing / not_listing ve geçici olmayan hatalar (no_key, schema_invalid) hemen döner.
    Parser'dan sızan beklenmeyen istisna denenmez, reason=exception ile error olur. Loglar içeriksizdir.
    max_attempts verilmezse PARSE_MAX_ATTEMPTS kullanılır (replay 1 verir: geri çekilme drain'dedir).
    """
    if max_attempts is None:
        max_attempts = _parse_max_attempts()
    base = _parse_retry_base_seconds()
    attempt = 1
    while True:
        try:
            outcome = asyncio.run(parse_listing_outcome(text, key_manager))
        except Exception as error:  # noqa: BLE001 - içerik loglanmaz, yalnız hata tipi
            logger.warning("parse_error reason=exception type=%s", type(error).__name__)
            return ParseOutcome(ERROR, None, "exception")
        if outcome.status != ERROR or outcome.reason not in RETRYABLE_REASONS or attempt >= max_attempts:
            return outcome
        delay = _retry_delay(attempt, base)
        logger.warning("parse_retry attempt=%d reason=%s delay_s=%.1f", attempt, outcome.reason, delay)
        _sleep(delay)
        attempt += 1


def _on_parse_failed(client, payload: dict, reason: Optional[str], agent_id: Optional[str]) -> Optional[str]:
    """Denemeler tükendiğinde (ya da geçici olmayan hatada) tek çağrı noktası.

    Mesaj "ilan değil" SAYILMAZ. İçeriksiz ERROR logu, ham mesajın pending_raw_messages'e
    bekletilmesi (drain döngüsü sonra yeniden işler; ortak yolda agent_id None) ve kişisel yolda
    personal_parse_error sayacı. payload id/group/groupName/agentId/text taşır.
    Bekletme hatası worker'ı düşürmez: yalnız hata tipi loglanır (metin/mesaj yok).
    """
    logger.error("parse_failed reason=%s message_id=%s", reason, str(payload.get("id") or ""))
    _park(client, payload, reason, agent_id)
    if agent_id:
        return _count_personal(client, "personal_parse_error", agent_id)
    return None


def _park(client, payload: dict, reason: Optional[str], agent_id: Optional[str]) -> None:
    """Ham mesajı pending_raw_messages'e bekletir. Hata worker'ı düşürmez: yalnız hata tipi loglanır."""
    message_id = str(payload.get("id") or "")
    try:
        park_raw_message(
            client,
            message_id=message_id,
            agent_id=agent_id,
            group=payload.get("group"),
            group_name=payload.get("groupName"),
            text=(payload.get("text") or "").strip(),
            reason=reason,
        )
    except Exception as error:  # noqa: BLE001 - içerik loglanmaz, yalnız hata tipi
        logger.error("pending_park_failed type=%s message_id=%s", type(error).__name__, message_id)


def _on_process_error(payload: dict, error: Exception) -> None:
    """Canlı yolda parse sonrası beklenmeyen istisna (geçici DB hatası, tuhaf model çıktısı vb.).

    Mesaj kaybolmasın diye PROCESS_ERROR_REASON ile bekletilir (drain sonra yeniden işler).
    Sayaç artırılmaz (parse hatası değildir). İstemci kurulamazsa ya da bekletme başarısızsa
    yalnız hata tipi loglanır; thread düşmez. Mesaj metni / istisna metni loglanmaz.
    """
    message_id = str(payload.get("id") or "")
    logger.error("process_failed type=%s message_id=%s", type(error).__name__, message_id)
    try:
        client = get_client()
    except Exception as client_error:  # noqa: BLE001 - içerik loglanmaz, yalnız hata tipi
        logger.error("pending_park_failed type=%s message_id=%s", type(client_error).__name__, message_id)
        return
    _park(client, payload, PROCESS_ERROR_REASON, payload.get("agentId") or None)


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
        "fingerprint": compute_fingerprint(parsed, raw_text=text),
        "quality_score": score,
        "status": "pending",
    }
    try:
        outcome = ingest_personal_listing(client, agent_id, record)
    except Exception:  # noqa: BLE001 - içeriksiz logla, worker'ı düşürme
        logger.exception("Kişisel ilan yazılamadı (içerik loglanmaz)")
        return _count_personal(client, PERSONAL_WRITE_ERROR, agent_id)

    return _log_personal_outcome(_personal_outcome_key(outcome, score), agent_id)



def _parse_error_result(client, payload: dict, reason: Optional[str], agent_id: Optional[str], replay: bool) -> Optional[str]:
    """Parse error'ın tek dallanma noktası. Canlı yol: _on_parse_failed (bekletir, sayar).

    Replay: yeniden bekletme ve sayaç YOK; drain'e "yine başarısız" bildirilir.
    """
    if replay:
        logger.warning("pending_replay_failed reason=%s message_id=%s", reason, str(payload.get("id") or ""))
        return REPLAY_PARSE_FAILED
    return _on_parse_failed(client, payload, reason, agent_id)


def _process_message(payload: dict, *, replay: bool = False) -> Optional[str]:
    """Mesaj işleme çekirdeği (canlı yol ve drain replay'i aynı kodu kullanır).

    replay=True: parse tek denemedir (geri çekilme drain zamanlamasındadır) ve parse error
    REPLAY_PARSE_FAILED döner. Beklenmeyen istisnalar YUKARI FIRLATILIR; _active_ids yönetimi
    çağırandadır.
    """
    message_id = str(payload.get("id") or "")
    text = (payload.get("text") or "").strip()
    group = payload.get("group")
    agent_id = payload.get("agentId")
    max_attempts = 1 if replay else None

    if not text:
        return None

    client = get_client()
    key_manager = get_default_manager()

    if agent_id:
        # KVKK: seçim önbelleği (sidecar, 60 sn) eski olabilir; metin parse'a (Gemini) gitmeden
        # önce grubun bu emlakçı için HÂLÂ seçili olduğu DB'den doğrulanır (replay'de de).
        try:
            selected = is_group_selected(client, agent_id, group)
        except Exception:  # noqa: BLE001 - pesimist: doğrulanamazsa parse etme, içerik loglanmaz
            logger.warning("Seçim doğrulanamadı, mesaj parse edilmedi (içerik loglanmaz)")
            return _count_personal(client, PERSONAL_SELECTION_CHECK_ERROR, agent_id)
        if not selected:
            return _count_personal(client, "personal_unselected", agent_id)
        outcome = _parse_with_retry(text, key_manager, max_attempts=max_attempts)
        if outcome.status == ERROR:
            return _parse_error_result(client, payload, outcome.reason, agent_id, replay)
        if outcome.status != LISTING:
            return _count_personal(client, "personal_not_listing", agent_id)
        return _handle_personal(client, agent_id, payload, message_id, text, outcome.parsed)

    outcome = _parse_with_retry(text, key_manager, max_attempts=max_attempts)
    if outcome.status == ERROR:
        return _parse_error_result(client, payload, outcome.reason, None, replay)
    if outcome.status != LISTING:
        logger.info("Mesaj ilan değil, atlandı: %s", message_id)
        return None
    parsed = outcome.parsed

    fingerprint = compute_fingerprint(parsed, raw_text=text)
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
    return None


def handle_message(payload: dict) -> Optional[str]:
    """Canlı yol (worker thread). İşlem-içi anahtar HER dönüş yolunda bırakılır.

    Parse sonrası beklenmeyen istisna mesajı kaybetmez: _on_process_error ile bekletilir.
    """
    key = _active_key(payload)
    try:
        if not _has_text(payload):
            return None
        try:
            return _process_message(payload)
        except Exception as error:  # noqa: BLE001 - worker thread düşmesin; içerik loglanmaz
            _on_process_error(payload, error)
        return None
    finally:
        if key is not None:
            with _active_ids_lock:
                _active_ids.discard(key)


def _pending_drain_interval_seconds() -> int:
    """PENDING_DRAIN_INTERVAL_SECONDS: varsayılan 300, 30..3600 aralığına sıkıştırılır; geçersizse varsayılan."""
    try:
        value = int(os.getenv(PENDING_DRAIN_INTERVAL_ENV, ""))
    except ValueError:
        return DEFAULT_PENDING_DRAIN_INTERVAL_SECONDS
    return max(PENDING_DRAIN_INTERVAL_MIN_SECONDS, min(PENDING_DRAIN_INTERVAL_MAX_SECONDS, value))


def _pending_max_attempts() -> int:
    """PENDING_MAX_ATTEMPTS: varsayılan 8, 1..20 aralığına sıkıştırılır; geçersizse varsayılan."""
    try:
        value = int(os.getenv(PENDING_MAX_ATTEMPTS_ENV, ""))
    except ValueError:
        return DEFAULT_PENDING_MAX_ATTEMPTS
    return max(1, min(PENDING_MAX_ATTEMPTS_LIMIT, value))


def _pending_backoff(attempts: int) -> timedelta:
    """Sonraki replay gecikmesi: min(6 sa, 5 dk * 2**attempts); attempts = bu denemeden önceki sayı."""
    if attempts >= 16:  # 5 dk * 2**16 zaten üst sınırın çok üstünde; taşmayı önler
        return PENDING_BACKOFF_MAX
    return min(PENDING_BACKOFF_MAX, PENDING_BACKOFF_BASE * (2 ** max(0, attempts)))


def _replay_message(payload: dict) -> str:
    """Bekleyen mesajı canlı yolla aynı çekirdekle yeniden işler. Dönüş: done | retry | busy.

    Aynı mesaj (emlakçı + mesaj ID'si, _active_key) canlı yolda işleniyorsa dokunulmaz (busy, sonraki turda).
    retry (satır silinmez, ertelenir): parse error, kişisel yolda geçici DB hatası (REPLAY_RETRY_RESULTS)
    ya da beklenmeyen istisna; istisnada yalnız hata tipi loglanır.
    """
    message_id = str(payload.get("id") or "")
    key = _active_key(payload)
    with _active_ids_lock:
        if key is not None and key in _active_ids:
            return DISPOSITION_BUSY
        if key is not None:
            _active_ids.add(key)
    try:
        result = _process_message(payload, replay=True)
    except Exception as error:  # noqa: BLE001 - içerik loglanmaz, yalnız hata tipi
        logger.warning("pending_replay_error type=%s message_id=%s", type(error).__name__, message_id)
        return DISPOSITION_RETRY
    finally:
        if key is not None:
            with _active_ids_lock:
                _active_ids.discard(key)
    return DISPOSITION_RETRY if result in REPLAY_RETRY_RESULTS else DISPOSITION_DONE


def _drain_pending_row(client, row: dict, max_attempts: int) -> None:
    """Tek satır: işlendiyse hemen silinir (metin amacından uzun yaşamaz); retry ise ertelenir."""
    row_id = row.get("id")
    message_id = str(row.get("source_message_id") or "")
    payload = {
        "id": message_id,
        "text": row.get("raw_text"),
        "group": row.get("source_group"),
        "groupName": row.get("source_group_name"),
        "agentId": row.get("agent_id"),
    }
    disposition = _replay_message(payload)
    if disposition == DISPOSITION_BUSY:
        logger.info("pending_replay_busy row_id=%s message_id=%s", row_id, message_id)
        return
    if disposition == DISPOSITION_DONE:
        delete_pending(client, row_id)
        logger.info("pending_replayed row_id=%s message_id=%s", row_id, message_id)
        return

    attempts = int(row.get("attempts") or 0)
    new_attempts = attempts + 1
    dead = new_attempts >= max_attempts
    reschedule_pending(client, row_id, new_attempts, _now() + _pending_backoff(attempts), dead)
    if dead:
        logger.error("pending_dead row_id=%s message_id=%s attempts=%d", row_id, message_id, new_attempts)


def _drain_pending_once() -> None:
    """Vadesi gelmiş en fazla PENDING_DRAIN_BATCH satırı bu thread'de SIRAYLA yeniden işler.

    Satır hatası diğer satırları durdurmaz; loglar içeriksizdir (id, neden kodu, hata tipi).
    """
    try:
        client = get_client()
        rows = fetch_due_pending(client, PENDING_DRAIN_BATCH)
    except Exception as error:  # noqa: BLE001 - drain arızası worker'ı düşürmez
        logger.warning("pending_drain_error operation=fetch type=%s", type(error).__name__)
        return
    max_attempts = _pending_max_attempts()
    for row in rows:
        try:
            _drain_pending_row(client, row, max_attempts)
        except Exception as error:  # noqa: BLE001 - tek satır hatası döngüyü durdurmaz
            logger.warning("pending_drain_error operation=row type=%s row_id=%s", type(error).__name__, row.get("id"))


def _pending_drain_loop() -> None:
    """Bekleyen ham mesajları başlangıçta ve her PENDING_DRAIN_INTERVAL_SECONDS'ta yeniden işler."""
    while True:
        try:
            _drain_pending_once()
        except Exception as error:  # noqa: BLE001 - drain arızası worker'ı düşürmez
            logger.warning("pending_drain_error operation=loop type=%s", type(error).__name__)
        time.sleep(_pending_drain_interval_seconds())


def _background_worker_loop(executor: ThreadPoolExecutor) -> None:
    while True:
        payload = message_queue.get()
        executor.submit(handle_message, payload)


PARSE_CACHE_PURGE_INTERVAL_SECONDS = 60 * 60


def _purge_once() -> None:
    """Süresi dolmuş parse_cache ve pending_raw_messages satırlarını siler; biri hata verse de diğeri çalışır."""
    try:
        removed = purge_expired_parse_cache(get_client())
        logger.info("parse_cache_purged count=%d", removed)
    except Exception as error:  # noqa: BLE001 - temizlik arızası worker'ı düşürmez
        logger.warning("cache_error operation=cleanup error=%s", type(error).__name__)
    try:
        removed = purge_expired_pending(get_client())
        logger.info("pending_purged count=%d", removed)
    except Exception as error:  # noqa: BLE001 - temizlik arızası worker'ı düşürmez
        logger.warning("pending_purge_error type=%s", type(error).__name__)


def _parse_cache_purge_loop() -> None:
    """Süresi dolmuş parse_cache ve bekleyen ham mesaj satırlarını başlangıçta ve saatlik siler. Hatada devam eder."""
    while True:
        _purge_once()
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
            if not isinstance(payload, dict):
                # Geçerli JSON ama nesne değil (dizi, string, sayı, null): geçersiz gövde gibi.
                raise ValueError("payload nesne değil")
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
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

        if not _has_text(payload):
            # Metinsiz (boş, yalnız boşluk ya da string olmayan) mesaj kuyruğa alınmaz ve
            # işlem-içi anahtar kaydedilmez; 200 ile "işlendi" denir (WhatsApp tekrar göndermesin).
            response = b"{}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
            return

        key = _active_key(payload)
        with _active_ids_lock:
            if key is not None and key in _active_ids:
                self.send_response(200)
                self.end_headers()
                return
            if key is not None:
                _active_ids.add(key)

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

    purge_thread = threading.Thread(target=_parse_cache_purge_loop, daemon=True)
    purge_thread.start()

    drain_thread = threading.Thread(target=_pending_drain_loop, daemon=True)
    drain_thread.start()

    server = HTTPServer((host, port), WebhookHandler)
    logger.info("Scraper worker %s:%s/baileys-webhook adresinde dinliyor.", host, port)
    server.serve_forever()


if __name__ == "__main__":
    run()
