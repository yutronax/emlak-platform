# -*- coding: utf-8 -*-
"""scraper/orchestrator.py: parse sonucu (listing / not_listing / error) ve geçici hatalarda
üstel geri çekilmeli yeniden deneme testleri.

- Geçici hatalar (rate_limit, timeout, network, provider_error, json_invalid) yeniden denenir.
- no_key (yapılandırma) ve schema_invalid denenmez; listing / not_listing hiç denenmez.
- Denemeler tükenince _on_parse_failed tam bir kez çağrılır; mesaj not_listing sayılmaz.
- Bekleme orchestrator._sleep üzerinden yapılır (testte patch'lenir, gerçek uyku yok).

Patch hedefi `orchestrator.parse_listing_outcome` (orchestrator bu adı import eder).
"""

import logging
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

import orchestrator
from parser import ParseOutcome

AGENT_A = "11111111-2222-4333-8444-555555555555"
GROUP_JID = "120363000000000001@g.us"
RAW_TEXT = "RETRY-TEST-METNI 3+1 Kadıköy 5321234512"
PARSED = {"ilce": "Kadıköy", "fiyat": 1000000}

LISTING = ParseOutcome("listing", PARSED, None)
NOT_LISTING = ParseOutcome("not_listing", None, None)


def _err(reason):
    return ParseOutcome("error", None, reason)


def _payload(agent=False, **overrides):
    base = {"id": "msg-retry-1", "text": RAW_TEXT, "group": GROUP_JID, "groupName": "Kadıköy Emlak"}
    if agent:
        base["agentId"] = AGENT_A
    base.update(overrides)
    return base


def _bump_calls(client):
    return [
        c.args[1]["p_key"]
        for c in client.rpc.call_args_list
        if c.args and c.args[0] == "bump_sidecar_counter"
    ]


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.delenv("PARSE_MAX_ATTEMPTS", raising=False)
    monkeypatch.delenv("PARSE_RETRY_BASE_SECONDS", raising=False)


class _Harness:
    def __init__(self, outcomes, *, wrap_failed=True):
        self.client = MagicMock(name="client")
        self.parse = AsyncMock(name="parse_listing_outcome")
        if isinstance(outcomes, (list, BaseException)):
            self.parse.side_effect = outcomes
        else:
            self.parse.return_value = outcomes
        self.sleep = MagicMock(name="sleep")
        self.insert = MagicMock(name="insert_raw_listing", return_value=({"id": "row-1"}, True))
        self.ingest = MagicMock(name="ingest_personal_listing", return_value="approved")
        self.failed = MagicMock(name="_on_parse_failed", wraps=orchestrator._on_parse_failed)
        self._patches = [
            patch("orchestrator.get_client", return_value=self.client),
            patch("orchestrator.get_default_manager", return_value=MagicMock()),
            patch("orchestrator.parse_listing_outcome", new=self.parse),
            patch("orchestrator.is_group_selected", return_value=True),
            patch("orchestrator.compute_fingerprint", return_value="fp-retry"),
            patch("orchestrator.fingerprint_exists", return_value=False),
            patch("orchestrator.score_listing", return_value=(0.9, [])),
            patch("orchestrator.insert_raw_listing", new=self.insert),
            patch("orchestrator.ingest_personal_listing", new=self.ingest),
            patch("orchestrator._sleep", new=self.sleep),
            patch("orchestrator._jitter", return_value=0.0),
        ]
        if wrap_failed:
            self._patches.append(patch("orchestrator._on_parse_failed", new=self.failed))

    def __enter__(self):
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in reversed(self._patches):
            p.stop()
        return False

    def run(self, payload):
        return orchestrator.handle_message(payload)

    def delays(self):
        return [c.args[0] for c in self.sleep.call_args_list]


# ---------------------------------------------------------------------------
# Durum başına davranış (yeniden deneme yok)
# ---------------------------------------------------------------------------


def test_listing_shared_path_inserts_once_without_retry():
    with _Harness(LISTING) as h:
        h.run(_payload())
        assert h.parse.await_count == 1
        assert h.insert.call_count == 1
        h.sleep.assert_not_called()
        h.failed.assert_not_called()


def test_not_listing_shared_logs_not_listing_and_is_not_retried(caplog):
    caplog.set_level(logging.INFO, logger="scraper.orchestrator")
    with _Harness(NOT_LISTING) as h:
        h.run(_payload())
        assert h.parse.await_count == 1
        assert h.insert.call_count == 0
        h.sleep.assert_not_called()
        h.failed.assert_not_called()
    assert "ilan değil" in caplog.text


def test_not_listing_personal_counts_not_listing_once():
    with _Harness(NOT_LISTING) as h:
        outcome = h.run(_payload(agent=True))
        assert outcome == "personal_not_listing"
        assert _bump_calls(h.client) == ["personal_not_listing"]
        assert h.parse.await_count == 1
        h.sleep.assert_not_called()


# ---------------------------------------------------------------------------
# Yeniden deneme
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("reason", ["rate_limit", "timeout", "network", "provider_error", "json_invalid"])
def test_transient_error_then_listing_succeeds_on_second_attempt(reason):
    with _Harness([_err(reason), LISTING]) as h:
        h.run(_payload())
        assert h.parse.await_count == 2
        assert h.delays() == [2.0]
        assert h.insert.call_count == 1
        h.failed.assert_not_called()


def test_personal_retry_succeeds_and_ingests():
    with _Harness([_err("rate_limit"), LISTING]) as h:
        outcome = h.run(_payload(agent=True))
        assert outcome == "personal_auto_approved"
        assert h.ingest.call_count == 1
        assert _bump_calls(h.client) == []


def test_retries_exhausted_shared_calls_on_parse_failed_once_and_logs_error(caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload()
    with _Harness([_err("timeout")] * 3) as h:
        h.run(payload)
        assert h.parse.await_count == 3
        assert h.delays() == [2.0, 4.0]
        h.failed.assert_called_once_with(h.client, payload, "timeout", None)
        assert h.insert.call_count == 0
    error_lines = [r for r in caplog.records if r.levelno == logging.ERROR and "parse_failed" in r.getMessage()]
    assert len(error_lines) == 1
    assert "reason=timeout" in error_lines[0].getMessage()
    assert "ilan değil" not in caplog.text, "teknik hata 'ilan değil' olarak loglanmamalı"
    assert RAW_TEXT not in caplog.text, "mesaj metni loglanmamalı"


def test_retries_exhausted_personal_counts_parse_error_not_not_listing():
    payload = _payload(agent=True)
    with _Harness([_err("rate_limit")] * 3) as h:
        outcome = h.run(payload)
        assert outcome == "personal_parse_error"
        assert _bump_calls(h.client) == ["personal_parse_error"]
        assert h.ingest.call_count == 0
        h.failed.assert_called_once_with(h.client, payload, "rate_limit", AGENT_A)


def test_no_key_is_not_retried():
    with _Harness(_err("no_key")) as h:
        outcome = h.run(_payload(agent=True))
        assert h.parse.await_count == 1
        h.sleep.assert_not_called()
        assert outcome == "personal_parse_error"
        h.failed.assert_called_once()
        assert h.failed.call_args.args[2] == "no_key"


def test_schema_invalid_is_not_retried_but_is_error():
    with _Harness(_err("schema_invalid")) as h:
        h.run(_payload())
        assert h.parse.await_count == 1
        h.sleep.assert_not_called()
        assert h.failed.call_args.args[2] == "schema_invalid"


def test_parser_exception_is_not_retried_and_goes_to_failure_seam(caplog):
    caplog.set_level(logging.DEBUG)
    with _Harness(RuntimeError(f"boom {RAW_TEXT}")) as h:
        outcome = h.run(_payload(agent=True))
        assert outcome == "personal_parse_error"
        assert h.parse.await_count == 1
        h.sleep.assert_not_called()
        assert h.failed.call_args.args[2] == "exception"
    assert RAW_TEXT not in caplog.text
    assert "boom" not in caplog.text


def test_transient_error_then_not_listing_stops_without_failure():
    with _Harness([_err("json_invalid"), NOT_LISTING]) as h:
        outcome = h.run(_payload(agent=True))
        assert outcome == "personal_not_listing"
        assert h.parse.await_count == 2
        h.failed.assert_not_called()


def test_active_id_is_discarded_after_exhausted_error():
    key = orchestrator._active_key(_payload())
    with orchestrator._active_ids_lock:
        orchestrator._active_ids.add(key)
    with _Harness([_err("timeout")] * 3) as h:
        h.run(_payload())
    assert key not in orchestrator._active_ids


# ---------------------------------------------------------------------------
# Env: deneme sayısı ve taban gecikme
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, 3), ("", 3), ("abc", 3), ("2.5", 3), ("0", 1), ("-4", 1), ("1", 1), ("4", 4), ("6", 6), ("99", 6)],
)
def test_max_attempts_env_is_clamped(monkeypatch, raw, expected):
    if raw is not None:
        monkeypatch.setenv("PARSE_MAX_ATTEMPTS", raw)
    assert orchestrator._parse_max_attempts() == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, 2.0), ("", 2.0), ("abc", 2.0), ("-1", 2.0), ("nan", 2.0), ("inf", 2.0), ("0", 0.0), ("0.5", 0.5)],
)
def test_retry_base_env_parsing(monkeypatch, raw, expected):
    if raw is not None:
        monkeypatch.setenv("PARSE_RETRY_BASE_SECONDS", raw)
    assert orchestrator._parse_retry_base_seconds() == expected


def test_max_attempts_env_controls_number_of_parse_calls(monkeypatch):
    monkeypatch.setenv("PARSE_MAX_ATTEMPTS", "1")
    with _Harness([_err("timeout")]) as h:
        h.run(_payload())
        assert h.parse.await_count == 1
        h.sleep.assert_not_called()
        h.failed.assert_called_once()


def test_backoff_delays_follow_formula_with_cap(monkeypatch):
    monkeypatch.setenv("PARSE_MAX_ATTEMPTS", "6")
    monkeypatch.setenv("PARSE_RETRY_BASE_SECONDS", "3")
    with _Harness([_err("provider_error")] * 6) as h:
        h.run(_payload())
        assert h.parse.await_count == 6
        # base * 2**(attempt-1): 3, 6, 12, 24, 48 -> üst sınır 30
        assert h.delays() == [3.0, 6.0, 12.0, 24.0, 30.0]
        h.failed.assert_called_once()


def test_retry_delay_jitter_is_small_and_capped():
    for attempt in range(1, 7):
        raw = 2.0 * 2 ** (attempt - 1)
        for _ in range(20):
            delay = orchestrator._retry_delay(attempt, 2.0)
            assert min(raw, orchestrator.PARSE_RETRY_MAX_DELAY_SECONDS) <= delay
            assert delay <= min(raw * 1.1, orchestrator.PARSE_RETRY_MAX_DELAY_SECONDS)


def test_on_parse_failed_shared_returns_none_and_counts_nothing():
    client = MagicMock(name="client")
    assert orchestrator._on_parse_failed(client, _payload(), "timeout", None) is None
    assert _bump_calls(client) == []


def test_on_parse_failed_personal_counts_parse_error():
    client = MagicMock(name="client")
    assert orchestrator._on_parse_failed(client, _payload(agent=True), "timeout", AGENT_A) == "personal_parse_error"
    assert client.rpc.call_args_list == [call("bump_sidecar_counter", {"p_key": "personal_parse_error"})]
