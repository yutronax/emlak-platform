# -*- coding: utf-8 -*-
"""scraper/supabase_client.py::fingerprint_exists: DB unique index'iyle aynı kapsam.

DB index'i (migration 0024) `where status <> 'rejected'` koşullu; Python ön kontrolü de
rejected satırları saymamalı ki admin'in reddettiği ilan ortak havuza yeniden girebilsin.
Gerçek Supabase yok: zincirlenen sorgu çağrılarını kaydeden sahte istemci kullanılır.
"""

from types import SimpleNamespace

from supabase_client import fingerprint_exists


class _Query:
    def __init__(self, client):
        self._client = client

    def __getattr__(self, name):
        def method(*args, **kwargs):
            self._client.calls.append((name, args, kwargs))
            if name == "execute":
                return SimpleNamespace(data=self._client.data)
            return self

        return method


class _FakeClient:
    def __init__(self, data=None):
        self.calls = []
        self.data = data if data is not None else []

    def table(self, name):
        self.calls.append(("table", (name,), {}))
        return _Query(self)


def test_fingerprint_exists_excludes_rejected_rows():
    client = _FakeClient()
    fingerprint_exists(client, "fp-1")
    assert ("table", ("raw_listings",), {}) in client.calls
    assert ("eq", ("fingerprint", "fp-1"), {}) in client.calls
    assert ("is_", ("owner_agent_id", "null"), {}) in client.calls
    assert ("neq", ("status", "rejected"), {}) in client.calls
    assert client.calls[-1][0] == "execute"


def test_fingerprint_exists_true_when_row_found():
    assert fingerprint_exists(_FakeClient(data=[{"id": "r1"}]), "fp-1") is True


def test_fingerprint_exists_false_when_no_row():
    assert fingerprint_exists(_FakeClient(data=[]), "fp-1") is False
