# -*- coding: utf-8 -*-
"""scraper/orchestrator.py: işlem-içi (in-flight) dedup anahtarı ve canlı yolda parse sonrası istisna.

- _active_ids anahtarı (agentId or "", mesaj id): ortak hesap ve kişisel oturum (ya da aynı gruptaki
  iki emlakçı) aynı WhatsApp mesaj id'sini alabilir; biri işlenirken diğeri düşürülmemeli.
- Boş/yalnız boşluk/string olmayan metin ve dict olmayan gövde anahtar sızdırmaz, 500 üretmez.
- Canlı yolda parse SONRASI beklenmeyen istisna mesajı kaybetmez: reason=process_error ile bekletilir.
  Replay bekletmez (drain zaten erteler). Loglar içeriksizdir (yalnız hata tipi).

Gerçek ağ yok: Supabase yardımcıları ve parse orchestrator modülünde patch'lenir.
"""

import io
import json
import logging
import queue as queue_module
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import orchestrator
from orchestrator import WebhookHandler
from parser import ParseOutcome

SECRET = "test-secret-inflight-abcdefghijklmnop-12345"
AGENT_A = "11111111-2222-4333-8444-555555555555"
AGENT_B = "22222222-3333-4444-8555-666666666666"
GROUP_JID = "120363000000000001@g.us"
RAW_TEXT = "INFLIGHT-TEST-METNI 3+1 Kadıköy 5321234512"
PARSED = {"city": "İstanbul", "district": "Kadıköy", "rooms": "3+1", "price": 1000000, "area_m2": 100}
LISTING = ParseOutcome("listing", PARSED, None)


def _payload(agent=None, **overrides):
    base = {"id": "msg-inflight-1", "text": RAW_TEXT, "group": GROUP_JID, "groupName": "Kadıköy Emlak"}
    if agent:
        base["agentId"] = agent
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    for name in ("PARSE_MAX_ATTEMPTS", "PARSE_RETRY_BASE_SECONDS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(orchestrator, "message_queue", queue_module.Queue())
    monkeypatch.setattr(orchestrator, "_active_ids", set())


# ---------------------------------------------------------------------------
# Anahtar yardımcısı
# ---------------------------------------------------------------------------


def test_active_key_includes_agent_id():
    assert orchestrator._active_key({"id": "m1"}) == ("", "m1")
    assert orchestrator._active_key({"id": "m1", "agentId": None}) == ("", "m1")
    assert orchestrator._active_key({"id": "m1", "agentId": AGENT_A}) == (AGENT_A, "m1")
    assert orchestrator._active_key({"id": 42, "agentId": AGENT_A}) == (AGENT_A, "42")


@pytest.mark.parametrize("payload", [{}, {"id": ""}, {"id": None, "agentId": AGENT_A}, [], "x", None])
def test_active_key_is_none_without_id_or_dict(payload):
    assert orchestrator._active_key(payload) is None


# ---------------------------------------------------------------------------
# do_POST
# ---------------------------------------------------------------------------


def _make_handler(body: bytes, client_address=("127.0.0.1", 51234)):
    handler = WebhookHandler.__new__(WebhookHandler)
    handler.command = "POST"
    handler.path = "/baileys-webhook"
    handler.request_version = "HTTP/1.1"
    handler.requestline = "POST /baileys-webhook HTTP/1.1"
    handler.headers = {"Authorization": f"Bearer {SECRET}", "Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    handler.wfile = io.BytesIO()
    handler.client_address = client_address
    handler.close_connection = True
    handler.server = MagicMock(name="server")
    return handler


def _post(payload) -> WebhookHandler:
    handler = _make_handler(json.dumps(payload).encode("utf-8"))
    handler.do_POST()
    return handler


def _status(handler) -> int:
    return int(handler.wfile.getvalue().split(b"\r\n", 1)[0].decode("ascii").split(" ")[1])


def _body(handler) -> bytes:
    return handler.wfile.getvalue().split(b"\r\n\r\n", 1)[1]


def test_same_message_id_for_different_agents_is_queued_for_each():
    shared = _post(_payload())
    personal_a = _post(_payload(agent=AGENT_A))
    personal_b = _post(_payload(agent=AGENT_B))
    assert [_status(h) for h in (shared, personal_a, personal_b)] == [200, 200, 200]
    assert orchestrator.message_queue.qsize() == 3
    assert orchestrator._active_ids == {
        ("", "msg-inflight-1"),
        (AGENT_A, "msg-inflight-1"),
        (AGENT_B, "msg-inflight-1"),
    }


def test_same_message_id_same_agent_is_still_deduped_while_in_flight():
    _post(_payload(agent=AGENT_A))
    second = _post(_payload(agent=AGENT_A))
    _post(_payload())
    again_shared = _post(_payload())
    assert _status(second) == 200 and _status(again_shared) == 200
    assert orchestrator.message_queue.qsize() == 2


@pytest.mark.parametrize("text", ["", "   ", "\n\t ", 123, ["x"], {"a": 1}, True, None])
def test_blank_or_non_string_text_is_acknowledged_not_queued_and_no_id_registered(text):
    handler = _post(_payload(text=text))
    assert _status(handler) == 200
    assert json.loads(_body(handler)) == {}
    assert orchestrator.message_queue.qsize() == 0
    assert orchestrator._active_ids == set()


@pytest.mark.parametrize("body", [b"[]", b'[{"id": "m", "text": "x"}]', b'"metin"', b"42", b"null", b"true"])
def test_non_object_json_body_returns_400_and_is_not_queued(body):
    handler = _make_handler(body)
    handler.do_POST()
    assert _status(handler) == 400
    assert json.loads(_body(handler)) == {"error": "invalid_body"}
    assert orchestrator.message_queue.qsize() == 0
    assert orchestrator._active_ids == set()


# ---------------------------------------------------------------------------
# handle_message: anahtar her dönüş yolunda bırakılır
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("text", ["   ", "", 123, ["x"], None])
def test_handle_message_releases_key_for_blank_or_non_string_text(text):
    payload = _payload(agent=AGENT_A, text=text)
    orchestrator._active_ids.add(orchestrator._active_key(payload))
    with patch("orchestrator._process_message") as process:
        assert orchestrator.handle_message(payload) is None
    process.assert_not_called()
    assert orchestrator._active_ids == set()


@pytest.mark.parametrize("payload", [[], "x", None, 5])
def test_handle_message_non_dict_payload_does_not_raise(payload):
    with patch("orchestrator._process_message") as process:
        assert orchestrator.handle_message(payload) is None
    process.assert_not_called()


def test_handle_message_releases_only_its_own_agent_key():
    shared = _payload()
    personal = _payload(agent=AGENT_A)
    orchestrator._active_ids.update({orchestrator._active_key(shared), orchestrator._active_key(personal)})
    with patch("orchestrator._process_message", return_value=None):
        orchestrator.handle_message(personal)
    assert orchestrator._active_ids == {("", "msg-inflight-1")}


def test_replay_is_not_busy_when_only_other_agent_copy_is_active():
    orchestrator._active_ids.add(("", "msg-inflight-1"))
    with patch("orchestrator._process_message", return_value=None) as process:
        assert orchestrator._replay_message(_payload(agent=AGENT_A)) == orchestrator.DISPOSITION_DONE
    process.assert_called_once()
    assert orchestrator._active_ids == {("", "msg-inflight-1")}


def test_replay_is_busy_when_same_agent_copy_is_active():
    orchestrator._active_ids.add((AGENT_A, "msg-inflight-1"))
    with patch("orchestrator._process_message") as process:
        assert orchestrator._replay_message(_payload(agent=AGENT_A)) == orchestrator.DISPOSITION_BUSY
    process.assert_not_called()
    assert orchestrator._active_ids == {(AGENT_A, "msg-inflight-1")}


# ---------------------------------------------------------------------------
# Canlı yolda parse sonrası istisna -> process_error ile bekletilir
# ---------------------------------------------------------------------------


class _Harness:
    def __init__(self):
        self.client = MagicMock(name="client")
        self.parse = AsyncMock(name="parse_listing_outcome", return_value=LISTING)
        self.park = MagicMock(name="park_raw_message", return_value=True)
        self.insert = MagicMock(name="insert_raw_listing", return_value=({"id": "row-1"}, True))
        self.ingest = MagicMock(name="ingest_personal_listing", return_value="approved")
        self.exists = MagicMock(name="fingerprint_exists", return_value=False)
        self.score = MagicMock(name="score_listing", return_value=(0.9, []))
        self.fingerprint = MagicMock(name="compute_fingerprint", return_value="fp-inflight")
        self.get_client = MagicMock(name="get_client", return_value=self.client)
        self._patches = [
            patch("orchestrator.get_client", new=self.get_client),
            patch("orchestrator.get_default_manager", return_value=MagicMock()),
            patch("orchestrator.parse_listing_outcome", new=self.parse),
            patch("orchestrator.is_group_selected", return_value=True),
            patch("orchestrator.compute_fingerprint", new=self.fingerprint),
            patch("orchestrator.fingerprint_exists", new=self.exists),
            patch("orchestrator.score_listing", new=self.score),
            patch("orchestrator.insert_raw_listing", new=self.insert),
            patch("orchestrator.ingest_personal_listing", new=self.ingest),
            patch("orchestrator.park_raw_message", new=self.park),
            patch("orchestrator.delete_pending"),
            patch("orchestrator.reschedule_pending"),
            patch("orchestrator._sleep"),
            patch("orchestrator._jitter", return_value=0.0),
        ]

    def __enter__(self):
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in reversed(self._patches):
            p.stop()
        return False

    def bumps(self):
        return [
            c.args[1]["p_key"]
            for c in self.client.rpc.call_args_list
            if c.args and c.args[0] == "bump_sidecar_counter"
        ]


@pytest.mark.parametrize("failing", ["exists", "insert", "score", "fingerprint"])
def test_shared_post_parse_exception_parks_with_process_error(failing, caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload(text=f"  {RAW_TEXT}\n")
    orchestrator._active_ids.add(orchestrator._active_key(payload))
    with _Harness() as h:
        getattr(h, failing).side_effect = TypeError(f"boom {RAW_TEXT}")
        assert orchestrator.handle_message(payload) is None
        h.park.assert_called_once_with(
            h.client,
            message_id="msg-inflight-1",
            agent_id=None,
            group=GROUP_JID,
            group_name="Kadıköy Emlak",
            text=RAW_TEXT,
            reason="process_error",
        )
        assert h.bumps() == [], "process_error parse hatası sayacını artırmamalı"
    assert orchestrator._active_ids == set()
    assert "process_failed type=TypeError message_id=msg-inflight-1" in caplog.text
    assert RAW_TEXT not in caplog.text
    assert "boom" not in caplog.text


def test_personal_post_parse_exception_parks_with_agent_and_process_error(caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload(agent=AGENT_A)
    with _Harness() as h:
        h.score.side_effect = TypeError(f"boom {RAW_TEXT}")
        assert orchestrator.handle_message(payload) is None
        assert h.park.call_count == 1
        assert h.park.call_args.kwargs["agent_id"] == AGENT_A
        assert h.park.call_args.kwargs["reason"] == "process_error"
    assert RAW_TEXT not in caplog.text


def test_process_error_reason_satisfies_db_check():
    import re

    assert re.fullmatch(r"[a-z_]{1,40}", orchestrator.PROCESS_ERROR_REASON)
    assert orchestrator.PROCESS_ERROR_REASON == "process_error"


def test_process_error_park_failure_does_not_crash_and_releases_key(caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload()
    orchestrator._active_ids.add(orchestrator._active_key(payload))
    with _Harness() as h:
        h.exists.side_effect = RuntimeError("db")
        h.park.side_effect = RuntimeError(f"park down {RAW_TEXT}")
        assert orchestrator.handle_message(payload) is None
        assert h.park.call_count == 1
    assert orchestrator._active_ids == set()
    assert "pending_park_failed type=RuntimeError message_id=msg-inflight-1" in caplog.text
    assert RAW_TEXT not in caplog.text


def test_client_unavailable_does_not_crash_and_releases_key(caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload()
    orchestrator._active_ids.add(orchestrator._active_key(payload))
    with _Harness() as h:
        h.get_client.side_effect = RuntimeError(f"env {RAW_TEXT}")
        assert orchestrator.handle_message(payload) is None
        h.park.assert_not_called()
    assert orchestrator._active_ids == set()
    assert "pending_park_failed type=RuntimeError" in caplog.text
    assert RAW_TEXT not in caplog.text


def test_parse_error_is_parked_once_not_double_parked():
    with _Harness() as h:
        h.parse.return_value = ParseOutcome("error", None, "schema_invalid")
        orchestrator.handle_message(_payload())
        assert h.park.call_count == 1
        assert h.park.call_args.kwargs["reason"] == "schema_invalid"


def test_success_is_not_parked():
    with _Harness() as h:
        orchestrator.handle_message(_payload())
        h.park.assert_not_called()
        assert h.insert.call_count == 1


def test_replay_exception_is_retried_and_not_parked():
    with _Harness() as h:
        h.exists.side_effect = RuntimeError("db")
        assert orchestrator._replay_message(_payload()) == orchestrator.DISPOSITION_RETRY
        h.park.assert_not_called()
    assert orchestrator._active_ids == set()


def test_raw_text_is_passed_to_fingerprint_on_both_paths():
    with _Harness() as h:
        orchestrator.handle_message(_payload(text=f" {RAW_TEXT} "))
        orchestrator.handle_message(_payload(agent=AGENT_A, id="msg-inflight-2"))
        assert [c.kwargs.get("raw_text") for c in h.fingerprint.call_args_list] == [RAW_TEXT, RAW_TEXT]
