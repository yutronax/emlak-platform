# -*- coding: utf-8 -*-
"""scraper/supabase_client.py: pending_raw_messages yardımcıları (park / due / sil / ertele / purge).

Gerçek Supabase yok: zincirlenen sorgu çağrılarını kaydeden sahte bir istemci kullanılır;
sorgu kurgusu (filtreler, sıralama, limit) bu kayıt üzerinden doğrulanır.
"""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

import supabase_client
from supabase_client import (
    PENDING_RAW_TABLE,
    UNIQUE_VIOLATION_CODE,
    delete_pending,
    fetch_due_pending,
    park_raw_message,
    purge_expired_pending,
    reschedule_pending,
)

AGENT_A = "11111111-2222-4333-8444-555555555555"
RAW_TEXT = "PARK-TEST-METNI 2+1 Moda 5321234512"


class _Query:
    def __init__(self, client):
        self._client = client

    def __getattr__(self, name):
        def method(*args, **kwargs):
            self._client.calls.append((name, args, kwargs))
            if name == "execute":
                if self._client.exc is not None:
                    raise self._client.exc
                return SimpleNamespace(data=self._client.data)
            return self

        return method


class _FakeClient:
    def __init__(self, data=None, exc=None):
        self.calls = []
        self.data = data if data is not None else []
        self.exc = exc

    def table(self, name):
        self.calls.append(("table", (name,), {}))
        return _Query(self)

    def names(self):
        return [c[0] for c in self.calls]

    def call(self, name):
        found = [c for c in self.calls if c[0] == name]
        assert len(found) == 1, f"{name} tam bir kez çağrılmalı: {self.calls}"
        return found[0]


def _api_error(code):
    return APIError({"message": "x", "code": code, "hint": None, "details": None})


def _park(client, **overrides):
    kwargs = dict(
        message_id="msg-1",
        agent_id=None,
        group="120363000000000001@g.us",
        group_name="Kadıköy Emlak",
        text=RAW_TEXT,
        reason="rate_limit",
    )
    kwargs.update(overrides)
    return park_raw_message(client, **kwargs)


# ---------------------------------------------------------------------------
# park_raw_message
# ---------------------------------------------------------------------------


def test_park_inserts_row_with_expected_columns():
    client = _FakeClient(data=[{"id": "p-1"}])
    assert _park(client, agent_id=AGENT_A) is True
    assert client.call("table")[1] == (PENDING_RAW_TABLE,)
    row = client.call("insert")[1][0]
    assert row == {
        "source_message_id": "msg-1",
        "agent_id": AGENT_A,
        "source_group": "120363000000000001@g.us",
        "source_group_name": "Kadıköy Emlak",
        "raw_text": RAW_TEXT,
        "reason": "rate_limit",
    }
    assert "upsert" not in client.names(), "metin asla üzerine yazılmamalı"


def test_park_shared_uses_null_agent():
    client = _FakeClient()
    assert _park(client) is True
    assert client.call("insert")[1][0]["agent_id"] is None


def test_park_unique_violation_is_idempotent_success():
    client = _FakeClient(exc=_api_error(UNIQUE_VIOLATION_CODE))
    assert _park(client) is True
    assert "update" not in client.names() and "upsert" not in client.names()


def test_park_other_api_error_is_raised():
    client = _FakeClient(exc=_api_error("42501"))
    with pytest.raises(APIError):
        _park(client)


@pytest.mark.parametrize("reason", [None, "", "Rate-Limit", "a" * 41, "x;drop"])
def test_park_invalid_reason_is_normalized_to_unknown(reason):
    client = _FakeClient()
    _park(client, reason=reason)
    assert client.call("insert")[1][0]["reason"] == "unknown"


def test_park_without_message_id_is_skipped():
    client = _FakeClient()
    assert _park(client, message_id="") is False
    assert client.calls == []


@pytest.mark.parametrize("text", ["", "x" * (supabase_client.PENDING_RAW_TEXT_MAX_CHARS + 1)])
def test_park_empty_or_oversized_text_is_skipped_without_logging_text(text, caplog):
    client = _FakeClient()
    assert _park(client, text=text) is False
    assert client.calls == []
    assert "xxxxxxxx" not in caplog.text


def test_park_text_at_cap_is_parked():
    client = _FakeClient()
    assert _park(client, text="y" * supabase_client.PENDING_RAW_TEXT_MAX_CHARS) is True


# ---------------------------------------------------------------------------
# fetch_due_pending: yalnız pending + vadesi gelmiş + süresi dolmamış, created_at sırası, limit
# ---------------------------------------------------------------------------


def test_fetch_due_pending_query_semantics():
    rows = [{"id": "p-1"}, {"id": "p-2"}]
    client = _FakeClient(data=rows)
    before = datetime.now(timezone.utc)
    assert fetch_due_pending(client, 20) == rows
    after = datetime.now(timezone.utc)

    assert client.call("table")[1] == (PENDING_RAW_TABLE,)
    assert client.call("eq")[1] == ("status", "pending"), "dead satırlar alınmamalı"
    lte = client.call("lte")[1]
    assert lte[0] == "next_attempt_at", "vadesi gelmemiş satırlar alınmamalı"
    gt = client.call("gt")[1]
    assert gt[0] == "expires_at", "süresi dolmuş satırlar alınmamalı"
    for stamp in (lte[1], gt[1]):
        assert before <= datetime.fromisoformat(stamp) <= after
    assert client.call("order")[1] == ("created_at",)
    assert client.call("order")[2].get("desc", False) is False
    assert client.call("limit")[1] == (20,)
    columns = client.call("select")[1][0]
    for col in ("id", "source_message_id", "agent_id", "source_group", "source_group_name", "raw_text", "attempts"):
        assert col in columns.split(",")


def test_fetch_due_pending_empty_data_returns_list():
    client = _FakeClient(data=None)
    client.data = None
    assert fetch_due_pending(client, 5) == []


# ---------------------------------------------------------------------------
# delete / reschedule / purge
# ---------------------------------------------------------------------------


def test_delete_pending_deletes_by_id():
    client = _FakeClient()
    delete_pending(client, "p-9")
    assert client.names()[:3] == ["table", "delete", "eq"]
    assert client.call("eq")[1] == ("id", "p-9")


def test_reschedule_pending_sets_attempts_next_and_status():
    client = _FakeClient()
    when = datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)
    reschedule_pending(client, "p-3", 4, when, False)
    values = client.call("update")[1][0]
    assert values["attempts"] == 4
    assert values["next_attempt_at"] == when.isoformat()
    assert values["status"] == "pending"
    assert "updated_at" in values
    assert "raw_text" not in values
    assert client.call("eq")[1] == ("id", "p-3")


def test_reschedule_pending_dead_marks_status_dead():
    client = _FakeClient()
    reschedule_pending(client, "p-3", 8, datetime.now(timezone.utc), True)
    assert client.call("update")[1][0]["status"] == "dead"


def test_purge_expired_pending_deletes_where_expires_before_now():
    client = _FakeClient(data=[{"id": "a"}, {"id": "b"}])
    assert purge_expired_pending(client) == 2
    assert "delete" in client.names()
    assert client.call("lt")[1][0] == "expires_at"
