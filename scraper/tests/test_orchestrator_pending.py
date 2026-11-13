# -*- coding: utf-8 -*-
"""scraper/orchestrator.py: parse hatasında ham mesajın park edilmesi ve arka plan drain döngüsü.

- Parse error (denemeler tükendi / geçici olmayan hata) -> park_raw_message (ortak: agent None).
- listing / not_listing park edilmez; park arızası worker'ı düşürmez, _active_ids temizlenir.
- Drain: satır başına tek parse denemesi (yeniden deneme yok); işlendi -> sil, parse hatası ->
  attempts+1 ve min(6 sa, 5 dk * 2**attempts) sonrası; azami denemede dead. Replay asla park etmez.
- Kişisel satırda seçim replay anında yeniden doğrulanır; seçili değilse parse edilmeden silinir.

Gerçek ağ / uyku yok: Supabase yardımcıları ve parse orchestrator modülünde patch'lenir.
"""

import logging
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import orchestrator
from parser import ParseOutcome

AGENT_A = "11111111-2222-4333-8444-555555555555"
GROUP_JID = "120363000000000001@g.us"
RAW_TEXT = "PENDING-TEST-METNI 3+1 Kadıköy 5321234512"
PARSED = {"ilce": "Kadıköy", "fiyat": 1000000}
NOW = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)

LISTING = ParseOutcome("listing", PARSED, None)
NOT_LISTING = ParseOutcome("not_listing", None, None)


def _err(reason):
    return ParseOutcome("error", None, reason)


def _payload(agent=False, **overrides):
    base = {"id": "msg-pend-1", "text": RAW_TEXT, "group": GROUP_JID, "groupName": "Kadıköy Emlak"}
    if agent:
        base["agentId"] = AGENT_A
    base.update(overrides)
    return base


def _row(agent=False, attempts=0, **overrides):
    base = {
        "id": "pend-row-1",
        "source_message_id": "msg-pend-1",
        "agent_id": AGENT_A if agent else None,
        "source_group": GROUP_JID,
        "source_group_name": "Kadıköy Emlak",
        "raw_text": RAW_TEXT,
        "reason": "rate_limit",
        "attempts": attempts,
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    for name in ("PARSE_MAX_ATTEMPTS", "PARSE_RETRY_BASE_SECONDS", "PENDING_DRAIN_INTERVAL_SECONDS", "PENDING_MAX_ATTEMPTS"):
        monkeypatch.delenv(name, raising=False)
    with orchestrator._active_ids_lock:
        orchestrator._active_ids.clear()
    yield
    with orchestrator._active_ids_lock:
        orchestrator._active_ids.clear()


class _Harness:
    def __init__(self, outcomes, *, rows=None, selected=True):
        self.client = MagicMock(name="client")
        self.parse = AsyncMock(name="parse_listing_outcome")
        if isinstance(outcomes, (list, BaseException)):
            self.parse.side_effect = outcomes
        else:
            self.parse.return_value = outcomes
        self.sleep = MagicMock(name="sleep")
        self.insert = MagicMock(name="insert_raw_listing", return_value=({"id": "row-1"}, True))
        self.ingest = MagicMock(name="ingest_personal_listing", return_value="approved")
        self.park = MagicMock(name="park_raw_message", return_value=True)
        self.fetch = MagicMock(name="fetch_due_pending", return_value=list(rows or []))
        self.delete = MagicMock(name="delete_pending")
        self.reschedule = MagicMock(name="reschedule_pending")
        self.selected = MagicMock(name="is_group_selected", return_value=selected)
        self._patches = [
            patch("orchestrator.get_client", return_value=self.client),
            patch("orchestrator.get_default_manager", return_value=MagicMock()),
            patch("orchestrator.parse_listing_outcome", new=self.parse),
            patch("orchestrator.is_group_selected", new=self.selected),
            patch("orchestrator.compute_fingerprint", return_value="fp-pend"),
            patch("orchestrator.fingerprint_exists", return_value=False),
            patch("orchestrator.score_listing", return_value=(0.9, [])),
            patch("orchestrator.insert_raw_listing", new=self.insert),
            patch("orchestrator.ingest_personal_listing", new=self.ingest),
            patch("orchestrator.park_raw_message", new=self.park),
            patch("orchestrator.fetch_due_pending", new=self.fetch),
            patch("orchestrator.delete_pending", new=self.delete),
            patch("orchestrator.reschedule_pending", new=self.reschedule),
            patch("orchestrator._sleep", new=self.sleep),
            patch("orchestrator._jitter", return_value=0.0),
            patch("orchestrator._now", return_value=NOW),
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


# ---------------------------------------------------------------------------
# Park (canlı yol)
# ---------------------------------------------------------------------------


def test_shared_parse_error_parks_with_null_agent():
    with _Harness([_err("rate_limit")] * 3) as h:
        orchestrator.handle_message(_payload())
        h.park.assert_called_once_with(
            h.client,
            message_id="msg-pend-1",
            agent_id=None,
            group=GROUP_JID,
            group_name="Kadıköy Emlak",
            text=RAW_TEXT,
            reason="rate_limit",
        )
        assert h.insert.call_count == 0


def test_personal_parse_error_parks_with_agent_and_keeps_counter():
    with _Harness(_err("no_key")) as h:
        outcome = orchestrator.handle_message(_payload(agent=True))
        assert outcome == "personal_parse_error"
        assert h.bumps() == ["personal_parse_error"]
        assert h.park.call_count == 1
        assert h.park.call_args.kwargs["agent_id"] == AGENT_A
        assert h.park.call_args.kwargs["reason"] == "no_key"


def test_parked_text_is_stripped_like_processing_text():
    with _Harness(_err("schema_invalid")) as h:
        orchestrator.handle_message(_payload(text=f"  {RAW_TEXT}\n"))
        assert h.park.call_args.kwargs["text"] == RAW_TEXT


def test_double_failure_of_same_message_parks_twice_and_db_dedups():
    """Aynı mesaj iki kez hata verirse park iki kez çağrılır; tekilliği DB unique index + helper sağlar."""
    with _Harness([_err("timeout")] * 6) as h:
        orchestrator.handle_message(_payload())
        orchestrator.handle_message(_payload())
        assert h.park.call_count == 2
        assert h.park.call_args_list[0] == h.park.call_args_list[1]


@pytest.mark.parametrize("outcome", [LISTING, NOT_LISTING])
@pytest.mark.parametrize("agent", [False, True])
def test_listing_or_not_listing_is_not_parked(outcome, agent):
    with _Harness(outcome) as h:
        orchestrator.handle_message(_payload(agent=agent))
        h.park.assert_not_called()


def test_park_failure_does_not_crash_and_active_id_is_cleaned(caplog):
    caplog.set_level(logging.DEBUG)
    key = orchestrator._active_key(_payload(agent=True))
    with orchestrator._active_ids_lock:
        orchestrator._active_ids.add(key)
    with _Harness(_err("rate_limit")) as h:
        h.park.side_effect = RuntimeError(f"db down {RAW_TEXT}")
        outcome = orchestrator.handle_message(_payload(agent=True))
        assert outcome == "personal_parse_error"
        assert h.bumps() == ["personal_parse_error"]
    assert key not in orchestrator._active_ids
    errors = [r.getMessage() for r in caplog.records if r.levelno == logging.ERROR and "pending_park_failed" in r.getMessage()]
    assert errors == ["pending_park_failed type=RuntimeError message_id=msg-pend-1"]
    assert RAW_TEXT not in caplog.text
    assert "db down" not in caplog.text


# ---------------------------------------------------------------------------
# Drain: dispositions
# ---------------------------------------------------------------------------


def test_drain_success_shared_inserts_and_deletes_row():
    with _Harness(LISTING, rows=[_row()]) as h:
        orchestrator._drain_pending_once()
        h.fetch.assert_called_once_with(h.client, orchestrator.PENDING_DRAIN_BATCH)
        assert h.insert.call_count == 1
        record = h.insert.call_args.args[1]
        assert record["raw_text"] == RAW_TEXT
        assert record["source_message_id"] == "msg-pend-1"
        assert record["source_group_name"] == "Kadıköy Emlak"
        h.delete.assert_called_once_with(h.client, "pend-row-1")
        h.reschedule.assert_not_called()
        h.park.assert_not_called()


def test_drain_success_personal_ingests_and_deletes_row():
    with _Harness(LISTING, rows=[_row(agent=True)]) as h:
        orchestrator._drain_pending_once()
        assert h.ingest.call_count == 1
        assert h.ingest.call_args.args[1] == AGENT_A
        h.delete.assert_called_once_with(h.client, "pend-row-1")


@pytest.mark.parametrize("agent", [False, True])
def test_drain_not_listing_deletes_row(agent):
    with _Harness(NOT_LISTING, rows=[_row(agent=agent)]) as h:
        orchestrator._drain_pending_once()
        h.delete.assert_called_once_with(h.client, "pend-row-1")
        h.reschedule.assert_not_called()


def test_drain_duplicate_fingerprint_deletes_row():
    with _Harness(LISTING, rows=[_row()]) as h, patch("orchestrator.fingerprint_exists", return_value=True):
        orchestrator._drain_pending_once()
        assert h.insert.call_count == 0
        h.delete.assert_called_once_with(h.client, "pend-row-1")


@pytest.mark.parametrize(("attempts", "delay"), [(0, timedelta(minutes=5)), (2, timedelta(minutes=20)), (6, timedelta(hours=5, minutes=20))])
def test_drain_parse_error_reschedules_with_backoff(attempts, delay):
    with _Harness(_err("rate_limit"), rows=[_row(attempts=attempts)]) as h:
        orchestrator._drain_pending_once()
        assert h.parse.await_count == 1, "replay'de iş parçacığı içi yeniden deneme olmamalı"
        h.sleep.assert_not_called()
        h.reschedule.assert_called_once_with(h.client, "pend-row-1", attempts + 1, NOW + delay, False)
        h.delete.assert_not_called()
        h.park.assert_not_called()


def test_backoff_is_capped_at_six_hours():
    assert orchestrator._pending_backoff(7) == timedelta(hours=6)
    assert orchestrator._pending_backoff(30) == timedelta(hours=6)
    assert orchestrator._pending_backoff(0) == timedelta(minutes=5)


def test_drain_parse_error_reaching_max_attempts_marks_dead_and_logs_once(caplog):
    caplog.set_level(logging.DEBUG)
    with _Harness(_err("timeout"), rows=[_row(attempts=7)]) as h:
        orchestrator._drain_pending_once()
        args = h.reschedule.call_args.args
        assert args[2] == 8 and args[4] is True
    dead = [r for r in caplog.records if r.levelno == logging.ERROR and "pending_dead" in r.getMessage()]
    assert len(dead) == 1
    assert "pend-row-1" in dead[0].getMessage()
    assert RAW_TEXT not in caplog.text


def test_drain_max_attempts_env_is_respected(monkeypatch):
    monkeypatch.setenv("PENDING_MAX_ATTEMPTS", "2")
    with _Harness(_err("timeout"), rows=[_row(attempts=1)]) as h:
        orchestrator._drain_pending_once()
        assert h.reschedule.call_args.args[4] is True


def test_drain_replay_ignores_parse_max_attempts_env(monkeypatch):
    monkeypatch.setenv("PARSE_MAX_ATTEMPTS", "5")
    with _Harness([_err("network")] * 5, rows=[_row()]) as h:
        orchestrator._drain_pending_once()
        assert h.parse.await_count == 1


def test_drain_personal_parse_error_does_not_bump_or_repark():
    with _Harness(_err("rate_limit"), rows=[_row(agent=True)]) as h:
        orchestrator._drain_pending_once()
        h.park.assert_not_called()
        assert h.bumps() == []
        assert h.reschedule.call_count == 1


def test_drain_unexpected_processing_exception_reschedules_not_deletes():
    with _Harness(LISTING, rows=[_row()]) as h:
        h.insert.side_effect = RuntimeError("db")
        orchestrator._drain_pending_once()
        h.delete.assert_not_called()
        assert h.reschedule.call_count == 1


def test_drain_shared_exception_after_parse_is_retried_not_deleted():
    """Ortak yolda parse sonrası DB istisnası (fingerprint_exists) yukarı fırlar -> ertelenir."""
    with _Harness(LISTING, rows=[_row(attempts=1)]) as h, patch(
        "orchestrator.fingerprint_exists", side_effect=RuntimeError("db")
    ):
        orchestrator._drain_pending_once()
        h.delete.assert_not_called()
        h.reschedule.assert_called_once_with(h.client, "pend-row-1", 2, NOW + timedelta(minutes=10), False)


def test_drain_personal_ingest_exception_is_retried_not_deleted():
    with _Harness(LISTING, rows=[_row(agent=True, attempts=2)]) as h:
        h.ingest.side_effect = RuntimeError("db")
        orchestrator._drain_pending_once()
        h.delete.assert_not_called()
        h.reschedule.assert_called_once_with(h.client, "pend-row-1", 3, NOW + timedelta(minutes=20), False)
        assert h.bumps() == ["personal_write_error"]
        h.park.assert_not_called()


def test_drain_personal_selection_check_exception_is_retried_not_deleted():
    with _Harness(LISTING, rows=[_row(agent=True)]) as h:
        h.selected.side_effect = RuntimeError("db")
        orchestrator._drain_pending_once()
        assert h.parse.await_count == 0, "seçim doğrulanamazsa metin Gemini'ye gitmemeli"
        h.delete.assert_not_called()
        h.reschedule.assert_called_once_with(h.client, "pend-row-1", 1, NOW + timedelta(minutes=5), False)
        assert h.bumps() == ["personal_selection_check_error"]


@pytest.mark.parametrize("failure", ["ingest", "selection"])
def test_drain_personal_transient_db_errors_go_dead_at_max_attempts(failure):
    with _Harness(LISTING, rows=[_row(agent=True, attempts=7)]) as h:
        if failure == "ingest":
            h.ingest.side_effect = RuntimeError("db")
        else:
            h.selected.side_effect = RuntimeError("db")
        orchestrator._drain_pending_once()
        h.delete.assert_not_called()
        args = h.reschedule.call_args.args
        assert args[2] == 8 and args[4] is True


@pytest.mark.parametrize("status", ["unselected", "not_connected", "duplicate", "pending", "approved"])
def test_drain_personal_ingest_final_statuses_delete_row(status):
    with _Harness(LISTING, rows=[_row(agent=True)]) as h:
        h.ingest.return_value = status
        orchestrator._drain_pending_once()
        h.delete.assert_called_once_with(h.client, "pend-row-1")
        h.reschedule.assert_not_called()


def test_drain_unselected_personal_group_deletes_without_parsing():
    with _Harness(LISTING, rows=[_row(agent=True)], selected=False) as h:
        orchestrator._drain_pending_once()
        h.selected.assert_called_once_with(h.client, AGENT_A, GROUP_JID)
        assert h.parse.await_count == 0, "seçili olmayan grubun metni Gemini'ye gitmemeli"
        assert h.ingest.call_count == 0
        h.delete.assert_called_once_with(h.client, "pend-row-1")
        h.reschedule.assert_not_called()


def test_drain_not_connected_personal_deletes_row():
    with _Harness(LISTING, rows=[_row(agent=True)]) as h:
        h.ingest.return_value = "not_connected"
        orchestrator._drain_pending_once()
        h.delete.assert_called_once_with(h.client, "pend-row-1")


def test_drain_processes_rows_sequentially_and_continues_after_row_error():
    rows = [_row(id="r1", source_message_id="m1"), _row(id="r2", source_message_id="m2")]
    with _Harness([LISTING, LISTING], rows=rows) as h:
        h.delete.side_effect = [RuntimeError("db"), None]
        orchestrator._drain_pending_once()
        assert [c.args[1] for c in h.delete.call_args_list] == ["r1", "r2"]


def test_drain_fetch_error_is_swallowed_by_loop_iteration(caplog):
    with _Harness(LISTING) as h:
        h.fetch.side_effect = RuntimeError("db")
        orchestrator._drain_pending_once()
        assert h.parse.await_count == 0


# ---------------------------------------------------------------------------
# Eşzamanlılık koruması (_active_ids)
# ---------------------------------------------------------------------------


SHARED_KEY = ("", "msg-pend-1")  # _active_key: (agentId ya da "", mesaj id)


def test_drain_skips_row_while_live_copy_is_active():
    with orchestrator._active_ids_lock:
        orchestrator._active_ids.add(SHARED_KEY)
    with _Harness(LISTING, rows=[_row()]) as h:
        orchestrator._drain_pending_once()
        assert h.parse.await_count == 0
        h.delete.assert_not_called()
        h.reschedule.assert_not_called()
    assert SHARED_KEY in orchestrator._active_ids, "canlı kopyanın kaydı silinmemeli"


def test_drain_holds_active_id_during_replay_and_releases_after():
    seen = {}

    async def _parse(text, key_manager):
        with orchestrator._active_ids_lock:
            seen["held"] = SHARED_KEY in orchestrator._active_ids
        return LISTING

    with _Harness(LISTING, rows=[_row()]) as h:
        h.parse.side_effect = _parse
        orchestrator._drain_pending_once()
    assert seen["held"] is True
    assert SHARED_KEY not in orchestrator._active_ids


def test_drain_releases_active_id_after_parse_error():
    with _Harness(_err("timeout"), rows=[_row()]):
        orchestrator._drain_pending_once()
    assert orchestrator._active_ids == set()


# ---------------------------------------------------------------------------
# Env ve purge
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, 300), ("", 300), ("abc", 300), ("12.5", 300), ("0", 30), ("-5", 30), ("30", 30), ("600", 600), ("99999", 3600)],
)
def test_drain_interval_env(monkeypatch, raw, expected):
    if raw is not None:
        monkeypatch.setenv("PENDING_DRAIN_INTERVAL_SECONDS", raw)
    assert orchestrator._pending_drain_interval_seconds() == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, 8), ("", 8), ("x", 8), ("0", 1), ("-1", 1), ("1", 1), ("8", 8), ("20", 20), ("500", 20)],
)
def test_pending_max_attempts_env(monkeypatch, raw, expected):
    if raw is not None:
        monkeypatch.setenv("PENDING_MAX_ATTEMPTS", raw)
    assert orchestrator._pending_max_attempts() == expected


def test_purge_once_purges_parse_cache_and_pending():
    client = MagicMock(name="client")
    with patch("orchestrator.get_client", return_value=client), patch(
        "orchestrator.purge_expired_parse_cache", return_value=1
    ) as cache, patch("orchestrator.purge_expired_pending", return_value=2) as pending:
        orchestrator._purge_once()
    cache.assert_called_once_with(client)
    pending.assert_called_once_with(client)


def test_purge_once_pending_runs_even_if_cache_purge_fails(caplog):
    client = MagicMock(name="client")
    with patch("orchestrator.get_client", return_value=client), patch(
        "orchestrator.purge_expired_parse_cache", side_effect=RuntimeError("x")
    ), patch("orchestrator.purge_expired_pending", return_value=0) as pending:
        orchestrator._purge_once()
    pending.assert_called_once_with(client)


def test_purge_once_pending_failure_is_swallowed(caplog):
    caplog.set_level(logging.WARNING)
    with patch("orchestrator.get_client", return_value=MagicMock()), patch(
        "orchestrator.purge_expired_parse_cache", return_value=0
    ), patch("orchestrator.purge_expired_pending", side_effect=RuntimeError("x")):
        orchestrator._purge_once()
    assert "pending_purge_error" in caplog.text


class _StopLoop(Exception):
    pass


def test_drain_loop_runs_once_then_sleeps_interval(monkeypatch):
    monkeypatch.setenv("PENDING_DRAIN_INTERVAL_SECONDS", "120")
    with patch("orchestrator._drain_pending_once") as once, patch(
        "orchestrator.time.sleep", side_effect=_StopLoop
    ) as sleep:
        with pytest.raises(_StopLoop):
            orchestrator._pending_drain_loop()
    once.assert_called_once_with()
    sleep.assert_called_once_with(120)


def test_drain_loop_survives_unexpected_error():
    with patch("orchestrator._drain_pending_once", side_effect=[RuntimeError("x"), None]) as once, patch(
        "orchestrator.time.sleep", side_effect=[None, _StopLoop]
    ):
        with pytest.raises(_StopLoop):
            orchestrator._pending_drain_loop()
    assert once.call_count == 2


def test_run_starts_drain_thread(monkeypatch):
    monkeypatch.setenv("BAILEYS_WEBHOOK_SECRET", "s")
    started = []

    class _Thread:
        def __init__(self, target=None, args=(), daemon=None):
            self.target, self.daemon = target, daemon

        def start(self):
            started.append((self.target, self.daemon))

    server = MagicMock()
    with patch("orchestrator.threading.Thread", _Thread), patch("orchestrator.HTTPServer", return_value=server), patch(
        "orchestrator.ThreadPoolExecutor"
    ):
        orchestrator.run()
    targets = {t for t, _ in started}
    assert orchestrator._pending_drain_loop in targets
    assert all(daemon for _, daemon in started)
