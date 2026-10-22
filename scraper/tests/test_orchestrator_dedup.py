# -*- coding: utf-8 -*-
"""scraper/orchestrator.py handle_message log ayrımı testleri (ATDD EML-54,
AC-6): insert_raw_listing'in yeni "inserted" dönüş değerine göre
"yazıldı" vs "mükerrer/atlandı" log satırlarının ayrımı.

ZORUNLU mock-patch kuralı: orchestrator.py `from supabase_client import
insert_raw_listing` ile import ediyor -> patch hedefi
`orchestrator.insert_raw_listing` olmalı, `supabase_client.insert_raw_listing`
DEĞİL (test edilen kodun import ettiği namespace).

Not: insert_raw_listing henüz yeni "inserted" dönüş değerini (tuple/dict)
desteklemiyor, handle_message de buna göre log ayrımı yapmıyor. Bu
testlerin BAŞARISIZ (red) olması BEKLENİR.
"""

import logging
from unittest.mock import MagicMock, patch

import pytest

import orchestrator

PAYLOAD = {"id": "msg-dedup-1", "text": "örnek ilan metni", "group": "905551234567-1@g.us"}


def _patched_pipeline(*, inserted_result, fingerprint_already_exists=False):
    """handle_message'ın insert_raw_listing'e kadar olan bağımlılıklarını
    mock'lar; sadece insert_raw_listing'in dönüş değerini (ve log ayrımını)
    test etmeye odaklanır."""
    return (
        patch("orchestrator.get_client", return_value=MagicMock()),
        patch("orchestrator.get_default_manager", return_value=MagicMock()),
        patch("orchestrator.parse_listing_message", return_value={"ilce": "Kadıköy", "fiyat": 1000000}),
        patch("orchestrator.compute_fingerprint", return_value="fp-dedup-test"),
        patch("orchestrator.fingerprint_exists", return_value=fingerprint_already_exists),
        patch("orchestrator.score_listing", return_value=(0.8, [])),
        patch("orchestrator.insert_raw_listing", return_value=inserted_result),
    )


def _run_handle_message_with_mocks(caplog, *, inserted_result):
    patchers = _patched_pipeline(inserted_result=inserted_result)
    with patchers[0], patchers[1], patchers[2], patchers[3], patchers[4], patchers[5], patchers[6]:
        with caplog.at_level(logging.INFO, logger="scraper.orchestrator"):
            orchestrator.handle_message(dict(PAYLOAD))
    return caplog.text


# ---------------------------------------------------------------------------
# AC-6: inserted=True -> log'da "yazıldı" ifadesi geçer
# ---------------------------------------------------------------------------

def test_handle_message_logs_written_when_insert_raw_listing_reports_inserted_true(caplog):
    written_log = _run_handle_message_with_mocks(caplog, inserted_result=({"id": "row-1"}, True))
    assert "yazıldı" in written_log


def test_handle_message_logs_written_vs_skipped_are_distinct(caplog):
    written_log = _run_handle_message_with_mocks(caplog, inserted_result=({"id": "row-1"}, True))
    caplog.clear()
    skipped_log = _run_handle_message_with_mocks(caplog, inserted_result=(None, False))

    assert "yazıldı" in written_log
    assert "mükerrer" in skipped_log or "atlandı" in skipped_log

    # AC-6: "yazıldı" ifadesi mükerrer/atlandı logunda geçmemeli, ikisi
    # birbirinden ayırt edilebilir olmalı (tam eşleşme değil, ayrım şart).
    assert written_log != skipped_log
    assert "yazıldı" not in skipped_log


def test_handle_message_logs_skipped_when_insert_raw_listing_reports_inserted_false(caplog):
    skipped_log = _run_handle_message_with_mocks(caplog, inserted_result=(None, False))

    assert "mükerrer" in skipped_log or "atlandı" in skipped_log
