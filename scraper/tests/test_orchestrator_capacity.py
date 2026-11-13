# -*- coding: utf-8 -*-
"""Red-team tur 1 - AC-11 (eşzamanlı iş sınırı) ve AC-12 (submit hatasında geri bırakma).

AC-11: dispatch_due yalnız boş kapasite kadar claim eder; işler bitene kadar fazlasını almaz.
AC-12: executor.submit hata verirse claim edilen ama gönderilemeyen kayıtlar pending'e döner
       (attempts artmaz); dispatch_due exception fırlatmaz.

Kapasite davranışla doğrulanır: sahte executor işleri hemen çalıştırmaz, listede tutar; test
bir işi kendisi çalıştırıp bitirir (kapasite geri gelir).

Bu dosya KIRMIZI beklenir: mevcut dispatch_due her çağrıda MAX_WORKERS kayıt alıyor.
"""

import time
from unittest.mock import MagicMock, patch

import pytest

import orchestrator
from durable_queue import DurableQueue

MAX = orchestrator.MAX_WORKERS


@pytest.fixture(autouse=True)
def inbox(monkeypatch, tmp_path):
    queue = DurableQueue(str(tmp_path / "inbox.sqlite3"))
    monkeypatch.setattr(orchestrator, "inbox", queue, raising=False)
    return queue


def _payload(i):
    return {"id": f"cap-{i}", "text": f"kapasite testi {i} Kadıköy", "group": "120363000000000001@g.us"}


class _BlockingExecutor:
    """submit edilen işleri çalıştırmaz; bekleyen listesinde tutar."""

    def __init__(self):
        self.pending = []

    def submit(self, fn, *args, **kwargs):
        self.pending.append((fn, args))
        return MagicMock(name="future")

    def finish_one(self):
        fn, args = self.pending.pop(0)
        fn(*args)


# ---------------------------------------------------------------------------
# AC-11
# ---------------------------------------------------------------------------


def test_consecutive_dispatches_never_exceed_max_workers(inbox):
    now = time.time()
    for i in range(MAX + 5):
        inbox.enqueue(_payload(i), now - 1)
    executor = _BlockingExecutor()

    with patch("orchestrator.handle_message", return_value=None):
        assert orchestrator.dispatch_due(executor, now) == MAX
        assert orchestrator.dispatch_due(executor, now) == 0, "kapasite dolu iken yeni iş alınmamalı"
        assert len(executor.pending) == MAX
        assert inbox.counts()["processing"] <= MAX

        executor.finish_one()
        assert orchestrator.dispatch_due(executor, now) == 1, "biten işin yerine tam 1 iş alınmalı"
        assert inbox.counts()["processing"] <= MAX
        assert len(executor.pending) == MAX


def test_processing_count_never_exceeds_max_while_draining(inbox):
    now = time.time()
    total = MAX + 5
    for i in range(total):
        inbox.enqueue(_payload(i), now - 1)
    executor = _BlockingExecutor()

    processed = 0
    max_seen = 0
    with patch("orchestrator.handle_message", return_value=None):
        for _ in range(10 * total):
            orchestrator.dispatch_due(executor, now)
            max_seen = max(max_seen, inbox.counts()["processing"])
            if not executor.pending:
                break
            executor.finish_one()
            processed += 1

    assert max_seen <= MAX
    assert processed == total
    assert inbox.counts() == {"pending": 0, "processing": 0, "failed": 0}


# ---------------------------------------------------------------------------
# AC-12
# ---------------------------------------------------------------------------


def test_submit_failure_returns_all_claimed_rows_to_pending_without_attempt(inbox):
    now = time.time()
    for i in range(3):
        inbox.enqueue(_payload(i), now - 1)
    executor = MagicMock(name="executor")
    executor.submit.side_effect = RuntimeError("submit down")

    orchestrator.dispatch_due(executor, now)  # exception fırlatmamalı

    assert inbox.counts() == {"pending": 3, "processing": 0, "failed": 0}
    assert len(inbox.claim_due(10, now)) == 3, "gönderilemeyen kayıt backoff almamalı (attempts 0)"


def test_partial_submit_failure_releases_only_unsubmitted_rows(inbox):
    now = time.time()
    for i in range(3):
        inbox.enqueue(_payload(i), now - 1)
    calls = {"count": 0}

    def submit(fn, *args, **kwargs):
        calls["count"] += 1
        if calls["count"] > 1:
            raise RuntimeError("submit down")
        return MagicMock(name="future")

    executor = MagicMock(name="executor")
    executor.submit.side_effect = submit

    orchestrator.dispatch_due(executor, now)  # exception fırlatmamalı

    assert inbox.counts() == {"pending": 2, "processing": 1, "failed": 0}
