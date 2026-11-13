# -*- coding: utf-8 -*-
"""Red-team tur 1 - AC-10 (altyapı hataları kayıp sayılmaz) ve AC-S5 (hata dallarında içerik/traceback yok).

GERÇEK handle_message kullanılır; mock'lanan yalnız supabase_client fonksiyonları, parse ve anahtar
yöneticisidir. process_entry üzerinden: kayıt silinmemeli (pending, attempts 1); nihai sonuçlar silinmeli.

Bu dosya KIRMIZI beklenir: orchestrator.RetryableError ve yeni hata yönetimi henüz yok; mevcut
handle_message altyapı hatalarını yutup None döndürüyor.
"""

import logging
import time
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import orchestrator
from durable_queue import DurableQueue

AGENT_A = "11111111-2222-4333-8444-555555555555"
GROUP = "120363000000000001@g.us"
RAW_TEXT = "INFRA-GIZLI-METIN 3+1 Kadıköy 5321234512"
SECRET_DETAIL = "GIZLI-0532-111"
PARSED = {"ilce": "Kadıköy", "fiyat": 1000000}
EMPTY = {"pending": 0, "processing": 0, "failed": 0}
FAR_FUTURE = 10**7


@pytest.fixture(autouse=True)
def inbox(monkeypatch, tmp_path):
    queue = DurableQueue(str(tmp_path / "inbox.sqlite3"))
    monkeypatch.setattr(orchestrator, "inbox", queue, raising=False)
    return queue


def _payload(**extra):
    base = {"id": "infra-1", "text": RAW_TEXT, "group": GROUP, "groupName": "Kadıköy Emlak"}
    base.update(extra)
    return base


def _enqueue_and_claim(queue, payload):
    queue.enqueue(payload, time.time())
    claimed = queue.claim_due(10, time.time() + FAR_FUTURE)
    assert len(claimed) == 1
    return claimed[0]


def _assert_kept_for_retry(queue, before):
    """Kayıt silinmedi: pending, attempts 1 (ilk backoff 60 sn)."""
    assert queue.counts() == {"pending": 1, "processing": 0, "failed": 0}
    assert queue.claim_due(10, before + 59) == []
    assert len(queue.claim_due(10, before + 65)) == 1


def _common(stack, *, parse_result=PARSED, client_side_effect=None, fingerprint_result=False,
            fingerprint_side_effect=None, insert_side_effect=None):
    stack.enter_context(patch("orchestrator.get_client", return_value=MagicMock(), side_effect=client_side_effect))
    stack.enter_context(patch("orchestrator.get_default_manager", return_value=MagicMock()))
    parse = stack.enter_context(patch("orchestrator.parse_listing_message", new=AsyncMock(return_value=parse_result)))
    stack.enter_context(patch("orchestrator.compute_fingerprint", return_value="fp-infra"))
    stack.enter_context(patch("orchestrator.fingerprint_exists", return_value=fingerprint_result,
                              side_effect=fingerprint_side_effect))
    stack.enter_context(patch("orchestrator.score_listing", return_value=(0.9, [])))
    stack.enter_context(patch("orchestrator.insert_raw_listing", return_value=({"id": "row-1"}, True),
                              side_effect=insert_side_effect))
    return parse


def _personal(stack, *, selected=True, selected_side_effect=None, ingest_result="approved",
              ingest_side_effect=None):
    stack.enter_context(patch("orchestrator.get_client", return_value=MagicMock()))
    stack.enter_context(patch("orchestrator.get_default_manager", return_value=MagicMock()))
    selection = stack.enter_context(patch("orchestrator.is_group_selected", return_value=selected,
                                          side_effect=selected_side_effect))
    parse = stack.enter_context(patch("orchestrator.parse_listing_message", new=AsyncMock(return_value=PARSED)))
    stack.enter_context(patch("orchestrator.compute_fingerprint", return_value="fp-infra"))
    stack.enter_context(patch("orchestrator.score_listing", return_value=(0.9, [])))
    ingest = stack.enter_context(patch("orchestrator.ingest_personal_listing", return_value=ingest_result,
                                       side_effect=ingest_side_effect))
    bump = stack.enter_context(patch("orchestrator.bump_sidecar_counter"))
    return selection, parse, ingest, bump


def _counted(bump):
    return [call.args[1] for call in bump.call_args_list]


# ---------------------------------------------------------------------------
# AC-10: ortak yol altyapı hataları -> kayıt pending (silinmez)
# ---------------------------------------------------------------------------


def test_common_get_client_error_keeps_row_for_retry(inbox):
    with ExitStack() as stack:
        _common(stack, client_side_effect=RuntimeError("db-down"))
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        before = time.time()
        orchestrator.process_entry(row_id, payload)
    _assert_kept_for_retry(inbox, before)


def test_common_fingerprint_error_raises_retryable_and_keeps_row(inbox):
    with ExitStack() as stack:
        _common(stack, fingerprint_side_effect=RuntimeError("db-down"))
        with pytest.raises(orchestrator.RetryableError):
            orchestrator.handle_message(_payload())
    with ExitStack() as stack:
        _common(stack, fingerprint_side_effect=RuntimeError("db-down"))
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        before = time.time()
        orchestrator.process_entry(row_id, payload)
    _assert_kept_for_retry(inbox, before)


def test_common_insert_error_keeps_row_for_retry(inbox):
    with ExitStack() as stack:
        _common(stack, insert_side_effect=RuntimeError("insert-down"))
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        before = time.time()
        orchestrator.process_entry(row_id, payload)
    _assert_kept_for_retry(inbox, before)


# ---------------------------------------------------------------------------
# AC-10: kişisel yol altyapı hataları -> kayıt pending; seçim hatasında Gemini'ye gidilmez
# ---------------------------------------------------------------------------


def test_personal_selection_error_keeps_row_skips_parse_and_counts(inbox):
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _selection, parse, _ingest, bump = _personal(stack, selected_side_effect=RuntimeError("db-down"))
        with pytest.raises(orchestrator.RetryableError):
            orchestrator.handle_message(payload)
        parse.assert_not_called()
        assert "personal_selection_check_error" in _counted(bump)

    with ExitStack() as stack:
        _personal(stack, selected_side_effect=RuntimeError("db-down"))
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        before = time.time()
        orchestrator.process_entry(row_id, claimed)
    _assert_kept_for_retry(inbox, before)


def test_personal_ingest_error_keeps_row_and_counts_write_error(inbox):
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _selection, _parse, _ingest, bump = _personal(stack, ingest_side_effect=RuntimeError("rpc-down"))
        with pytest.raises(orchestrator.RetryableError):
            orchestrator.handle_message(payload)
        assert "personal_write_error" in _counted(bump)

    with ExitStack() as stack:
        _personal(stack, ingest_side_effect=RuntimeError("rpc-down"))
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        before = time.time()
        orchestrator.process_entry(row_id, claimed)
    _assert_kept_for_retry(inbox, before)


# ---------------------------------------------------------------------------
# Regresyon: nihai sonuçlar kayıt silinmesi (complete)
# ---------------------------------------------------------------------------


def test_regression_common_not_listing_is_deleted(inbox):
    with ExitStack() as stack:
        _common(stack, parse_result=None)
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        orchestrator.process_entry(row_id, payload)
    assert inbox.counts() == EMPTY


def test_regression_common_duplicate_is_deleted(inbox):
    with ExitStack() as stack:
        _common(stack, fingerprint_result=True)
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        orchestrator.process_entry(row_id, payload)
    assert inbox.counts() == EMPTY


def test_regression_common_written_is_deleted(inbox):
    with ExitStack() as stack:
        _common(stack)
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        orchestrator.process_entry(row_id, payload)
    assert inbox.counts() == EMPTY


def test_regression_personal_unselected_is_deleted_and_counted(inbox):
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _selection, parse, _ingest, bump = _personal(stack, selected=False)
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        orchestrator.process_entry(row_id, claimed)
        parse.assert_not_called()
        assert "personal_unselected" in _counted(bump)
    assert inbox.counts() == EMPTY


def test_regression_personal_approved_is_deleted(inbox):
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _personal(stack, ingest_result="approved")
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        orchestrator.process_entry(row_id, claimed)
    assert inbox.counts() == EMPTY


# ---------------------------------------------------------------------------
# AC-S5: hata dallarında traceback ve exception metni (gizli içerik) loglanmaz
# ---------------------------------------------------------------------------


def _assert_no_leak(caplog):
    assert "Traceback" not in caplog.text, "traceback loglanmamalı"
    assert SECRET_DETAIL not in caplog.text, "exception metni loglanmamalı"
    assert RAW_TEXT not in caplog.text, "mesaj metni loglanmamalı"


def test_common_db_error_logs_no_traceback_or_exception_text(inbox, caplog):
    caplog.set_level(logging.DEBUG)
    with ExitStack() as stack:
        _common(stack, fingerprint_side_effect=RuntimeError(f"db {SECRET_DETAIL} {RAW_TEXT}"))
        row_id, payload = _enqueue_and_claim(inbox, _payload())
        orchestrator.process_entry(row_id, payload)
    _assert_no_leak(caplog)


def test_personal_write_error_logs_no_traceback_or_exception_text(inbox, caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _personal(stack, ingest_side_effect=RuntimeError(f"rpc {SECRET_DETAIL} {RAW_TEXT}"))
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        orchestrator.process_entry(row_id, claimed)
    _assert_no_leak(caplog)


def test_personal_selection_error_logs_no_traceback_or_exception_text(inbox, caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _personal(stack, selected_side_effect=RuntimeError(f"sel {SECRET_DETAIL} {RAW_TEXT}"))
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        orchestrator.process_entry(row_id, claimed)
    _assert_no_leak(caplog)


# ---------------------------------------------------------------------------
# Red-team tur 2 - AC-14: kişisel yolda GeminiUnavailable DIŞINDAKİ parse hatası
# personal_parse_error sayılır ve RetryableError olarak iletilir (kayıt silinmez).
# ---------------------------------------------------------------------------


def test_personal_parse_runtime_error_raises_retryable_counts_parse_error_and_keeps_row(inbox, caplog):
    caplog.set_level(logging.DEBUG)
    payload = _payload(agentId=AGENT_A)
    with ExitStack() as stack:
        _selection, parse, _ingest, bump = _personal(stack)
        parse.side_effect = RuntimeError(f"parse {SECRET_DETAIL} {RAW_TEXT}")
        with pytest.raises(orchestrator.RetryableError):
            orchestrator.handle_message(payload)
        assert "personal_parse_error" in _counted(bump)

    with ExitStack() as stack:
        _selection, parse, _ingest, _bump = _personal(stack)
        parse.side_effect = RuntimeError(f"parse {SECRET_DETAIL} {RAW_TEXT}")
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        before = time.time()
        orchestrator.process_entry(row_id, claimed)
    _assert_kept_for_retry(inbox, before)
    _assert_no_leak(caplog)


def test_personal_key_manager_load_error_inside_parser_raises_retryable_and_keeps_row(inbox, caplog):
    """Gerçek parse_listing_message çalışır; key_manager.load_keys exception atar.
    Gemini istemcisi hiç kurulmaz; sonuç yukarıdakiyle aynıdır."""
    caplog.set_level(logging.DEBUG)
    payload = _payload(agentId=AGENT_A)
    key_manager = MagicMock(name="key_manager")
    key_manager.load_keys.side_effect = RuntimeError(f"keys {SECRET_DETAIL} {RAW_TEXT}")

    def _enter(stack):
        stack.enter_context(patch("orchestrator.get_client", return_value=MagicMock()))
        stack.enter_context(patch("orchestrator.get_default_manager", return_value=key_manager))
        stack.enter_context(patch("orchestrator.is_group_selected", return_value=True))
        stack.enter_context(patch("orchestrator.compute_fingerprint", return_value="fp-infra"))
        stack.enter_context(patch("orchestrator.score_listing", return_value=(0.9, [])))
        stack.enter_context(patch("orchestrator.ingest_personal_listing", return_value="approved"))
        return stack.enter_context(patch("orchestrator.bump_sidecar_counter"))

    with ExitStack() as stack:
        bump = _enter(stack)
        genai = stack.enter_context(patch("parser.genai"))
        with pytest.raises(orchestrator.RetryableError):
            orchestrator.handle_message(payload)
        genai.Client.assert_not_called()
        assert "personal_parse_error" in _counted(bump)

    with ExitStack() as stack:
        _enter(stack)
        stack.enter_context(patch("parser.genai"))
        row_id, claimed = _enqueue_and_claim(inbox, payload)
        before = time.time()
        orchestrator.process_entry(row_id, claimed)
    _assert_kept_for_retry(inbox, before)
    _assert_no_leak(caplog)
