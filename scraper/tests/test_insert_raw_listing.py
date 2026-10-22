# -*- coding: utf-8 -*-
"""scraper/supabase_client.py insert_raw_listing testleri (ATDD EML-54,
AC-1..AC-5, plan.md'nin teknik notu: try/except 23505 deseni).

Katmanlar:
  - Unit (mock'lu, network yok): başarılı insert, 23505 (unique-violation)
    sessizce yutulur, 23505 DIŞINDA bir hata yukarı fırlatılır.
  - Integration (@pytest.mark.integration): gerçek Supabase projesine karşı
    gerçek eşzamanlılık + migration'ın partial unique index'i gerçekten
    oluşturduğu doğrulaması; varsayılan olarak atlanır (bkz. conftest.py).

Not: insert_raw_listing henüz atomik upsert/try-except 23505 desenine
dönüştürülmedi (mevcut hali basit bir .insert().execute(), dönüş değeri
sadece dict, "inserted" bilgisi yok). Bu testlerin BAŞARISIZ (red) olması
BEKLENİR — code-copilot bunu yeşile çevirecek.

Dönüş değeri şekli (plan.md'de kesinleşmedi) code-copilot'un seçimine
bırakıldı: tuple (record, inserted) veya dict içine {"inserted": bool}
eklenmiş hali olabilir. `_get_inserted` yardımcı fonksiyonu her iki şekli
de destekler.
"""

import os
import threading
import time
from unittest.mock import MagicMock

import pytest
from postgrest.exceptions import APIError

from supabase_client import insert_raw_listing

UNIQUE_VIOLATION_CODE = "23505"


def _get_inserted(result):
    """insert_raw_listing'in dönüş değerinden 'inserted' bool'unu çıkarır.

    code-copilot'un seçtiği şekle (tuple ya da dict) esnek kalır — ama
    bir şekilde true/false ayrımı test edilebilir olmalı ilkesinden
    ödün vermez.
    """
    if isinstance(result, tuple) and len(result) == 2:
        return result[1]
    if isinstance(result, dict) and "inserted" in result:
        return result["inserted"]
    pytest.fail(
        f"insert_raw_listing dönüş değerinden 'inserted' bilgisi çıkarılamadı: {result!r}"
    )


def _sample_record(fingerprint="fp-sample-1"):
    return {
        "source": "whatsapp",
        "source_group": "905551234567-1111@g.us",
        "source_message_id": "msg-1",
        "raw_text": "örnek ilan metni",
        "parsed": {"ilce": "Kadıköy", "fiyat": 1000000},
        "fingerprint": fingerprint,
        "quality_score": 0.8,
        "status": "pending",
    }


def _mock_client_with_execute(*, data=None, side_effect=None):
    """client.table("raw_listings").insert(record).execute() zincirini mock'lar."""
    client = MagicMock()
    execute_mock = client.table.return_value.insert.return_value.execute
    if side_effect is not None:
        execute_mock.side_effect = side_effect
    else:
        result = MagicMock()
        result.data = data if data is not None else []
        execute_mock.return_value = result
    return client


# ---------------------------------------------------------------------------
# AC-1/AC-4: ilk insert başarılı -> inserted=True, kayıt döner
# ---------------------------------------------------------------------------

def test_first_insert_succeeds_returns_inserted_true():
    record = _sample_record()
    inserted_row = {"id": "row-1", **record}
    client = _mock_client_with_execute(data=[inserted_row])

    result = insert_raw_listing(client, record)

    assert _get_inserted(result) is True


# ---------------------------------------------------------------------------
# AC-2: aynı fingerprint ikinci insert denemesi (23505) -> exception YOK,
# inserted=False
# ---------------------------------------------------------------------------

def test_duplicate_fingerprint_unique_violation_is_swallowed_returns_inserted_false():
    record = _sample_record(fingerprint="fp-duplicate")
    client = _mock_client_with_execute(
        side_effect=APIError(
            {
                "message": "duplicate key value violates unique constraint "
                '"raw_listings_fingerprint_unique_idx"',
                "code": UNIQUE_VIOLATION_CODE,
                "hint": None,
                "details": None,
            }
        )
    )

    result = insert_raw_listing(client, record)

    assert _get_inserted(result) is False


# ---------------------------------------------------------------------------
# AC-5: 23505 DIŞINDA bir hata -> exception YUKARI FIRLATILIR, yutulmaz
# ---------------------------------------------------------------------------

def test_non_unique_violation_api_error_is_not_swallowed_raises():
    record = _sample_record(fingerprint="fp-other-error")
    client = _mock_client_with_execute(
        side_effect=APIError(
            {
                "message": "permission denied for table raw_listings",
                "code": "42501",
                "hint": None,
                "details": None,
            }
        )
    )

    with pytest.raises(APIError):
        insert_raw_listing(client, record)


def test_generic_connection_error_is_not_swallowed_raises():
    """'Her hata = mükerrer' varsayımı YASAK — gerçek bir bağlantı hatası da
    yukarı fırlatılmalı, sessizce inserted=False'a dönüştürülmemeli."""
    record = _sample_record(fingerprint="fp-connection-error")
    client = _mock_client_with_execute(side_effect=ConnectionError("network unreachable"))

    with pytest.raises(ConnectionError):
        insert_raw_listing(client, record)


# ---------------------------------------------------------------------------
# AC-4 (regresyon): farklı fingerprint'lerin insert'i normal şekilde yazılır
# ---------------------------------------------------------------------------

def test_different_fingerprints_both_insert_successfully():
    client_a = _mock_client_with_execute(data=[{"id": "row-a", **_sample_record("fp-a")}])
    client_b = _mock_client_with_execute(data=[{"id": "row-b", **_sample_record("fp-b")}])

    result_a = insert_raw_listing(client_a, _sample_record("fp-a"))
    result_b = insert_raw_listing(client_b, _sample_record("fp-b"))

    assert _get_inserted(result_a) is True
    assert _get_inserted(result_b) is True


# ---------------------------------------------------------------------------
# Integration — gerçek Supabase projesi gerektirir (varsayılan: atlanır)
# Gerekli ortam: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# ---------------------------------------------------------------------------

def _require_env(*names):
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        pytest.skip(f"integration: eksik ortam değişkeni: {', '.join(missing)}")


@pytest.mark.integration
def test_integration_concurrent_inserts_with_same_fingerprint_result_in_one_row():
    """AC-3: GERÇEK eşzamanlılık — iki thread, aynı fingerprint'i aynı anda
    insert etmeye çalışır; DB'de sadece BİR satır oluşmalı."""
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from supabase_client import get_client

    client = get_client()
    fingerprint = f"fp-race-{int(time.time() * 1000)}"
    results = []
    barrier = threading.Barrier(2)

    def worker():
        barrier.wait()
        record = _sample_record(fingerprint)
        record["source_message_id"] = f"race-{threading.get_ident()}"
        results.append(insert_raw_listing(client, record))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    inserted_flags = [_get_inserted(r) for r in results]
    assert sum(1 for f in inserted_flags if f) == 1, (
        "Aynı fingerprint'e eşzamanlı iki insert'ten TAM BİR tanesi başarılı olmalı"
    )

    rows = (
        client.table("raw_listings")
        .select("id")
        .eq("fingerprint", fingerprint)
        .execute()
    )
    assert len(rows.data) == 1, "DB'de bu fingerprint için TAM BİR satır olmalı"


@pytest.mark.integration
def test_integration_fingerprint_partial_unique_index_exists_on_real_project():
    """AC-1: migration'ın gerçekten çalıştığını ve information_schema/
    pg_indexes'te partial unique index'in (status <> 'rejected' koşuluyla)
    var olduğunu doğrular."""
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from supabase_client import get_client

    client = get_client()
    result = client.rpc(
        "sql",
        {
            "query": (
                "select indexdef from pg_indexes "
                "where tablename = 'raw_listings' "
                "and indexname = 'raw_listings_fingerprint_unique_idx'"
            )
        },
    ).execute()

    rows = result.data or []
    assert len(rows) == 1, "raw_listings_fingerprint_unique_idx bulunamadı"
    indexdef = rows[0].get("indexdef", "")
    assert "UNIQUE" in indexdef.upper()
    assert "fingerprint" in indexdef
    assert "status" in indexdef and "rejected" in indexdef
