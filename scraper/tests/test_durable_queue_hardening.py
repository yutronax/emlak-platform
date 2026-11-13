# -*- coding: utf-8 -*-
"""Red-team tur 1 - DurableQueue sertleştirme testleri.

- AC-12: release(row_id) processing -> pending, attempts değişmez.
- AC-S6: secure_delete açık; checkpoint() exception fırlatmaz; silinen ham metin DB ve WAL dosyalarında kalmaz.
- AC-S7: göreli PARSE_QUEUE_PATH mutlak yola çevrilir; repo ya da OneDrive altında kuyruk ValueError.

Bu dosya KIRMIZI beklenir: release, checkpoint ve yol doğrulaması henüz yok.
"""

import logging
import os
import sqlite3
import subprocess

import pytest

import durable_queue as dq
from durable_queue import DurableQueue

NOW = 1_700_000_000.0
EMPTY = {"pending": 0, "processing": 0, "failed": 0}
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MARKER = "KALICI-SILINMELI-ALFA-7741"
ONEDRIVE_VARS = ("OneDrive", "OneDriveConsumer", "OneDriveCommercial")


@pytest.fixture
def queue(tmp_path):
    return DurableQueue(str(tmp_path / "q.sqlite3"))


def _payload(i):
    return {"id": f"hard-{i}", "text": f"ilan {i} Kadıköy"}


# ---------------------------------------------------------------------------
# AC-12: release
# ---------------------------------------------------------------------------


def test_release_returns_processing_row_to_pending_immediately(queue):
    queue.enqueue(_payload(1), NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]
    queue.release(row_id)
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert [rid for rid, _ in queue.claim_due(10, NOW)] == [row_id], "backoff uygulanmamalı"


def test_release_does_not_change_attempts(queue):
    queue.enqueue(_payload(1), NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]
    queue.release(row_id)
    # attempts 0 kalmalı: bir sonraki geri alma ilk backoff'u (60 sn) uygulamalı.
    claimed = queue.claim_due(10, NOW)
    assert [rid for rid, _ in claimed] == [row_id]
    assert queue.retry_later(row_id, NOW) == "pending"
    assert queue.claim_due(10, NOW + 59) == []
    assert len(queue.claim_due(10, NOW + 60)) == 1


# ---------------------------------------------------------------------------
# AC-S6: secure_delete, checkpoint, fiziksel kalıntı
# ---------------------------------------------------------------------------


def test_queue_connection_has_secure_delete_on(queue):
    assert queue._conn.execute("PRAGMA secure_delete").fetchone()[0] == 1


def test_checkpoint_returns_true_and_leaves_wal_empty(tmp_path):
    """Red-team tur 2 (AC-S6b): checkpoint busy değilse True döner (tam temizlendi)."""
    path = str(tmp_path / "q.sqlite3")
    queue = DurableQueue(path)
    queue.enqueue(_payload(1), NOW)
    assert queue.checkpoint() is True
    wal = path + "-wal"
    assert not os.path.exists(wal) or os.path.getsize(wal) == 0


def test_deleted_raw_text_is_not_left_in_db_or_wal_after_checkpoint(tmp_path):
    path = str(tmp_path / "q.sqlite3")
    queue = DurableQueue(path)
    queue.enqueue({"id": "m-del", "text": MARKER}, NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]
    queue.complete(row_id)
    queue.checkpoint()
    for file_path in (path, path + "-wal"):
        if os.path.exists(file_path):
            with open(file_path, "rb") as handle:
                assert MARKER.encode("utf-8") not in handle.read(), f"ham metin kalmamalı: {file_path}"


# ---------------------------------------------------------------------------
# AC-S7: yol kısıtları
# ---------------------------------------------------------------------------


def test_relative_parse_queue_path_resolves_to_absolute(monkeypatch):
    monkeypatch.setenv("PARSE_QUEUE_PATH", os.path.join("goreli", "q.sqlite3"))
    result = dq.default_path()
    assert os.path.isabs(result)
    assert os.path.normcase(result) == os.path.normcase(os.path.abspath(os.path.join("goreli", "q.sqlite3")))


def test_queue_inside_repo_root_is_rejected(monkeypatch):
    for name in ONEDRIVE_VARS:
        monkeypatch.delenv(name, raising=False)
    target = os.path.join(REPO_ROOT, "red-team-test-kuyrugu.sqlite3")
    try:
        with pytest.raises(ValueError):
            DurableQueue(target)
    finally:
        if os.path.exists(target):
            os.remove(target)
    assert not os.path.exists(target), "repo içinde dosya oluşturulmamalı"


@pytest.mark.parametrize("env_name", ONEDRIVE_VARS)
def test_queue_under_onedrive_env_root_is_rejected(monkeypatch, tmp_path, env_name):
    for name in ONEDRIVE_VARS:
        monkeypatch.delenv(name, raising=False)
    onedrive_root = tmp_path / "OneDrive"
    monkeypatch.setenv(env_name, str(onedrive_root))
    target = onedrive_root / "q.sqlite3"
    with pytest.raises(ValueError):
        DurableQueue(str(target))
    assert not target.exists()


def test_queue_outside_onedrive_and_repo_is_accepted(monkeypatch, tmp_path):
    for name in ONEDRIVE_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("OneDrive", str(tmp_path / "OneDrive"))
    queue = DurableQueue(str(tmp_path / "guvenli" / "q.sqlite3"))
    assert queue.counts() == EMPTY


# ---------------------------------------------------------------------------
# Red-team tur 2 - AC-S6b: silme sonrası fiziksel kalıntı (complete / purge_failed)
# ---------------------------------------------------------------------------


def _assert_marker_absent(path):
    for file_path in (path, path + "-wal"):
        if os.path.exists(file_path):
            with open(file_path, "rb") as handle:
                assert MARKER.encode("utf-8") not in handle.read(), f"ham metin kalmamalı: {file_path}"


def _fail_permanently(queue, row_id, now):
    for attempt in range(1, dq.MAX_ATTEMPTS):
        assert queue.retry_later(row_id, now) == "pending"
        now += dq.BACKOFF_S[attempt - 1]
        assert [rid for rid, _ in queue.claim_due(10, now)] == [row_id]
    assert queue.retry_later(row_id, now) == "failed"
    return now


def test_complete_removes_raw_text_from_db_and_wal_without_explicit_checkpoint(tmp_path):
    path = str(tmp_path / "q.sqlite3")
    queue = DurableQueue(path)
    queue.enqueue({"id": "m-c", "text": MARKER}, NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]
    queue.complete(row_id)
    _assert_marker_absent(path)


def test_purge_failed_removes_raw_text_from_db_and_wal_without_explicit_checkpoint(tmp_path):
    path = str(tmp_path / "q.sqlite3")
    queue = DurableQueue(path)
    queue.enqueue({"id": "m-p", "text": MARKER}, NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]
    failed_at = _fail_permanently(queue, row_id, NOW)
    assert queue.purge_failed(failed_at + dq.FAILED_RETENTION_S) == 1
    _assert_marker_absent(path)


def test_checkpoint_busy_returns_false_logs_busy_and_retries_after_reader_closes(tmp_path, caplog):
    """Başka bir bağlantı okuma transaction'ı tutarken checkpoint tamamlanamaz: False + içeriksiz uyarı.
    Okuyucu kapanınca checkpoint True döner ve kalıntı kalmaz."""
    caplog.set_level(logging.DEBUG)
    path = str(tmp_path / "q.sqlite3")
    queue = DurableQueue(path)
    queue.enqueue({"id": "m-b", "text": MARKER}, NOW)
    row_id, _ = queue.claim_due(10, NOW)[0]

    reader = sqlite3.connect(path, isolation_level=None)
    reader.execute("BEGIN")
    reader.execute("SELECT COUNT(*) FROM parse_queue").fetchall()
    try:
        queue.complete(row_id)
        assert queue.checkpoint() is False
        assert "queue_checkpoint_busy" in caplog.text
        assert MARKER not in caplog.text, "busy uyarısında içerik olmamalı"
    finally:
        reader.execute("COMMIT")
        reader.close()

    assert queue.checkpoint() is True
    _assert_marker_absent(path)


# ---------------------------------------------------------------------------
# Red-team tur 2 - AC-S7b: junction / sembolik bağ üzerinden OneDrive'a giden yol reddedilir
# ---------------------------------------------------------------------------


def _install_link(monkeypatch, tmp_path, target):
    """target'a işaret eden bağ: önce sembolik bağ, olmazsa junction, o da olmazsa realpath taklidi."""
    link = tmp_path / "baglanti"
    try:
        os.symlink(str(target), str(link), target_is_directory=True)
        return link
    except OSError:
        pass
    try:
        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], check=True, capture_output=True)
        return link
    except (OSError, subprocess.CalledProcessError):
        pass

    link_str = os.path.abspath(str(link))
    target_str = os.path.abspath(str(target))
    real_realpath = os.path.realpath

    def fake_realpath(path, *args, **kwargs):
        absolute = os.path.abspath(str(path))
        if os.path.normcase(absolute).startswith(os.path.normcase(link_str)):
            return target_str + absolute[len(link_str):]
        return real_realpath(path, *args, **kwargs)

    monkeypatch.setattr(os.path, "realpath", fake_realpath)
    return link


@pytest.fixture
def onedrive_link(monkeypatch, tmp_path):
    for name in ONEDRIVE_VARS:
        monkeypatch.delenv(name, raising=False)
    forbidden = tmp_path / "OneDrive"
    forbidden.mkdir()
    monkeypatch.setenv("OneDrive", str(forbidden))
    link = _install_link(monkeypatch, tmp_path, forbidden)
    return forbidden, link


def test_queue_through_link_into_onedrive_is_rejected(onedrive_link):
    forbidden, link = onedrive_link
    with pytest.raises(ValueError):
        DurableQueue(str(link / "q.sqlite3"))
    assert not (forbidden / "q.sqlite3").exists()


def test_queue_through_link_into_missing_subfolder_of_onedrive_is_rejected(onedrive_link):
    forbidden, link = onedrive_link
    with pytest.raises(ValueError):
        DurableQueue(str(link / "yeni" / "q.sqlite3"))
    assert not (forbidden / "yeni").exists(), "yasak yol altında dizin oluşturulmamalı"
