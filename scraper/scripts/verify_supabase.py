# -*- coding: utf-8 -*-
"""Gerçek Supabase projesinin şema, yaz-oku-sil ve RLS davranışını doğrular.

Çalıştırma (scraper/ içinden, env değişkenleri export edilmiş olmalı):
    python -m scripts.verify_supabase

Gerekli ortam: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
Karar fonksiyonları saftır (I/O yok); check_* fonksiyonları client alır.
Belirsiz veya eksik kanıt her zaman FAIL sayılır.
"""

import sys
import os
import uuid

from supabase import create_client

from supabase_client import get_client

REQUIRED_TABLES = (
    "agents",
    "subscriptions",
    "raw_listings",
    "listings",
    "properties",
    "property_videos",
    "plans",
    "payment_events",
)
REQUIRED_RPCS = ("approve_raw_listing", "reject_raw_listing")

# Fonksiyonun kendi raise ettiği hata metni (0002_admin_review.sql). Bu metin
# görülürse fonksiyon vardır; PostgREST "fonksiyon yok" hatası bu metni içermez.
RPC_RAISED_MARKER = "bulunamadı"
NIL_UUID = "00000000-0000-0000-0000-000000000000"
TEST_TABLE = "raw_listings"
RLS_ERROR_MARKERS = ("42501", "row-level security")


def _test_record(record_id):
    return {
        "id": record_id,
        "source": "verify_script",
        "source_group": "verify_script",
        "source_message_id": record_id,
        "raw_text": "verify_supabase test kaydı",
        "parsed": {},
        "fingerprint": record_id,
        "quality_score": 0,
        "status": "pending",
    }


# ---------------------------------------------------------------------------
# AC-2: şema smoke check
# ---------------------------------------------------------------------------

def schema_missing(result):
    missing = [t for t in REQUIRED_TABLES if t not in result["tables"]]
    if not result["is_admin"]:
        missing.append("agents.is_admin")
    missing.extend(r for r in REQUIRED_RPCS if r not in result["rpcs"])
    return missing


def evaluate_schema(result):
    return not schema_missing(result)


def check_schema(client):
    tables = []
    for table in REQUIRED_TABLES:
        try:
            client.table(table).select("*").limit(1).execute()
        except Exception:
            continue  # sorgu başarısız -> tablo eksik sayılır
        tables.append(table)

    try:
        client.table("agents").select("is_admin").limit(1).execute()
        is_admin = True
    except Exception:
        is_admin = False

    rpcs = []
    for rpc in REQUIRED_RPCS:
        try:
            client.rpc(rpc, {"p_raw_listing_id": NIL_UUID}).execute()
        except Exception as exc:
            if RPC_RAISED_MARKER in str(exc):
                rpcs.append(rpc)  # fonksiyon çalıştı, sadece kayıt bulunamadı
            # aksi halde fonksiyon yok / erişilemedi -> eksik
        # başarılı dönerse (beklenmeyen) fonksiyon kanıtlanmamış sayılır

    return {"tables": tables, "is_admin": is_admin, "rpcs": rpcs}


# ---------------------------------------------------------------------------
# AC-3: yaz-oku-sil
# ---------------------------------------------------------------------------

def evaluate_write_read(outcome):
    if outcome["status"] == "error":
        return False
    if outcome["status"] == "empty":
        return False
    if outcome["row"]["id"] != outcome["written_id"]:
        return False
    return outcome["cleaned"] is True


def describe_write_read(outcome):
    written_id = outcome["written_id"]
    cleanup = "" if outcome["cleaned"] else " (temizlenemedi)"
    if outcome["status"] == "error":
        return f"ERROR: {outcome['error']}{cleanup}"
    if outcome["status"] == "empty":
        return f"EMPTY: id={written_id} yazıldı ama 0 satır okundu{cleanup}"
    if outcome["row"]["id"] != written_id:
        return f"MISMATCH: okunan id={outcome['row']['id']}, beklenen id={written_id}{cleanup}"
    return f"OK: id={written_id} yazıldı, okundu{'' if outcome['cleaned'] else ' ama temizlenemedi'}"


def check_write_read(client):
    written_id = str(uuid.uuid4())
    error = None
    rows = []
    try:
        client.table(TEST_TABLE).insert(_test_record(written_id)).execute()
        rows = client.table(TEST_TABLE).select("*").eq("id", written_id).execute().data
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

    cleaned = False
    try:
        client.table(TEST_TABLE).delete().eq("id", written_id).execute()
        cleaned = True
    except Exception:
        cleaned = False  # silme başarısız -> test kaydı kaldı, FAIL

    if error is not None:
        status = "error"
    elif not rows:
        status = "empty"
    else:
        status = "ok"
    return {
        "status": status,
        "written_id": written_id,
        "row": rows[0] if rows else None,
        "error": error,
        "cleaned": cleaned,
    }


# ---------------------------------------------------------------------------
# AC-4: anon ile RLS reddi
# ---------------------------------------------------------------------------

def evaluate_rls_rejection(insert_succeeded, error_text):
    if insert_succeeded:
        return False
    if error_text is None:
        return False
    return any(marker in error_text for marker in RLS_ERROR_MARKERS)


def check_rls_rejection(anon_client):
    written_id = str(uuid.uuid4())
    try:
        anon_client.table(TEST_TABLE).insert(_test_record(written_id)).execute()
    except Exception as exc:
        return {"insert_succeeded": False, "error": str(exc), "written_id": written_id}
    return {"insert_succeeded": True, "error": None, "written_id": written_id}


# ---------------------------------------------------------------------------
# Genel karar ve giriş noktası
# ---------------------------------------------------------------------------

def overall_verdict(schema_ok, write_read_ok, rls_ok):
    return schema_ok and write_read_ok and rls_ok


def main():
    service = get_client()
    schema = check_schema(service)
    write_read = check_write_read(service)

    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if anon_key:
        rls = check_rls_rejection(create_client(os.environ["SUPABASE_URL"], anon_key))
    else:
        rls = {"insert_succeeded": False, "error": "SUPABASE_ANON_KEY tanımlı değil", "written_id": None}

    schema_ok = evaluate_schema(schema)
    write_read_ok = evaluate_write_read(write_read)
    rls_ok = evaluate_rls_rejection(rls["insert_succeeded"], rls["error"])

    print(f"[AC-2] Şema: {'PASS' if schema_ok else 'FAIL'}")
    if not schema_ok:
        print(f"       Eksik: {', '.join(schema_missing(schema))}")
    print(f"[AC-3] Yaz-oku-sil: {'PASS' if write_read_ok else 'FAIL'} - {describe_write_read(write_read)}")
    print(f"[AC-4] RLS reddi: {'PASS' if rls_ok else 'FAIL'}")
    if rls["insert_succeeded"]:
        print(f"       temizlenemedi: anon insert başarılı, kayıt silinemez (RLS) id={rls['written_id']}")
    elif rls["error"] is not None and not rls_ok:
        print(f"       Hata: {rls['error']}")

    verdict = overall_verdict(schema_ok, write_read_ok, rls_ok)
    print(f"GENEL: {'PASS' if verdict else 'FAIL'}")
    return 0 if verdict else 1


if __name__ == "__main__":
    sys.exit(main())
