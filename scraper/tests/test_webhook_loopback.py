# -*- coding: utf-8 -*-
"""Kişisel webhook yolu (payload.agentId) yalnız loopback'ten kabul edilir (red-team tur 3).

Kurallar:
  - agentId var + client_address loopback DEĞİL -> 403, hiçbir işlem (kuyruğa alınmaz,
    handle_message çağrılmaz), içeriksiz log.
  - agentId var + loopback (127.0.0.1 / ::1) -> kabul (200, kuyruğa alınır).
  - agentId yok (ortak yol) -> client adresinden bağımsız eski davranış (200, kuyruğa alınır).

Loopback dışı istemci gerçek soketle üretilemediği için handler, client_address elle verilerek
kurulur (BaseHTTPRequestHandler.__init__ atlanır; yalnız do_POST'un kullandığı alanlar set edilir).
"""

import io
import json
import queue as queue_module
from http.server import HTTPServer
from unittest.mock import MagicMock, patch

import pytest

import orchestrator
from orchestrator import WebhookHandler

SECRET = "test-secret-abcdefghijklmnop-1234567890"
AGENT_A = "11111111-2222-4333-8444-555555555555"
RAW_TEXT = "LOOPBACK-TEST-ICERIK 3+1 Kadıköy"


@pytest.fixture(autouse=True)
def _clean_queue(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(orchestrator, "message_queue", queue_module.Queue())
    monkeypatch.setattr(orchestrator, "_active_ids", set())


def _make_handler(payload: dict, client_address, token=SECRET):
    body = json.dumps(payload).encode("utf-8")
    handler = WebhookHandler.__new__(WebhookHandler)
    handler.command = "POST"
    handler.path = "/baileys-webhook"
    handler.request_version = "HTTP/1.1"
    handler.requestline = "POST /baileys-webhook HTTP/1.1"
    handler.headers = {"Authorization": f"Bearer {token}", "Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    handler.wfile = io.BytesIO()
    handler.client_address = client_address
    handler.close_connection = True
    handler.server = MagicMock(name="server")
    return handler


def _personal_payload(**overrides):
    base = {"id": "msg-loop-1", "text": RAW_TEXT, "group": "120363000000000001@g.us", "agentId": AGENT_A}
    base.update(overrides)
    return base


def _response_status(handler) -> int:
    first_line = handler.wfile.getvalue().split(b"\r\n", 1)[0].decode("ascii")
    return int(first_line.split(" ")[1])


def _response_body(handler) -> bytes:
    return handler.wfile.getvalue().split(b"\r\n\r\n", 1)[1]


# ---------------------------------------------------------------------------
# Loopback dışı + agentId -> 403, hiçbir işlem yok
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("remote", ["10.0.0.5", "192.168.1.20", "203.0.113.7", "2001:db8::1"])
def test_personal_payload_from_non_loopback_is_forbidden_and_not_processed(remote):
    handler = _make_handler(_personal_payload(), (remote, 51234))
    with patch("orchestrator.handle_message") as handle, \
            patch.object(orchestrator.logger, "warning") as warn:
        handler.do_POST()

    assert _response_status(handler) == 403
    assert json.loads(_response_body(handler)) == {"error": "forbidden"}
    assert orchestrator.message_queue.qsize() == 0, "loopback dışı kişisel istek kuyruğa alınmamalı"
    assert orchestrator._active_ids == set(), "dedup kümesine dokunulmamalı"
    handle.assert_not_called()

    logged = " ".join(str(c) for c in warn.call_args_list)
    assert RAW_TEXT not in logged, "içerik loglanmamalı"
    assert remote not in logged, "istemci adresi loglanmamalı"


def test_forbidden_request_does_not_reach_worker_loop(monkeypatch):
    """Worker kuyruktan okuyup handle_message çağıran tek yol; 403 sonrası kuyruk boş kalmalı."""
    handler = _make_handler(_personal_payload(), ("10.0.0.5", 51234))
    with patch("orchestrator.handle_message") as handle:
        handler.do_POST()
    assert orchestrator.message_queue.empty()
    handle.assert_not_called()


# ---------------------------------------------------------------------------
# Loopback + agentId -> kabul
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("loopback", ["127.0.0.1", "::1"])
def test_personal_payload_from_loopback_is_accepted_and_queued(loopback):
    payload = _personal_payload()
    handler = _make_handler(payload, (loopback, 51234))
    handler.do_POST()

    assert _response_status(handler) == 200
    assert orchestrator.message_queue.qsize() == 1
    assert orchestrator.message_queue.get_nowait() == payload


# ---------------------------------------------------------------------------
# Ortak yol (agentId yok) -> adresten bağımsız değişmez
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("remote", ["127.0.0.1", "10.0.0.5"])
def test_common_path_without_agent_id_is_unchanged_for_any_client(remote):
    payload = {"id": "msg-common-1", "text": RAW_TEXT, "group": "120363000000000002@g.us"}
    handler = _make_handler(payload, (remote, 51234))
    handler.do_POST()

    assert _response_status(handler) == 200
    assert orchestrator.message_queue.qsize() == 1


# ---------------------------------------------------------------------------
# Gerçek soket: loopback + agentId -> 200 (uçtan uca, 127.0.0.1 üzerinde)
# ---------------------------------------------------------------------------

def test_real_loopback_socket_with_agent_id_returns_200(monkeypatch):
    import http.client
    import threading

    server = HTTPServer(("127.0.0.1", 0), WebhookHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
        body = json.dumps(_personal_payload(id="msg-real-1")).encode("utf-8")
        conn.request(
            "POST",
            "/baileys-webhook",
            body=body,
            headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
        )
        resp = conn.getresponse()
        resp.read()
        conn.close()
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()

    assert resp.status == 200
    assert orchestrator.message_queue.qsize() == 1
