# -*- coding: utf-8 -*-
"""scraper/durable_queue.py kalıcı parse kuyruğu testleri (ATDD kalici-parse-kuyrugu).

Gerçek sqlite kullanılır (tmp_path altında geçici dosya); bellek içi sahte yok.
Zaman her çağrıda açıkça geçilir (now); testler gerçek saate bağlı değildir.
Bu dosya KIRMIZI (red) beklenir: durable_queue.py henüz yok.
"""

import os
import threading

import pytest

import durable_queue as dq
from durable_queue import DurableQueue

NOW = 1_700_000_000.0
DAY = 24 * 3600
EMPTY = {"pending": 0, "processing": 0, "failed": 0}
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def queue(tmp_path):
    return DurableQueue(str(tmp_path / "q.sqlite3"))


def _payload(i, **extra):
    base = {"id": f"msg-{i}", "text": f"ilan metni {i} Kadıköy", "group": "120363000000000001@g.us"}
    base.update(extra)
    return base


def _claim_one(queue, now):
    claimed = queue.claim_due(10, now)
    assert len(claimed) == 1
    return claimed[0]


def _fail_permanently(queue, row_id, now):
    """Işlenmekte olan (processing) kaydı MAX_ATTEMPTS kez geri alır.

    Ara geri almalar 'pending' döner ve zamanı gelince yeniden claim edilir; son geri alma
    'failed' döndürmeli. Dönüş: failed_at olarak kullanılan zaman.
    """
    for attempt in range(1, dq.MAX_ATTEMPTS):
        assert queue.retry_later(row_id, now) == "pending"
        now += dq.BACKOFF_S[attempt - 1]
        assert [rid for rid, _ in queue.claim_due(10, now)] == [row_id]
    assert queue.retry_later(row_id, now) == "failed"
    return now


# ---------------------------------------------------------------------------
# Sabitler
# ---------------------------------------------------------------------------


def test_contract_constants_match_atdd():
    assert dq.BACKOFF_S == (60, 300, 900, 3600)
    assert dq.MAX_ATTEMPTS == 5
    assert dq.FAILED_RETENTION_S == 7 * DAY


# ---------------------------------------------------------------------------
# Kurulum / kalıcılık
# ---------------------------------------------------------------------------


def test_creates_missing_parent_directories(tmp_path):
    target = tmp_path / "yeni" / "alt-klasor" / "parse-queue.sqlite3"
    DurableQueue(str(target))
    assert target.is_file()


def test_fresh_queue_counts_all_zero(queue):
    assert queue.counts() == EMPTY


def test_queue_contents_survive_reopening_the_file(tmp_path):
    path = str(tmp_path / "q.sqlite3")
    assert DurableQueue(path).enqueue(_payload(1), NOW) is True
    reopened = DurableQueue(path)
    assert reopened.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert [p for _, p in reopened.claim_due(10, NOW)] == [_payload(1)]


# ---------------------------------------------------------------------------
# enqueue
# ---------------------------------------------------------------------------


def test_enqueue_new_payload_returns_true_and_adds_one_row(queue):
    assert queue.enqueue(_payload(1), NOW) is True
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}


def test_enqueue_same_id_returns_false_and_keeps_single_row(queue):
    assert queue.enqueue(_payload(1), NOW) is True
    assert queue.enqueue(_payload(1), NOW) is False
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}


def test_enqueue_same_id_while_processing_returns_false(queue):
    assert queue.enqueue(_payload(1), NOW) is True
    _claim_one(queue, NOW)
    assert queue.enqueue(_payload(1), NOW) is False
    assert queue.counts() == {"pending": 0, "processing": 1, "failed": 0}


def test_enqueue_same_id_while_failed_returns_false(queue):
    assert queue.enqueue(_payload(1), NOW) is True
    row_id, _ = _claim_one(queue, NOW)
    _fail_permanently(queue, row_id, NOW)
    assert queue.enqueue(_payload(1), NOW + 1) is False
    assert queue.counts() == {"pending": 0, "processing": 0, "failed": 1}


def test_payloads_without_id_are_each_enqueued_with_generated_keys(queue):
    assert queue.enqueue({"text": "aynı metin"}, NOW) is True
    assert queue.enqueue({"text": "aynı metin"}, NOW) is True
    assert queue.counts() == {"pending": 2, "processing": 0, "failed": 0}


def test_enqueued_payload_round_trips_unicode_unchanged(queue):
    payload = _payload(1, extra={"fiyat": 2500000, "not": "çok güzel ş ğ ı"})
    queue.enqueue(payload, NOW)
    [(_, claimed)] = queue.claim_due(10, NOW)
    assert claimed == payload


# ---------------------------------------------------------------------------
# claim_due
# ---------------------------------------------------------------------------


def test_claim_due_returns_only_rows_whose_time_has_come(queue):
    queue.enqueue(_payload(1), NOW)
    queue.enqueue(_payload(2), NOW + 100)
    claimed = queue.claim_due(10, NOW + 50)
    assert [p for _, p in claimed] == [_payload(1)]
    assert all(isinstance(row_id, int) for row_id, _ in claimed)
    assert queue.counts() == {"pending": 1, "processing": 1, "failed": 0}


def test_claim_due_respects_limit(queue):
    for i in range(5):
        queue.enqueue(_payload(i), NOW)
    assert len(queue.claim_due(2, NOW)) == 2
    assert len(queue.claim_due(10, NOW)) == 3
    assert queue.claim_due(10, NOW) == []


def test_claimed_rows_are_processing_and_never_returned_again(queue):
    queue.enqueue(_payload(1), NOW)
    _claim_one(queue, NOW)
    assert queue.counts() == {"pending": 0, "processing": 1, "failed": 0}
    assert queue.claim_due(10, NOW + 10**6) == []


# ---------------------------------------------------------------------------
# complete
# ---------------------------------------------------------------------------


def test_complete_deletes_the_row(queue):
    queue.enqueue(_payload(1), NOW)
    row_id, _ = _claim_one(queue, NOW)
    queue.complete(row_id)
    assert queue.counts() == EMPTY


# ---------------------------------------------------------------------------
# retry_later (backoff ve failed)
# ---------------------------------------------------------------------------


def test_retry_later_follows_backoff_schedule_and_stays_pending(queue):
    queue.enqueue(_payload(1), NOW)
    now = NOW
    for expected_delay in (60, 300, 900, 3600):
        row_id, _ = _claim_one(queue, now)
        assert queue.retry_later(row_id, now) == "pending"
        assert queue.claim_due(10, now + expected_delay - 1) == []
        now += expected_delay
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}


def test_fifth_failed_attempt_marks_row_failed_and_never_claimable(queue):
    queue.enqueue(_payload(1), NOW)
    row_id, _ = _claim_one(queue, NOW)
    _fail_permanently(queue, row_id, NOW)
    assert queue.counts() == {"pending": 0, "processing": 0, "failed": 1}
    assert queue.claim_due(10, NOW + 10**9) == []


# ---------------------------------------------------------------------------
# recover_processing
# ---------------------------------------------------------------------------


def test_recover_processing_returns_claimed_rows_to_pending(queue):
    for i in range(3):
        queue.enqueue(_payload(i), NOW)
    assert len(queue.claim_due(2, NOW)) == 2
    assert queue.recover_processing() == 2
    assert queue.counts() == {"pending": 3, "processing": 0, "failed": 0}


def test_recover_processing_returns_zero_when_nothing_is_processing(queue):
    queue.enqueue(_payload(1), NOW)
    assert queue.recover_processing() == 0
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}


# ---------------------------------------------------------------------------
# purge_failed (7 gün sınırı)
# ---------------------------------------------------------------------------


def test_purge_failed_deletes_exactly_at_seven_day_boundary(queue):
    queue.enqueue(_payload(1), NOW)
    row_id, _ = _claim_one(queue, NOW)
    failed_at = _fail_permanently(queue, row_id, NOW)

    assert queue.purge_failed(failed_at + dq.FAILED_RETENTION_S - 1) == 0
    assert queue.counts() == {"pending": 0, "processing": 0, "failed": 1}

    assert queue.purge_failed(failed_at + dq.FAILED_RETENTION_S) == 1
    assert queue.counts() == EMPTY


def test_purge_failed_keeps_pending_and_processing_rows(queue):
    queue.enqueue(_payload(1), NOW)
    queue.enqueue(_payload(2), NOW)
    assert len(queue.claim_due(1, NOW)) == 1
    assert queue.purge_failed(NOW + 10 * DAY) == 0
    assert queue.counts() == {"pending": 1, "processing": 1, "failed": 0}


# ---------------------------------------------------------------------------
# default_path (AC-S1: yol repo ve OneDrive dışında)
# ---------------------------------------------------------------------------


def test_default_path_prefers_parse_queue_path_env(monkeypatch, tmp_path):
    custom = str(tmp_path / "ozel" / "kuyruk.sqlite3")
    monkeypatch.setenv("PARSE_QUEUE_PATH", custom)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    assert os.path.normpath(dq.default_path()) == os.path.normpath(custom)


def test_default_path_uses_localappdata_when_env_not_set(monkeypatch, tmp_path):
    monkeypatch.delenv("PARSE_QUEUE_PATH", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    expected = os.path.join(str(tmp_path), "emlak-platform", "parse-queue.sqlite3")
    assert os.path.normpath(dq.default_path()) == os.path.normpath(expected)


def test_default_path_falls_back_to_home_without_localappdata(monkeypatch, tmp_path):
    monkeypatch.delenv("PARSE_QUEUE_PATH", raising=False)
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    expected = os.path.join(str(tmp_path), ".emlak-platform", "parse-queue.sqlite3")
    assert os.path.normpath(dq.default_path()) == os.path.normpath(expected)


def test_default_path_is_outside_repo_and_onedrive(monkeypatch):
    monkeypatch.delenv("PARSE_QUEUE_PATH", raising=False)
    path = os.path.normcase(os.path.abspath(dq.default_path()))
    repo = os.path.normcase(os.path.abspath(REPO_ROOT))
    assert not path.startswith(repo + os.sep), "kuyruk dosyası repo içine düşmemeli"
    assert "onedrive" not in path, "kuyruk dosyası OneDrive içine düşmemeli"


# ---------------------------------------------------------------------------
# Eşzamanlılık (AC-9)
# ---------------------------------------------------------------------------


def test_concurrent_claims_never_return_the_same_row(queue):
    total = 200
    for i in range(total):
        assert queue.enqueue(_payload(i), NOW) is True

    workers = 4
    barrier = threading.Barrier(workers)
    claimed_ids = []
    errors = []
    lock = threading.Lock()

    def drain():
        try:
            barrier.wait(timeout=10)
            while True:
                batch = queue.claim_due(5, NOW)
                if not batch:
                    return
                with lock:
                    claimed_ids.extend(row_id for row_id, _ in batch)
        except Exception as exc:  # noqa: BLE001 - iş parçacığı hatası testte yakalanır
            errors.append(exc)

    threads = [threading.Thread(target=drain) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert not any(thread.is_alive() for thread in threads)
    assert errors == []
    assert len(claimed_ids) == total
    assert len(set(claimed_ids)) == total, "aynı kayıt iki worker'a verilmemeli"
    assert queue.counts() == {"pending": 0, "processing": total, "failed": 0}
