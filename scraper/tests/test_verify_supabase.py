# -*- coding: utf-8 -*-
"""scraper/scripts/verify_supabase.py için testler (ATDD AC-2, AC-3, AC-4).

Katmanlar:
  - Unit (mock'lu, network yok): PASS/FAIL karar mantığı saf fonksiyonlar
    üzerinden + I/O sarmalayıcıları MagicMock client ile.
  - Integration (@pytest.mark.integration): gerçek Supabase projesi gerektirir;
    varsayılan olarak atlanır (bkz. tests/conftest.py).

Not: verify_supabase.py henüz yazılmadı. Bu dosya ilk çalıştırmada
ModuleNotFoundError ile başarısız olmalı (red step).
"""

from unittest.mock import MagicMock

import pytest

from scripts.verify_supabase import (
    REQUIRED_RPCS,
    REQUIRED_TABLES,
    check_rls_rejection,
    check_schema,
    check_write_read,
    describe_write_read,
    evaluate_rls_rejection,
    evaluate_schema,
    evaluate_write_read,
    overall_verdict,
    schema_missing,
)


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------

def full_schema_result():
    return {
        "tables": list(REQUIRED_TABLES),
        "is_admin": True,
        "rpcs": list(REQUIRED_RPCS),
    }


def empty_schema_result():
    return {"tables": [], "is_admin": False, "rpcs": []}


def ok_write_read(written_id="test-id-1"):
    return {
        "status": "ok",
        "written_id": written_id,
        "row": {"id": written_id},
        "error": None,
        "cleaned": True,
    }


def empty_write_read(written_id="test-id-1"):
    return {
        "status": "empty",
        "written_id": written_id,
        "row": None,
        "error": None,
        "cleaned": True,
    }


def error_write_read(written_id="test-id-1"):
    return {
        "status": "error",
        "written_id": written_id,
        "row": None,
        "error": "APIError: connection reset",
        "cleaned": False,
    }


# ---------------------------------------------------------------------------
# AC-2: şema smoke check — saf karar mantığı
# ---------------------------------------------------------------------------

def test_schema_full_result_is_pass():
    assert evaluate_schema(full_schema_result()) is True


def test_schema_required_tables_are_the_six_expected():
    assert set(REQUIRED_TABLES) == {
        "agents",
        "subscriptions",
        "raw_listings",
        "listings",
        "properties",
        "property_videos",
    }
    assert set(REQUIRED_RPCS) == {"approve_raw_listing", "reject_raw_listing"}


def test_schema_partial_missing_one_table_is_fail():
    """Kısmi başarı (schema): 6 tablodan 5'i var, biri eksik -> FAIL."""
    result = full_schema_result()
    result["tables"] = [t for t in REQUIRED_TABLES if t != "property_videos"]
    assert evaluate_schema(result) is False


def test_schema_partial_only_some_tables_is_fail():
    """Kısmi başarı (schema): sadece birkaç tablo var -> FAIL."""
    result = full_schema_result()
    result["tables"] = ["agents", "raw_listings"]
    assert evaluate_schema(result) is False


def test_schema_missing_is_admin_column_is_fail():
    result = full_schema_result()
    result["is_admin"] = False
    assert evaluate_schema(result) is False


def test_schema_missing_one_rpc_is_fail():
    result = full_schema_result()
    result["rpcs"] = ["approve_raw_listing"]
    assert evaluate_schema(result) is False


def test_schema_nothing_found_is_fail_not_silent_pass():
    """'Hiçbir şey yapılamadı ama hata da yok' (schema): hiçbir tablo/RPC
    bulunamadıysa script sessizce PASS dönmemeli."""
    assert evaluate_schema(empty_schema_result()) is False


def test_schema_missing_lists_exact_missing_items():
    result = full_schema_result()
    result["tables"] = [t for t in REQUIRED_TABLES if t not in ("listings", "agents")]
    result["is_admin"] = False
    result["rpcs"] = ["reject_raw_listing"]
    missing = schema_missing(result)
    assert set(missing) == {"listings", "agents", "agents.is_admin", "approve_raw_listing"}


def test_schema_missing_on_full_result_is_empty():
    assert schema_missing(full_schema_result()) == []


# ---------------------------------------------------------------------------
# AC-3: yaz-oku-sil — saf karar mantığı
# ---------------------------------------------------------------------------

def test_write_read_ok_with_matching_id_is_pass():
    assert evaluate_write_read(ok_write_read("abc")) is True


def test_write_read_row_none_is_fail():
    """Okunan satır None (status 'empty') -> FAIL."""
    outcome = ok_write_read("abc")
    outcome["status"] = "empty"
    outcome["row"] = None
    assert evaluate_write_read(outcome) is False


def test_write_read_empty_status_is_fail():
    assert evaluate_write_read(empty_write_read()) is False


def test_write_read_exception_is_fail():
    """Okuma exception fırlattı (status 'error') -> FAIL. Boş sonuçtan AYRI senaryo."""
    assert evaluate_write_read(error_write_read()) is False


def test_write_read_id_mismatch_is_fail():
    outcome = ok_write_read("abc")
    outcome["row"] = {"id": "someone-else"}
    assert evaluate_write_read(outcome) is False


def test_write_read_not_cleaned_is_fail():
    """Kayıt okunduysa da silinmediyse test kaydı kalır -> FAIL."""
    outcome = ok_write_read("abc")
    outcome["cleaned"] = False
    assert evaluate_write_read(outcome) is False


def test_describe_write_read_distinguishes_empty_from_error():
    """Boş sonuç ve hata, raporda birbirinden ayırt edilebilmeli."""
    empty_report = describe_write_read(empty_write_read())
    error_report = describe_write_read(error_write_read())
    assert empty_report != error_report
    assert "EMPTY" in empty_report
    assert "ERROR" in error_report
    assert "connection reset" in error_report


def test_empty_and_error_both_fail_as_separate_scenarios():
    """Boş sonuç ve exception AYRI senaryolar; ikisi de aynı FAIL kararına varır
    ama raporlama farklı kalır."""
    assert evaluate_write_read(empty_write_read()) is False
    assert evaluate_write_read(error_write_read()) is False
    assert describe_write_read(empty_write_read()) != describe_write_read(error_write_read())


# ---------------------------------------------------------------------------
# AC-4: RLS reddi — saf karar mantığı
# ---------------------------------------------------------------------------

def test_rls_insert_succeeded_is_fail():
    """RLS reddetmeliydi; insert başarılıysa FAIL (hata text'i olsa bile)."""
    assert evaluate_rls_rejection(insert_succeeded=True, error_text=None) is False
    assert evaluate_rls_rejection(insert_succeeded=True, error_text="42501") is False


def test_rls_rejected_with_42501_is_pass():
    assert (
        evaluate_rls_rejection(
            insert_succeeded=False,
            error_text='{"code": "42501", "message": "new row violates row-level security policy"}',
        )
        is True
    )


def test_rls_rejected_with_row_level_security_message_is_pass():
    assert (
        evaluate_rls_rejection(
            insert_succeeded=False,
            error_text="new row violates row-level security policy for table raw_listings",
        )
        is True
    )


def test_rls_failed_with_network_error_is_fail():
    """Ağ/timeout hatası RLS reddi kanıtı değildir -> FAIL."""
    assert (
        evaluate_rls_rejection(
            insert_succeeded=False,
            error_text="dial tcp: i/o timeout",
        )
        is False
    )


def test_rls_failed_without_error_text_is_fail():
    assert evaluate_rls_rejection(insert_succeeded=False, error_text=None) is False


# ---------------------------------------------------------------------------
# Genel karar: kısmi başarı ve sessiz başarı
# ---------------------------------------------------------------------------

def test_overall_all_pass_is_pass():
    assert overall_verdict(True, True, True) is True


def test_partial_success_overall_is_fail():
    """Kısmi başarı: schema ve RLS geçti, yaz-oku-sil başarısız -> genel FAIL."""
    schema_ok = evaluate_schema(full_schema_result())
    wr_ok = evaluate_write_read(empty_write_read())
    rls_ok = evaluate_rls_rejection(insert_succeeded=False, error_text="42501")
    assert overall_verdict(schema_ok, wr_ok, rls_ok) is False


def test_partial_schema_overall_is_fail():
    """Kısmi başarı (6 tablodan biri eksik): genel FAIL."""
    partial = full_schema_result()
    partial["tables"] = list(REQUIRED_TABLES)[:-1]
    schema_ok = evaluate_schema(partial)
    wr_ok = evaluate_write_read(ok_write_read("x"))
    rls_ok = evaluate_rls_rejection(insert_succeeded=False, error_text="42501")
    assert overall_verdict(schema_ok, wr_ok, rls_ok) is False


def test_nothing_done_but_no_error_is_not_silent_pass():
    """'Hiçbir şey yapılamadı ama hata da yok': tüm sorgular boş döner,
    hiçbir exception yok. Genel karar PASS OLMAMALI (sessiz başarı yasak)."""
    schema_ok = evaluate_schema(empty_schema_result())
    wr_ok = evaluate_write_read(empty_write_read())
    # RLS: insert hiç hata vermeden başarılı olsaydı zaten FAIL; burada
    # hata yok ama insert da yapılmadı senaryosu -> error_text None.
    rls_ok = evaluate_rls_rejection(insert_succeeded=False, error_text=None)
    assert overall_verdict(schema_ok, wr_ok, rls_ok) is False


# ---------------------------------------------------------------------------
# I/O sarmalayıcıları — MagicMock client (network yok)
# Beklenen zincir: table(x).insert(d).execute(),
#                  table(x).select("*").eq("id", id).execute(),
#                  table(x).delete().eq("id", id).execute()
# ---------------------------------------------------------------------------

def _client_for_write_read(select_rows=None, select_exc=None,
                           insert_exc=None, delete_exc=None):
    client = MagicMock(name="service_client")
    table = MagicMock(name="table")
    client.table.return_value = table

    insert_exec = table.insert.return_value.execute
    if insert_exc:
        insert_exec.side_effect = insert_exc
    else:
        insert_exec.return_value = MagicMock(data=[{}])

    select_exec = table.select.return_value.eq.return_value.execute
    if select_exc:
        select_exec.side_effect = select_exc
    else:
        select_exec.return_value = MagicMock(data=select_rows or [])

    delete_exec = table.delete.return_value.eq.return_value.execute
    if delete_exc:
        delete_exec.side_effect = delete_exc
    else:
        delete_exec.return_value = MagicMock(data=[])
    return client


def test_check_write_read_roundtrip_ok_returns_ok_status():
    # select'in döndürdüğü satır, insert'te gönderilen id ile eşleşmeli.
    # Bu yüzden client'ı insert payload'ını yakalayacak şekilde kuruyoruz.
    captured = {}

    client = _client_for_write_read()

    def capture_insert(payload):
        captured["id"] = payload.get("id")
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": payload.get("id")}]
        )
        return client.table.return_value.insert.return_value

    client.table.return_value.insert.side_effect = capture_insert

    outcome = check_write_read(client)
    assert outcome["status"] == "ok"
    assert outcome["row"] is not None
    assert outcome["row"]["id"] == outcome["written_id"]
    assert outcome["cleaned"] is True
    assert evaluate_write_read(outcome) is True


def test_check_write_read_empty_select_gives_empty_status():
    client = _client_for_write_read(select_rows=[])
    outcome = check_write_read(client)
    assert outcome["status"] == "empty"
    assert outcome["row"] is None
    assert evaluate_write_read(outcome) is False


def test_check_write_read_select_exception_gives_error_status():
    client = _client_for_write_read(select_exc=RuntimeError("boom: select"))
    outcome = check_write_read(client)
    assert outcome["status"] == "error"
    assert "boom: select" in (outcome["error"] or "")
    assert evaluate_write_read(outcome) is False


def test_check_write_read_insert_exception_gives_error_status():
    client = _client_for_write_read(insert_exc=RuntimeError("42501 denied"))
    outcome = check_write_read(client)
    assert outcome["status"] == "error"
    assert evaluate_write_read(outcome) is False


def test_check_write_read_delete_failure_marks_not_cleaned():
    captured = {}
    client = _client_for_write_read(delete_exc=RuntimeError("delete failed"))

    def capture_insert(payload):
        captured["id"] = payload.get("id")
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"id": payload.get("id")}]
        )
        return client.table.return_value.insert.return_value

    client.table.return_value.insert.side_effect = capture_insert

    outcome = check_write_read(client)
    assert outcome["cleaned"] is False
    assert evaluate_write_read(outcome) is False


def test_check_rls_rejection_insert_denied_returns_error_text():
    anon = MagicMock(name="anon_client")
    anon.table.return_value.insert.return_value.execute.side_effect = RuntimeError(
        '{"code": "42501", "message": "new row violates row-level security policy"}'
    )
    outcome = check_rls_rejection(anon)
    assert outcome["insert_succeeded"] is False
    assert "42501" in outcome["error"]
    assert evaluate_rls_rejection(outcome["insert_succeeded"], outcome["error"]) is True


def test_check_rls_rejection_insert_succeeded_is_fail():
    anon = MagicMock(name="anon_client")
    anon.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])
    outcome = check_rls_rejection(anon)
    assert outcome["insert_succeeded"] is True
    assert evaluate_rls_rejection(outcome["insert_succeeded"], outcome["error"]) is False


def test_check_schema_missing_table_query_raises_is_reported_missing():
    """Tablo sorgusu exception fırlatırsa o tablo 'tables' listesinde olmamalı."""
    client = MagicMock(name="service_client")

    def table(name):
        q = MagicMock(name=f"q_{name}")
        if name == "listings":
            q.select.return_value.limit.return_value.execute.side_effect = RuntimeError(
                "relation does not exist"
            )
        else:
            q.select.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        return q

    client.table.side_effect = table
    result = check_schema(client)
    assert "listings" not in result["tables"]
    assert "agents" in result["tables"]
    assert evaluate_schema(result) is False


# ---------------------------------------------------------------------------
# Integration — gerçek Supabase projesi gerektirir (varsayılan: atlanır)
# Gerekli ortam: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
# ---------------------------------------------------------------------------

def _require_env(*names):
    import os

    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        pytest.skip(f"integration: eksik ortam değişkeni: {', '.join(missing)}")


@pytest.mark.integration
def test_integration_schema_check_passes_on_real_project():
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from supabase_client import get_client

    result = check_schema(get_client())
    assert evaluate_schema(result) is True, f"eksik: {schema_missing(result)}"


@pytest.mark.integration
def test_integration_write_read_roundtrip_on_real_project():
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from supabase_client import get_client

    outcome = check_write_read(get_client())
    assert evaluate_write_read(outcome) is True, describe_write_read(outcome)


@pytest.mark.integration
def test_integration_anon_insert_rejected_by_rls_on_real_project():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY")
    import os

    from supabase import create_client

    anon = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    outcome = check_rls_rejection(anon)
    assert evaluate_rls_rejection(outcome["insert_succeeded"], outcome["error"]) is True
