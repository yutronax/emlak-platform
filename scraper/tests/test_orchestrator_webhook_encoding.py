# -*- coding: utf-8 -*-
"""scraper/orchestrator.py WebhookHandler.do_POST encoding/eksik-alan testleri
(ATDD EML-66, AC-1/AC-2, Davranış Sözleşmesi #1 ve #2).

Yöntem: test_webhook_auth.py ile aynı desen — rastgele portta gerçek
http.server.HTTPServer + http.client ile gerçek TCP isteği. Böylece handler
exception fırlatırsa bağlantı gerçekten kopar/500 döner ve test kırmızı kalır
(mock'lu rfile/wfile ile bu davranış taklit edilemez).

Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — orchestrator.py do_POST
henüz json.loads'u UnicodeDecodeError için korumuyor ve geçerli-JSON-ama-text-yok
payload'ını da kuyruğa koyuyor (Davranış Sözleşmesi #2: kuyruğa EKLENMEZ).
"""

import http.client
import json
import queue as queue_module
import threading
from http.server import HTTPServer

import pytest

import orchestrator

SECRET = "test-secret-encoding-abcdefghijklmnop-987654"


class _RunningServer:
    def __init__(self, server, thread):
        self.server = server
        self.thread = thread
        self.port = server.server_address[1]

    def post_raw(self, body, token=SECRET, path="/baileys-webhook"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            headers = {"Content-Length": str(len(body))}
            if token is not None:
                headers["Authorization"] = f"Bearer {token}"
            conn.request("POST", path, body=body, headers=headers)
            resp = conn.getresponse()
            resp_body = resp.read()
            return resp.status, resp_body
        finally:
            conn.close()

    def shutdown(self):
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()


@pytest.fixture
def running_server(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    monkeypatch.delenv("BAILEYS_WEBHOOK_HOST", raising=False)

    monkeypatch.setattr(orchestrator, "message_queue", queue_module.Queue())
    monkeypatch.setattr(orchestrator, "_active_ids", set())

    server = HTTPServer(("127.0.0.1", 0), orchestrator.WebhookHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    rs = _RunningServer(server, thread)
    yield rs
    rs.shutdown()


# ---------------------------------------------------------------------------
# AC-1 [Critical]: geçerli token + bozuk/geçersiz-UTF8 body -> 400
#                  {"error": "invalid_body"}, handler çökmez
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "broken_body",
    [
        b'\xff\xfe{"text":"x"}',          # ilk bayt geçersiz UTF-8 / BOM benzeri (Faz A'da canlı görülen)
        b'{"id":"msg-bad","text":"\xff"}',  # gövde içinde geçersiz UTF-8 baytı
    ],
    ids=["leading_invalid_bytes", "invalid_utf8_inside_string"],
)
def test_ac1_broken_utf8_body_returns_400_with_invalid_body_error(running_server, broken_body):
    status, body = running_server.post_raw(broken_body, token=SECRET)

    assert status == 400
    assert json.loads(body) == {"error": "invalid_body"}


def test_ac1_broken_utf8_body_does_not_crash_server_and_next_request_still_works(running_server):
    """Handler çökseydi sonraki istek bağlantı hatası verirdi; sunucunun ayakta
    kaldığını ve sonraki geçerli isteğe 200 döndüğünü doğrular."""
    running_server.post_raw(b'\xff\xfe{"text":"x"}', token=SECRET)

    status, _body = running_server.post_raw(
        json.dumps({"id": "msg-after-bad", "text": "merhaba"}).encode("utf-8"),
        token=SECRET,
    )
    assert status == 200


def test_ac1_broken_utf8_body_is_not_enqueued(running_server):
    running_server.post_raw(b'\xff\xfe{"text":"x"}', token=SECRET)

    assert orchestrator.message_queue.qsize() == 0


# ---------------------------------------------------------------------------
# AC-2 [Critical]: geçerli JSON ama `text` alanı yok -> 200 {}, kuyruğa EKLENMEZ
# ---------------------------------------------------------------------------

def test_ac2_valid_json_without_text_returns_200_with_empty_object(running_server):
    status, body = running_server.post_raw(
        json.dumps({"id": "msg-no-text"}).encode("utf-8"),
        token=SECRET,
    )

    assert status == 200
    assert json.loads(body) == {}


def test_ac2_valid_json_without_text_is_not_enqueued(running_server):
    running_server.post_raw(
        json.dumps({"id": "msg-no-text-2", "group": "120363xxx@g.us"}).encode("utf-8"),
        token=SECRET,
    )

    assert orchestrator.message_queue.qsize() == 0


def test_ac2_valid_json_with_empty_text_is_not_enqueued(running_server):
    running_server.post_raw(
        json.dumps({"id": "msg-empty-text", "text": ""}).encode("utf-8"),
        token=SECRET,
    )

    assert orchestrator.message_queue.qsize() == 0
