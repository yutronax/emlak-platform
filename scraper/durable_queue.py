# -*- coding: utf-8 -*-
"""Kalıcı parse kuyruğu (ATDD kalici-parse-kuyrugu).

stdlib sqlite3, tek dosya, WAL modu. Tek bağlantı + kilit: tüm işlemler kilit altında
çalışır, claim_due tek transaction içinde seçim + durum güncellemesi yapar.
Loglar içeriksizdir (mesaj metni, JID, telefon yok; yalnız sayı ve durum).
"""

import json
import logging
import os
import sqlite3
import threading
import uuid
from typing import Dict, List, Tuple

logger = logging.getLogger("scraper.durable_queue")

BACKOFF_S = (60, 300, 900, 3600)
MAX_ATTEMPTS = 5
FAILED_RETENTION_S = 7 * 24 * 3600
_FILENAME = "parse-queue.sqlite3"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS parse_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at REAL NOT NULL,
    failed_at REAL,
    created_at REAL NOT NULL
)
"""


_ONEDRIVE_ENV_VARS = ("OneDrive", "OneDriveConsumer", "OneDriveCommercial")
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def default_path() -> str:
    """Kuyruk dosyasının mutlak yolu: PARSE_QUEUE_PATH > %LOCALAPPDATA% > ~/.emlak-platform. Repo dışında."""
    override = os.getenv("PARSE_QUEUE_PATH", "").strip()
    if override:
        return os.path.abspath(override)
    local_app_data = os.getenv("LOCALAPPDATA", "").strip()
    if local_app_data:
        return os.path.abspath(os.path.join(local_app_data, "emlak-platform", _FILENAME))
    return os.path.abspath(os.path.join(os.path.expanduser("~"), ".emlak-platform", _FILENAME))


def _is_within(path: str, root: str) -> bool:
    norm_path = os.path.normcase(path)
    norm_root = os.path.normcase(root).rstrip(os.sep)
    return norm_path == norm_root or norm_path.startswith(norm_root + os.sep)


def _assert_allowed_location(path: str) -> None:
    """Kuyruk repo kökü ya da OneDrive altına düşemez (AC-S1, AC-S7, AC-S7b).

    Hedef ve yasak kökler os.path.realpath ile fiziksel yola çözülür; junction/sembolik bağ üzerinden
    gelen yol da yakalanır. realpath var olmayan son parçaları da ekler (en yakın mevcut ata çözülür).
    Dosya/klasör oluşturulmadan önce çağrılır.
    """
    candidates = {os.path.abspath(path), os.path.realpath(path)}
    roots = [_REPO_ROOT]
    for name in _ONEDRIVE_ENV_VARS:
        value = os.getenv(name, "").strip()
        if value:
            roots.append(value)
    for candidate in candidates:
        for root in roots:
            if _is_within(candidate, os.path.realpath(os.path.abspath(root))):
                raise ValueError("parse kuyruğu repo veya OneDrive içinde olamaz")


class DurableQueue:
    def __init__(self, path: str) -> None:
        path = os.path.abspath(path)
        _assert_allowed_location(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None, timeout=30)
        self._conn.execute("PRAGMA secure_delete=ON")
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(_SCHEMA)

    def enqueue(self, payload: dict, now: float) -> bool:
        """Payload'ı ekler. Anahtar payload['id'] (boş değilse) ya da üretilen uuid. True = yeni kayıt."""
        message_id = payload.get("id")
        key = message_id if isinstance(message_id, str) and message_id else uuid.uuid4().hex
        body = json.dumps(payload, ensure_ascii=False)
        with self._lock:
            cursor = self._conn.execute(
                "INSERT OR IGNORE INTO parse_queue "
                "(key, payload, status, attempts, next_attempt_at, failed_at, created_at) "
                "VALUES (?, ?, 'pending', 0, ?, NULL, ?)",
                (key, body, now, now),
            )
            return cursor.rowcount == 1

    def claim_due(self, limit: int, now: float) -> List[Tuple[int, dict]]:
        """Zamanı gelmiş bekleyen kayıtları en fazla limit kadar alır ve processing yapar."""
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                rows = self._conn.execute(
                    "SELECT id, payload FROM parse_queue "
                    "WHERE status = 'pending' AND next_attempt_at <= ? "
                    "ORDER BY next_attempt_at, id LIMIT ?",
                    (now, limit),
                ).fetchall()
                if rows:
                    marks = ",".join("?" * len(rows))
                    self._conn.execute(
                        f"UPDATE parse_queue SET status = 'processing' WHERE id IN ({marks})",
                        [row_id for row_id, _ in rows],
                    )
                self._conn.execute("COMMIT")
            except BaseException:
                self._conn.execute("ROLLBACK")
                raise
        return [(row_id, json.loads(payload)) for row_id, payload in rows]

    def complete(self, row_id: int) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM parse_queue WHERE id = ?", (row_id,))
            self._checkpoint_locked()

    def release(self, row_id: int) -> None:
        """Gönderilemeyen processing kaydını attempts ve zaman değiştirmeden pending'e döndürür."""
        with self._lock:
            self._conn.execute(
                "UPDATE parse_queue SET status = 'pending' WHERE id = ? AND status = 'processing'",
                (row_id,),
            )

    def checkpoint(self) -> bool:
        """WAL'ı ana dosyaya yazar ve sıfırlar. True: tam temizlendi; False: okuyucu engelledi (busy)."""
        with self._lock:
            return self._checkpoint_locked()

    def _checkpoint_locked(self) -> bool:
        """Kilit altında çağrılır. Busy'de bekleme yapmaz (claim yolunu durdurmaz), uyarı loglar."""
        self._conn.execute("PRAGMA busy_timeout=0")
        try:
            busy, _log_frames, _checkpointed = self._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        finally:
            self._conn.execute("PRAGMA busy_timeout=30000")
        if busy:
            logger.warning("queue_checkpoint_busy")
            return False
        return True

    def retry_later(self, row_id: int, now: float) -> str:
        """Geçici hatada geri alır. Dönüş: 'pending' (backoff ile) ya da 'failed' (MAX_ATTEMPTS doldu).

        Deneme sayısı ve durum logu burada içeriksiz olarak yazılır.
        """
        with self._lock:
            row = self._conn.execute("SELECT attempts FROM parse_queue WHERE id = ?", (row_id,)).fetchone()
            if row is None:
                raise KeyError(row_id)
            attempts: int = row[0] + 1
            if attempts >= MAX_ATTEMPTS:
                self._conn.execute(
                    "UPDATE parse_queue SET status = 'failed', attempts = ?, failed_at = ? WHERE id = ?",
                    (attempts, now, row_id),
                )
                status = "failed"
            else:
                delay = BACKOFF_S[attempts - 1]
                self._conn.execute(
                    "UPDATE parse_queue SET status = 'pending', attempts = ?, next_attempt_at = ? WHERE id = ?",
                    (attempts, now + delay, row_id),
                )
                status = "pending"
        if status == "failed":
            logger.warning("queue_failed")
        else:
            logger.info("queue_retry attempts=%d", attempts)
        return status

    def recover_processing(self) -> int:
        """Önceki süreçte işlenmekte kalan kayıtları pending'e döndürür. Dönüş: etkilenen sayı."""
        with self._lock:
            cursor = self._conn.execute("UPDATE parse_queue SET status = 'pending' WHERE status = 'processing'")
            return cursor.rowcount

    def purge_failed(self, now: float) -> int:
        """FAILED_RETENTION_S'den eski failed kayıtları siler. Dönüş: silinen sayı."""
        with self._lock:
            cursor = self._conn.execute(
                "DELETE FROM parse_queue WHERE status = 'failed' AND failed_at <= ?",
                (now - FAILED_RETENTION_S,),
            )
            removed = cursor.rowcount
            self._checkpoint_locked()
            return removed

    def counts(self) -> Dict[str, int]:
        with self._lock:
            rows = self._conn.execute("SELECT status, COUNT(*) FROM parse_queue GROUP BY status").fetchall()
        result = {"pending": 0, "processing": 0, "failed": 0}
        for status, count in rows:
            result[status] = count
        return result
