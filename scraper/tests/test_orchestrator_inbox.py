# -*- coding: utf-8 -*-
"""scraper/orchestrator.py kalıcı kuyruk entegrasyonu (ATDD kalici-parse-kuyrugu
AC-1, AC-3, AC-4, AC-5, AC-7, AC-S2).

Kapsam: webhook -> inbox.enqueue (200 / 503), process_entry sonuç eşlemesi,
GeminiUnavailable yayılımı (ortak ve kişisel yol), dispatch_due, run() kurtarma
sırası, içeriksiz loglar.

Patch kuralı: orchestrator.py isimleri orchestrator modülünde yaşar -> orchestrator.<isim>.
inbox her testte tmp_path altında gerçek DurableQueue ile değiştirilir.
Bu dosya KIRMIZI (red) beklenir: orchestrator.inbox / process_entry / dispatch_due henüz yok.
"""

import http.client
import json
import logging
import threading
import time
from contextlib import ExitStack
from http.server import HTTPServer
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import orchestrator
from durable_queue import DurableQueue
from parser import GeminiUnavailable

SECRET = "test-secret-inbox-abcdefghijklmnop-55555"
RAW_TEXT = "INBOX-GIZLI-METIN 3+1 Kadıköy 5321234512"
GROUP_JID = "120363000000000001@g.us"
AGENT_A = "11111111-2222-4333-8444-555555555555"
EMPTY = {"pending": 0, "processing": 0, "failed": 0}
FAR_FUTURE = 10**7


@pytest.fixture(autouse=True)
def inbox(monkeypatch, tmp_path):
    """Her testte orchestrator.inbox tmp_path altında gerçek DurableQueue olur; webhook gizli anahtarı."""
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    queue = DurableQueue(str(tmp_path / "inbox.sqlite3"))
    monkeypatch.setattr(orchestrator, "inbox", queue, raising=False)
    return queue


@pytest.fixture
def server_port():
    server = HTTPServer(("127.0.0.1", 0), orchestrator.WebhookHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1]
    server.shutdown()
    thread.join(timeout=5)
    server.server_close()


def _payload(i=1, **extra):
    base = {"id": f"inbox-{i}", "text": RAW_TEXT, "group": GROUP_JID, "groupName": "Kadıköy Emlak"}
    base.update(extra)
    return base


def _post(port, body_dict, token=SECRET):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        body = json.dumps(body_dict, ensure_ascii=False).encode("utf-8")
        headers = {"Authorization": f"Bearer {token}", "Content-Length": str(len(body))}
        conn.request("POST", "/baileys-webhook", body=body, headers=headers)
        resp = conn.getresponse()
        return resp.status, resp.read()
    finally:
        conn.close()


def _claim_one(queue):
    claimed = queue.claim_due(10, time.time() + FAR_FUTURE)
    assert len(claimed) == 1
    return claimed[0]


def _enter_common_pipeline(stack, parse):
    stack.enter_context(patch("orchestrator.get_client", return_value=MagicMock()))
    stack.enter_context(patch("orchestrator.get_default_manager", return_value=MagicMock()))
    stack.enter_context(patch("orchestrator.parse_listing_message", new=parse))
    stack.enter_context(patch("orchestrator.compute_fingerprint", return_value="fp-inbox"))
    stack.enter_context(patch("orchestrator.fingerprint_exists", return_value=False))
    stack.enter_context(patch("orchestrator.score_listing", return_value=(0.9, [])))
    stack.enter_context(patch("orchestrator.insert_raw_listing", return_value=({"id": "row-1"}, True)))


# ---------------------------------------------------------------------------
# AC-1 / AC-2: webhook -> kuyruğa yazma, 200 / 503
# ---------------------------------------------------------------------------


def test_valid_message_is_enqueued_and_returns_200(server_port, inbox, caplog):
    caplog.set_level(logging.INFO)
    status, _body = _post(server_port, _payload(1))

    assert status == 200
    assert inbox.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert "queue_enqueued" in caplog.text
    assert RAW_TEXT not in caplog.text, "mesaj metni loglanmamalı"


def test_same_id_twice_returns_200_and_keeps_single_row(server_port, inbox):
    assert _post(server_port, _payload(1))[0] == 200
    status, _body = _post(server_port, _payload(1))

    assert status == 200
    assert inbox.counts() == {"pending": 1, "processing": 0, "failed": 0}


def test_enqueue_failure_returns_503_queue_unavailable(server_port, inbox, caplog):
    caplog.set_level(logging.DEBUG)
    with patch.object(inbox, "enqueue", side_effect=OSError("disk-detay-GIZLI")):
        status, body = _post(server_port, _payload(2))

    assert status == 503
    assert json.loads(body) == {"error": "queue_unavailable"}
    assert inbox.counts() == EMPTY
    assert RAW_TEXT not in caplog.text
    assert "disk-detay-GIZLI" not in caplog.text, "yazma hatası metni loglanmamalı"


# ---------------------------------------------------------------------------
# process_entry: sonuç -> kuyruk işlemi (AC-4, AC-5)
# ---------------------------------------------------------------------------


def test_process_entry_success_deletes_row(inbox):
    inbox.enqueue(_payload(3), time.time())
    row_id, payload = _claim_one(inbox)

    with patch("orchestrator.handle_message", return_value=None) as handle:
        orchestrator.process_entry(row_id, payload)

    handle.assert_called_once_with(payload)
    assert inbox.counts() == EMPTY


def test_gemini_unavailable_first_attempt_keeps_row_pending_with_60s_backoff(inbox, caplog):
    caplog.set_level(logging.INFO)
    inbox.enqueue(_payload(4), time.time())
    row_id, payload = _claim_one(inbox)
    before = time.time()

    with patch("orchestrator.handle_message", side_effect=GeminiUnavailable()):
        orchestrator.process_entry(row_id, payload)

    assert inbox.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert inbox.claim_due(10, before + 59) == [], "ilk geri alma 60 sn beklemeli"
    assert len(inbox.claim_due(10, before + 65)) == 1
    assert "queue_retry attempts=1" in caplog.text
    assert RAW_TEXT not in caplog.text


def test_fifth_gemini_unavailable_marks_failed_and_logs_queue_failed(inbox, caplog):
    caplog.set_level(logging.INFO)
    inbox.enqueue(_payload(5), time.time())

    with patch("orchestrator.handle_message", side_effect=GeminiUnavailable()):
        for _ in range(5):
            row_id, payload = _claim_one(inbox)
            orchestrator.process_entry(row_id, payload)

    assert inbox.counts() == {"pending": 0, "processing": 0, "failed": 1}
    assert "queue_failed" in caplog.text
    assert RAW_TEXT not in caplog.text


def test_unexpected_error_keeps_row_and_schedules_retry_without_raising(inbox):
    inbox.enqueue(_payload(6), time.time())
    row_id, payload = _claim_one(inbox)
    before = time.time()

    with patch("orchestrator.handle_message", side_effect=RuntimeError("beklenmeyen")):
        orchestrator.process_entry(row_id, payload)  # worker düşmemeli

    assert inbox.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert inbox.claim_due(10, before + 59) == [], "sessiz kayıp yok, retry gibi ele alınır"


# ---------------------------------------------------------------------------
# GeminiUnavailable yayılımı: handle_message yutmaz (AC-6, AC-S4 kişisel yol)
# ---------------------------------------------------------------------------


def test_personal_gemini_unavailable_propagates_and_is_not_counted_as_parse_error():
    payload = _payload(7, agentId=AGENT_A)
    parse = AsyncMock(side_effect=GeminiUnavailable())
    with ExitStack() as stack:
        stack.enter_context(patch("orchestrator.get_client", return_value=MagicMock()))
        stack.enter_context(patch("orchestrator.get_default_manager", return_value=MagicMock()))
        stack.enter_context(patch("orchestrator.is_group_selected", return_value=True))
        stack.enter_context(patch("orchestrator.parse_listing_message", new=parse))
        bump = stack.enter_context(patch("orchestrator.bump_sidecar_counter"))

        with pytest.raises(GeminiUnavailable):
            orchestrator.handle_message(payload)

    counted = [call.args[1] for call in bump.call_args_list]
    assert "personal_parse_error" not in counted, "geçici ulaşılamama parse hatası sayılmamalı"


def test_common_path_gemini_unavailable_propagates_out_of_handle_message():
    parse = AsyncMock(side_effect=GeminiUnavailable())
    with ExitStack() as stack:
        _enter_common_pipeline(stack, parse)
        with pytest.raises(GeminiUnavailable):
            orchestrator.handle_message(_payload(8))


# ---------------------------------------------------------------------------
# dispatch_due (AC-3)
# ---------------------------------------------------------------------------


def test_dispatch_due_submits_only_rows_whose_time_has_come(inbox):
    now = time.time()
    due = _payload(9)
    later = _payload(10)
    inbox.enqueue(due, now - 10)
    inbox.enqueue(later, now + 1000)
    executor = MagicMock(name="executor")

    dispatched = orchestrator.dispatch_due(executor, now)

    assert dispatched == 1
    assert executor.submit.call_count == 1
    fn, row_id, payload = executor.submit.call_args.args
    assert fn is orchestrator.process_entry
    assert isinstance(row_id, int)
    assert payload == due
    assert inbox.counts() == {"pending": 1, "processing": 1, "failed": 0}


def test_dispatch_due_takes_at_most_max_workers(inbox):
    now = time.time()
    for i in range(orchestrator.MAX_WORKERS + 3):
        inbox.enqueue(_payload(100 + i), now - 1)
    executor = MagicMock(name="executor")

    assert orchestrator.dispatch_due(executor, now) == orchestrator.MAX_WORKERS
    assert executor.submit.call_count == orchestrator.MAX_WORKERS


def test_dispatch_due_with_empty_queue_submits_nothing(inbox):
    executor = MagicMock(name="executor")

    assert orchestrator.dispatch_due(executor, time.time()) == 0
    executor.submit.assert_not_called()


# ---------------------------------------------------------------------------
# run(): kurtarma HTTP sunucusundan ÖNCE (AC-7)
# ---------------------------------------------------------------------------


def test_run_recovers_processing_rows_before_http_server_starts(monkeypatch, inbox):
    monkeypatch.setenv("BAILEYS_WEBHOOK_PORT", "0")
    monkeypatch.delenv("BAILEYS_WEBHOOK_HOST", raising=False)
    calls = []

    def fake_recover():
        calls.append("recover")
        return 0

    fake_server = MagicMock(name="server")

    def serve_forever():
        calls.append("serve")
        raise KeyboardInterrupt()

    fake_server.serve_forever.side_effect = serve_forever

    def fake_http_server(*_args, **_kwargs):
        calls.append("bind")
        return fake_server

    monkeypatch.setattr(inbox, "recover_processing", fake_recover)
    monkeypatch.setattr(orchestrator, "_background_worker_loop", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator, "_parse_cache_purge_loop", lambda *a, **k: None)
    with patch("orchestrator.HTTPServer", side_effect=fake_http_server):
        with pytest.raises(KeyboardInterrupt):
            orchestrator.run()

    assert calls == ["bind", "recover", "serve"]


def test_run_does_not_recover_when_bind_fails(monkeypatch, inbox):
    """Red-team AC-13: port dolu (ikinci süreç) -> kurtarma yapılmadan çıkılır."""
    monkeypatch.setenv("BAILEYS_WEBHOOK_PORT", "0")
    monkeypatch.delenv("BAILEYS_WEBHOOK_HOST", raising=False)
    calls = []
    monkeypatch.setattr(inbox, "recover_processing", lambda: calls.append("recover") or 0)
    monkeypatch.setattr(orchestrator, "_background_worker_loop", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator, "_parse_cache_purge_loop", lambda *a, **k: None)
    with patch("orchestrator.HTTPServer", side_effect=OSError("port in use")):
        with pytest.raises((OSError, SystemExit)):
            orchestrator.run()
    assert "recover" not in calls
