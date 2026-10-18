# -*- coding: utf-8 -*-
"""scraper/orchestrator.py webhook auth testleri (ATDD EML-20, AC-1..AC-9).

Katmanlar:
  - Unit (mock'lu, network yok): hmac.compare_digest çağrısı, fail-closed
    yapılandırma (run() HTTPServer'a hiç ulaşmadan çıkmalı), bind adresi.
  - "integration" (bu dosyada network-içi anlamda): rastgele/sıfır portta
    gerçek http.server.HTTPServer açıp gerçek TCP isteğiyle 200/401/404/400
    davranışını ve auth/JSON-parse sıralamasını doğrulama. Supabase/Gemini
    gibi gerçek bir dış servise ihtiyaç YOK, bu yüzden @pytest.mark.integration
    ile İŞARETLENMEZ (conftest.py'nin varsayılan atlaması bu testlere uygulanmaz).

Not: auth henüz implemente edilmedi (scraper/orchestrator.py, scraper/sidecar/
bridge.js değişmedi). Bu testlerin BAŞARISIZ (red) olması BEKLENİR.
"""

import hmac
import http.client
import json
import threading
import time
from http.server import HTTPServer
from unittest.mock import MagicMock, patch

import pytest

import orchestrator

SECRET = "test-secret-abcdefghijklmnop-1234567890"
WRONG_SECRET = "wrong-secret-abcdefghijklmnop-0000000000"


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------

class _RunningServer:
    def __init__(self, server, thread):
        self.server = server
        self.thread = thread
        self.port = server.server_address[1]

    def post(self, path="/baileys-webhook", body=b"{}", token=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            hdrs = dict(headers or {})
            if token is not None:
                hdrs["Authorization"] = f"Bearer {token}"
            conn.request("POST", path, body=body, headers=hdrs)
            resp = conn.getresponse()
            resp_body = resp.read()
            return resp.status, resp_body, dict(resp.getheaders())
        finally:
            conn.close()

    def shutdown(self):
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()


@pytest.fixture
def running_server(monkeypatch):
    """BAILEYS_WEBHOOK_SECRET set edilmiş, rastgele portta gerçek HTTPServer.

    message_queue ve _active_ids her testte temiz bir duruma sıfırlanır.
    """
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    monkeypatch.delenv("BAILEYS_WEBHOOK_HOST", raising=False)

    import queue as queue_module

    monkeypatch.setattr(orchestrator, "message_queue", queue_module.Queue())
    monkeypatch.setattr(orchestrator, "_active_ids", set())

    server = HTTPServer(("127.0.0.1", 0), orchestrator.WebhookHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    rs = _RunningServer(server, thread)
    yield rs
    rs.shutdown()


# ---------------------------------------------------------------------------
# AC-1: happy path
# ---------------------------------------------------------------------------

def test_ac1_valid_token_and_valid_json_returns_200_and_queues_payload(running_server):
    status, body, _headers = running_server.post(
        body=json.dumps({"id": "msg-1", "text": "merhaba"}).encode("utf-8"),
        token=SECRET,
    )
    assert status == 200
    assert orchestrator.message_queue.qsize() == 1


# ---------------------------------------------------------------------------
# AC-S1: eksik / yanlış token -> 401, aynı body, oracle yok
# ---------------------------------------------------------------------------

def test_ac_s1_missing_authorization_header_returns_401(running_server):
    status, body, headers = running_server.post(
        body=json.dumps({"id": "msg-2", "text": "merhaba"}).encode("utf-8"),
        token=None,
    )
    assert status == 401
    assert json.loads(body) == {"error": "unauthorized"}
    assert headers.get("WWW-Authenticate") == "Bearer"
    assert orchestrator.message_queue.qsize() == 0


def test_ac_s1_wrong_token_returns_401(running_server):
    status, body, headers = running_server.post(
        body=json.dumps({"id": "msg-3", "text": "merhaba"}).encode("utf-8"),
        token=WRONG_SECRET,
    )
    assert status == 401
    assert json.loads(body) == {"error": "unauthorized"}
    assert headers.get("WWW-Authenticate") == "Bearer"
    assert orchestrator.message_queue.qsize() == 0


def test_ac_s1_missing_and_wrong_token_give_identical_status_and_body(running_server):
    """Eksik token ile yanlış token arasında ayrım yapılmaz (oracle verilmez)."""
    status_missing, body_missing, _ = running_server.post(
        body=json.dumps({"id": "msg-4a"}).encode("utf-8"),
        token=None,
    )
    status_wrong, body_wrong, _ = running_server.post(
        body=json.dumps({"id": "msg-4b"}).encode("utf-8"),
        token=WRONG_SECRET,
    )
    assert status_missing == status_wrong == 401
    assert json.loads(body_missing) == json.loads(body_wrong) == {"error": "unauthorized"}


# ---------------------------------------------------------------------------
# AC-S2: hmac.compare_digest ile sabit zamanlı karşılaştırma
# ---------------------------------------------------------------------------

def test_ac_s2_token_comparison_uses_hmac_compare_digest(running_server):
    with patch("orchestrator.hmac.compare_digest", wraps=hmac.compare_digest) as mocked:
        status, _body, _headers = running_server.post(
            body=json.dumps({"id": "msg-5"}).encode("utf-8"),
            token=SECRET,
        )
    assert status == 200
    assert mocked.called


def test_ac_s2_timing_does_not_leak_correct_vs_incorrect_token(running_server):
    """Aynı uzunlukta doğru ve yanlış token ile çalıştırma süresi arasında
    büyük bir sapma olmamalı (kaba bir timing-leak koruması kontrolü)."""
    same_length_wrong = "x" * len(SECRET)

    def timed_runs(token, n=25):
        durations = []
        for i in range(n):
            start = time.perf_counter()
            running_server.post(
                body=json.dumps({"id": f"timing-{token[:3]}-{i}"}).encode("utf-8"),
                token=token,
            )
            durations.append(time.perf_counter() - start)
        durations.sort()
        return durations[len(durations) // 2]

    correct_median = timed_runs(SECRET)
    wrong_median = timed_runs(same_length_wrong)

    slower = max(correct_median, wrong_median)
    faster = min(correct_median, wrong_median)
    assert faster > 0
    assert slower / faster < 5


# ---------------------------------------------------------------------------
# AC-S3/S4: auth kontrolü JSON parse'tan önce çalışır
# ---------------------------------------------------------------------------

def test_ac_s3_s4_invalid_json_with_missing_token_returns_401_not_400(running_server):
    status, body, _headers = running_server.post(
        body=b"{not-valid-json",
        token=None,
    )
    assert status == 401
    assert json.loads(body) == {"error": "unauthorized"}


def test_ac_s3_s4_invalid_json_with_wrong_token_returns_401_not_400(running_server):
    status, body, _headers = running_server.post(
        body=b"{not-valid-json",
        token=WRONG_SECRET,
    )
    assert status == 401
    assert json.loads(body) == {"error": "unauthorized"}


# ---------------------------------------------------------------------------
# AC-8: path kontrolü auth'tan önce kalır
# ---------------------------------------------------------------------------

def test_ac8_wrong_path_returns_404_regardless_of_auth(running_server):
    status_no_auth, _body, _h = running_server.post(path="/not-the-webhook", token=None)
    status_with_auth, _body2, _h2 = running_server.post(path="/not-the-webhook", token=SECRET)
    assert status_no_auth == 404
    assert status_with_auth == 404


# ---------------------------------------------------------------------------
# AC-9: geçerli token + geçersiz JSON -> 400 (auth'tan sonraki mevcut davranış)
# ---------------------------------------------------------------------------

def test_ac9_valid_token_with_invalid_json_returns_400(running_server):
    status, _body, _headers = running_server.post(
        body=b"{not-valid-json",
        token=SECRET,
    )
    assert status == 400


# ---------------------------------------------------------------------------
# AC-S5: BAILEYS_WEBHOOK_SECRET set edilmemiş/boş -> run() fail-closed
# ---------------------------------------------------------------------------

def test_ac_s5_run_without_secret_env_exits_before_starting_server(monkeypatch):
    monkeypatch.delenv("BAILEYS_WEBHOOK_SECRET", raising=False)
    with patch("orchestrator.HTTPServer") as mocked_http_server:
        with pytest.raises(SystemExit) as exc_info:
            orchestrator.run()
    assert exc_info.value.code != 0
    mocked_http_server.assert_not_called()


def test_ac_s5_run_with_empty_secret_env_exits_before_starting_server(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", "")
    with patch("orchestrator.HTTPServer") as mocked_http_server:
        with pytest.raises(SystemExit) as exc_info:
            orchestrator.run()
    assert exc_info.value.code != 0
    mocked_http_server.assert_not_called()


# ---------------------------------------------------------------------------
# AC-7: BAILEYS_WEBHOOK_HOST set edilmemişse bind adresi 127.0.0.1
# ---------------------------------------------------------------------------

def test_ac7_default_bind_host_is_127_0_0_1(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    monkeypatch.delenv("BAILEYS_WEBHOOK_HOST", raising=False)
    monkeypatch.setenv("BAILEYS_WEBHOOK_PORT", "0")

    fake_server_instance = MagicMock()
    fake_server_instance.serve_forever.side_effect = KeyboardInterrupt()

    with patch("orchestrator.HTTPServer", return_value=fake_server_instance) as mocked_http_server:
        with pytest.raises(KeyboardInterrupt):
            orchestrator.run()

    assert mocked_http_server.call_args[0][0] == ("127.0.0.1", 0)


def test_ac7_custom_bind_host_is_used_when_env_set(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", SECRET)
    monkeypatch.setenv("BAILEYS_WEBHOOK_HOST", "0.0.0.0")
    monkeypatch.setenv("BAILEYS_WEBHOOK_PORT", "0")

    fake_server_instance = MagicMock()
    fake_server_instance.serve_forever.side_effect = KeyboardInterrupt()

    with patch("orchestrator.HTTPServer", return_value=fake_server_instance) as mocked_http_server:
        with pytest.raises(KeyboardInterrupt):
            orchestrator.run()

    assert mocked_http_server.call_args[0][0] == ("0.0.0.0", 0)
