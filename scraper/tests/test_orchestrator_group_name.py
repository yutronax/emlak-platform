# -*- coding: utf-8 -*-
"""scraper/orchestrator.py handle_message source_group_name testleri (ATDD EML-77,
AC-2): webhook payload'ındaki groupName, raw_listings kaydındaki source_group_name
alanına yazılır; source_group (JID) değişmez; groupName yoksa (eski bridge sürümü)
crash olmadan None olur.

ZORUNLU mock-patch kuralı (test_orchestrator_dedup.py ile aynı): orchestrator.py
`from supabase_client import insert_raw_listing` ile import ediyor -> patch hedefi
`orchestrator.insert_raw_listing` olmalı, `supabase_client.insert_raw_listing` DEĞİL.

Not: parse_listing_message gerçekte async bir fonksiyon (handle_message bunu
asyncio.run ile çalıştırıyor). Bu yüzden patch'te düz return_value yerine AsyncMock
kullanılır; aksi halde asyncio.run bir dict üzerinde patlar ve insert hiç çağrılmaz.

Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — orchestrator.py henüz
record["source_group_name"] alanını yazmıyor.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import orchestrator

GROUP_JID = "123@g.us"
GROUP_NAME = "Kadıköy Emlak Grubu"
TEXT = "örnek ilan metni"


def _run_handle_message(payload):
    with (
        patch("orchestrator.get_client", return_value=MagicMock()),
        patch("orchestrator.get_default_manager", return_value=MagicMock()),
        patch(
            "orchestrator.parse_listing_message",
            new=AsyncMock(return_value={"ilce": "Kadıköy", "fiyat": 1000000}),
        ),
        patch("orchestrator.compute_fingerprint", return_value="fp-group-test"),
        patch("orchestrator.fingerprint_exists", return_value=False),
        patch("orchestrator.score_listing", return_value=(0.8, [])),
        patch(
            "orchestrator.insert_raw_listing",
            return_value=({"id": "row-1"}, True),
        ) as insert_mock,
    ):
        orchestrator.handle_message(payload)
    return insert_mock


def _record_from(insert_mock):
    assert insert_mock.call_count == 1, "insert_raw_listing tam 1 kez çağrılmalı"
    return insert_mock.call_args[0][1]


def test_handle_message_writes_group_name_to_source_group_name():
    payload = {
        "id": "msg-1",
        "text": TEXT,
        "group": GROUP_JID,
        "groupName": GROUP_NAME,
    }
    record = _record_from(_run_handle_message(payload))

    assert record["source_group_name"] == GROUP_NAME


def test_handle_message_keeps_source_group_jid_unchanged():
    payload = {
        "id": "msg-1",
        "text": TEXT,
        "group": GROUP_JID,
        "groupName": GROUP_NAME,
    }
    record = _record_from(_run_handle_message(payload))

    assert record["source_group"] == GROUP_JID


def test_handle_message_without_group_name_sets_source_group_name_none():
    # Eski bridge.js sürümünden gelen mesaj: groupName alanı yok -> crash etmemeli.
    payload = {"id": "msg-2", "text": TEXT, "group": GROUP_JID}
    record = _record_from(_run_handle_message(payload))

    assert record["source_group_name"] is None
