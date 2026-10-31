# -*- coding: utf-8 -*-
"""EML-107 düzeltmeler: kişisel sonuç sayaçları (operatör görünürlüğü) ve seçim-dışı dönüşü.

Kapsam (ek testler; test_personal_ingest.py'deki mevcut assert'ler değiştirilmedi):
  - supabase_client.bump_sidecar_counter: service-role RPC çağrısı, anahtar doğrulama, best-effort.
  - supabase_client.ingest_personal_listing: 'unselected' dönüşü kabul edilir.
  - orchestrator: personal_not_listing / personal_parse_error / personal_write_error için RPC sayacı;
    DB'nin kendi saydığı sonuçlar (approved/pending/duplicate/unselected) için Python ikinci sayım YAPMAZ.
"""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import orchestrator
import supabase_client

AGENT_A = "11111111-2222-4333-8444-555555555555"
GROUP_JID = "120363000000000001@g.us"
RAW_TEXT = "SAYAC-TEST-METNI 3+1 Kadıköy 5321234512"


def _payload(**overrides):
    base = {
        "id": "msg-counter-1",
        "text": RAW_TEXT,
        "group": GROUP_JID,
        "groupName": "Kadıköy Emlak",
        "agentId": AGENT_A,
    }
    base.update(overrides)
    return base


def _bump_calls(client):
    """client.rpc çağrılarından yalnız bump_sidecar_counter olanların p_key değerleri."""
    keys = []
    for call in client.rpc.call_args_list:
        if call.args and call.args[0] == "bump_sidecar_counter":
            keys.append(call.args[1]["p_key"])
    return keys


# ---------------------------------------------------------------------------
# supabase_client.bump_sidecar_counter
# ---------------------------------------------------------------------------

def test_bump_sidecar_counter_calls_service_rpc_with_key():
    client = MagicMock(name="client")
    assert supabase_client.bump_sidecar_counter(client, "personal_not_listing") is True
    client.rpc.assert_called_once_with("bump_sidecar_counter", {"p_key": "personal_not_listing"})


@pytest.mark.parametrize("bad_key", ["", "Personal", "personal-queued", "a" * 41, "k1", None, 7])
def test_bump_sidecar_counter_rejects_invalid_key_without_rpc(bad_key):
    client = MagicMock(name="client")
    assert supabase_client.bump_sidecar_counter(client, bad_key) is False
    client.rpc.assert_not_called()


def test_bump_sidecar_counter_swallows_rpc_failure_and_logs_only_type(caplog):
    caplog.set_level(logging.DEBUG)
    client = MagicMock(name="client")
    client.rpc.side_effect = RuntimeError("secret-db-detail-XYZ")
    assert supabase_client.bump_sidecar_counter(client, "personal_write_error") is False
    assert "secret-db-detail-XYZ" not in caplog.text, "RPC hata metni loglanmamalı (yalnız tip)"
    assert "RuntimeError" in caplog.text


def test_ingest_personal_listing_accepts_unselected_result():
    client = MagicMock(name="client")
    client.rpc.return_value.execute.return_value.data = "unselected"
    assert supabase_client.ingest_personal_listing(client, AGENT_A, {"raw_text": "x"}) == "unselected"


# ---------------------------------------------------------------------------
# orchestrator: sayaç anahtarları
# ---------------------------------------------------------------------------

def test_outcome_key_maps_unselected_to_personal_unselected():
    assert orchestrator._personal_outcome_key("unselected", None) == "personal_unselected"


_DEFAULT_PARSED = object()


def _run(payload, *, parsed=_DEFAULT_PARSED, parse_side_effect=None, ingest_return="approved", ingest_side_effect=None):
    client = MagicMock(name="client")
    parse_value = {"ilce": "Kadıköy"} if parsed is _DEFAULT_PARSED else parsed  # None = parse "ilan değil"
    parse = AsyncMock(return_value=parse_value)
    if parse_side_effect is not None:
        parse.side_effect = parse_side_effect
    ingest = MagicMock(name="ingest_personal_listing")
    if ingest_side_effect is not None:
        ingest.side_effect = ingest_side_effect
    else:
        ingest.return_value = ingest_return
    patches = [
        patch("orchestrator.get_client", return_value=client),
        patch("orchestrator.get_default_manager", return_value=MagicMock()),
        patch("orchestrator.parse_listing_message", new=parse),
        patch("orchestrator.compute_fingerprint", return_value="fp-counter"),
        patch("orchestrator.score_listing", return_value=(0.9, [])),
        patch("orchestrator.ingest_personal_listing", new=ingest),
        patch("orchestrator.insert_raw_listing", new=MagicMock(return_value=({"id": "r"}, True))),
    ]
    for p in patches:
        p.start()
    try:
        outcome = orchestrator.handle_message(payload)
    finally:
        for p in reversed(patches):
            p.stop()
    return outcome, client, ingest


def test_parse_error_is_counted_via_rpc_and_returns_key():
    with patch.object(orchestrator.logger, "exception"):
        outcome, client, _ = _run(_payload(), parse_side_effect=RuntimeError("gemini down"))
    assert outcome == "personal_parse_error"
    assert _bump_calls(client) == ["personal_parse_error"]


def test_not_listing_is_counted_via_rpc():
    outcome, client, ingest = _run(_payload(), parsed=None)
    assert outcome == "personal_not_listing"
    assert ingest.call_count == 0
    assert _bump_calls(client) == ["personal_not_listing"]


def test_write_error_is_counted_via_rpc_when_ingest_raises():
    with patch.object(orchestrator.logger, "exception"):
        outcome, client, _ = _run(_payload(), ingest_side_effect=ConnectionError("net"))
    assert outcome == "personal_write_error"
    assert _bump_calls(client) == ["personal_write_error"]


@pytest.mark.parametrize("ingest_return", ["approved", "pending", "duplicate", "unselected"])
def test_db_counted_outcomes_are_not_counted_again_by_python(ingest_return):
    """Sayaç DB'de (ingest_personal_listing içinde) artırılır; Python ikinci kez saymaz (çift sayım yok)."""
    outcome, client, _ = _run(_payload(), ingest_return=ingest_return)
    assert _bump_calls(client) == [], "Python tarafı DB tarafından sayılan sonucu RPC ile tekrar saymamalı"
    assert outcome == orchestrator._personal_outcome_key(ingest_return, 0.9)


def test_counter_rpc_failure_does_not_change_outcome():
    client_holder = {}

    def _get_client():
        client = MagicMock(name="client")
        client.rpc.side_effect = RuntimeError("rpc down")
        client_holder["client"] = client
        return client

    parse = AsyncMock(return_value=None)
    with patch("orchestrator.get_client", side_effect=_get_client), \
            patch("orchestrator.get_default_manager", return_value=MagicMock()), \
            patch("orchestrator.parse_listing_message", new=parse):
        outcome = orchestrator.handle_message(_payload())
    assert outcome == "personal_not_listing", "sayaç yazımı başarısızken sonuç değişmemeli"
    # RPC denendi (mock çağrıyı kaydeder), hata yutuldu.
    assert _bump_calls(client_holder["client"]) == ["personal_not_listing"]


# ---------------------------------------------------------------------------
# EML-107 / KVKK (atdd AC-S4): parse'tan ÖNCE seçim doğrulaması
# supabase_client.is_group_selected -> wa_group_selection; seçili değilse parse (Gemini) YOK.
# ---------------------------------------------------------------------------

def _selection_client(data=None, error=None):
    """table().select().eq().eq().limit().execute() zinciri; data veya hata döndürür."""
    chain = MagicMock(name="selection_chain")
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    if error is not None:
        chain.execute.side_effect = error
    else:
        chain.execute.return_value.data = data
    client = MagicMock(name="client")
    client.table.return_value = chain
    return client, chain


def test_is_group_selected_true_when_row_exists():
    client, chain = _selection_client(data=[{"group_jid": GROUP_JID}])
    assert supabase_client.is_group_selected(client, AGENT_A, GROUP_JID) is True
    client.table.assert_called_once_with("wa_group_selection")
    chain.eq.assert_any_call("agent_id", AGENT_A)
    chain.eq.assert_any_call("group_jid", GROUP_JID)
    chain.limit.assert_called_once_with(1)


def test_is_group_selected_false_when_no_row():
    client, _chain = _selection_client(data=[])
    assert supabase_client.is_group_selected(client, AGENT_A, GROUP_JID) is False


def test_is_group_selected_empty_jid_returns_false_without_query():
    client, _chain = _selection_client(data=[{"group_jid": GROUP_JID}])
    assert supabase_client.is_group_selected(client, AGENT_A, None) is False
    assert supabase_client.is_group_selected(client, AGENT_A, "") is False
    client.table.assert_not_called()


def test_is_group_selected_propagates_query_error():
    client, _chain = _selection_client(error=RuntimeError("db down"))
    with pytest.raises(RuntimeError):
        supabase_client.is_group_selected(client, AGENT_A, GROUP_JID)


def _run_selection(payload, *, selected=True, selection_side_effect=None, parse_return=None):
    """Seçim kontrolü + parse mock'u; handle_message sonucu, client ve parse mock'u döner."""
    client = MagicMock(name="client")
    parse = AsyncMock(return_value=parse_return)
    selection = MagicMock(name="is_group_selected", return_value=selected)
    if selection_side_effect is not None:
        selection.side_effect = selection_side_effect
    ingest = MagicMock(name="ingest_personal_listing", return_value="approved")
    patches = [
        patch("orchestrator.get_client", return_value=client),
        patch("orchestrator.get_default_manager", return_value=MagicMock()),
        patch("orchestrator.is_group_selected", new=selection),
        patch("orchestrator.parse_listing_message", new=parse),
        patch("orchestrator.compute_fingerprint", return_value="fp-sel"),
        patch("orchestrator.score_listing", return_value=(0.9, [])),
        patch("orchestrator.ingest_personal_listing", new=ingest),
        patch("orchestrator.insert_raw_listing", new=MagicMock(return_value=({"id": "r"}, True))),
    ]
    for p in patches:
        p.start()
    try:
        outcome = orchestrator.handle_message(payload)
    finally:
        for p in reversed(patches):
            p.stop()
    return outcome, client, parse, ingest, selection


def test_unselected_group_never_calls_parse_and_counts_once():
    outcome, client, parse, ingest, selection = _run_selection(_payload(), selected=False)
    assert outcome == "personal_unselected"
    parse.assert_not_called()
    ingest.assert_not_called()
    selection.assert_called_once_with(client, AGENT_A, GROUP_JID)
    assert _bump_calls(client) == ["personal_unselected"], "tek sayım: yalnız orchestrator bump'ı"


def test_selection_query_error_never_calls_parse_and_counts_error_without_text(caplog):
    caplog.set_level(logging.DEBUG)
    with patch.object(orchestrator.logger, "exception") as log_exc:
        outcome, client, parse, ingest, _selection = _run_selection(
            _payload(), selection_side_effect=RuntimeError(f"secret-db-detail {RAW_TEXT}")
        )
    assert outcome == "personal_selection_check_error"
    parse.assert_not_called()
    ingest.assert_not_called()
    assert _bump_calls(client) == ["personal_selection_check_error"]
    assert RAW_TEXT not in caplog.text, "metin loglanmamalı"
    assert "secret-db-detail" not in caplog.text, "hata metni loglanmamalı"
    assert log_exc.call_count == 0, "traceback (içerik taşıyabilir) loglanmamalı"


def test_selected_group_still_parses_and_ingests():
    """Pozitif kontrol: seçili grupta akış eskisi gibi parse + ingest yapar."""
    outcome, _client, parse, ingest, _selection = _run_selection(
        _payload(), selected=True, parse_return={"ilce": "Kadıköy"}
    )
    parse.assert_called_once()
    assert ingest.call_count == 1
    assert outcome == "personal_auto_approved"
