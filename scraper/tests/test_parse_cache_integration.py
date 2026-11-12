# -*- coding: utf-8 -*-
"""parse_cache kalıcı önbelleği: gerçek Supabase testleri (ATDD gemini-parse-maliyet).

Kapsam: AC-S1 (anon erişim reddi), AC-S2 (satır şekli, ham metin yok), AC-S5 (TTL dolmuş
kayıt kullanılmaz ve retention temizliğiyle silinir), AC-S7 (authenticated JWT ile doğrudan
REST okuma/yazma), AC-3/AC-18 DB tarafı (yeniden başlatma sonrası isabet, paralel yazım).

Tüm testler gerçek Supabase projesine karşı çalışır (mock YASAK) ve `integration`
işaretlidir; varsayılan olarak atlanır (bkz. tests/conftest.py). Çalıştırmak için:
    pytest --run-integration
veya
    RUN_INTEGRATION=1 pytest

Gerekli ortam değişkenleri:
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Gemini çağrıları mock'lanır (parser.genai); gerçek API çağrısı yapılmaz.
Her test benzersiz bir MARK- işaretçisi kullanır ve teardown'da yalnız o satırları siler.

Red step: migration 0031_parse_cache.sql ve parser/supabase_client DB yolu henüz yok;
testler başarısız olmalı.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import httpx
import pytest

PARSE_CACHE_PATH = "/rest/v1/parse_cache"
FLAG = "GEMINI_PARSE_OPTIMIZATION_ENABLED"
ROW_COLUMNS = {"key", "parsed", "is_listing", "version", "created_at", "expires_at"}
FAR_FUTURE = "2099-01-01T00:00:00+00:00"
PAST = "2000-01-01T00:00:00+00:00"
CREATED = "2026-01-01T00:00:00+00:00"

PARSED_TEMPLATE = {
    "is_listing": True,
    "title": "Satılık daire",
    "price": 2500000,
    "currency": "TRY",
    "rooms": "3+1",
    "area_m2": 120,
    "city": "İstanbul",
    "district": "Kadıköy",
    "neighborhood": None,
}


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------


def _require_env(*names):
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        pytest.skip(f"integration: eksik ortam değişkeni: {', '.join(missing)}")


def _base_url():
    return os.environ["SUPABASE_URL"].rstrip("/")


def _headers(key, jwt=None, prefer=None):
    headers = {"apikey": key, "Authorization": f"Bearer {jwt or key}"}
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _admin_headers():
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _service():
    from supabase_client import get_client

    return get_client()


def _new_marker():
    return f"MARK-{uuid.uuid4().hex[:12]}"


def _key_for(marker):
    return hashlib.sha256(marker.encode("utf-8")).hexdigest()


def _rows_with_marker(marker):
    return (
        _service()
        .table("parse_cache")
        .select("*")
        .like("parsed->>description", f"%{marker}%")
        .execute()
        .data
        or []
    )


def _seed_row(marker, expires_at=FAR_FUTURE):
    parsed = {**PARSED_TEMPLATE, "description": marker}
    row = {
        "key": _key_for(marker),
        "is_listing": True,
        "parsed": parsed,
        "version": "test-v1",
        "created_at": CREATED,
        "expires_at": expires_at,
    }
    _service().table("parse_cache").insert(row).execute()
    return row


def _cleanup(marker):
    try:
        _service().table("parse_cache").delete().like("parsed->>description", f"%{marker}%").execute()
    except Exception:  # noqa: BLE001 - temizlik hatası testi maskelemesin
        pass


def _http_get(key, jwt=None):
    with httpx.Client(timeout=15) as http:
        return http.get(
            f"{_base_url()}{PARSE_CACHE_PATH}",
            params={"select": "*"},
            headers=_headers(key, jwt),
        )


def _http_insert(key, row, jwt=None):
    with httpx.Client(timeout=15) as http:
        return http.post(
            f"{_base_url()}{PARSE_CACHE_PATH}",
            json=row,
            headers=_headers(key, jwt, prefer="return=representation"),
        )


def _http_update(key, marker, jwt=None):
    with httpx.Client(timeout=15) as http:
        return http.patch(
            f"{_base_url()}{PARSE_CACHE_PATH}",
            params={"parsed->>description": f"like.*{marker}*"},
            json={"expires_at": PAST},
            headers=_headers(key, jwt, prefer="return=representation"),
        )


def _http_delete(key, marker, jwt=None):
    with httpx.Client(timeout=15) as http:
        return http.delete(
            f"{_base_url()}{PARSE_CACHE_PATH}",
            params={"parsed->>description": f"like.*{marker}*"},
            headers=_headers(key, jwt, prefer="return=representation"),
        )


def _assert_denied_or_empty_read(resp):
    """Okuma: ya boş liste (200) ya da RLS reddi (401/403 + 42501). Satır sızıntısı başarısız."""
    if resp.status_code == 200:
        assert resp.json() == []
    else:
        assert resp.status_code in (401, 403), f"beklenmeyen durum {resp.status_code}: {resp.text}"
        assert resp.json().get("code") == "42501"


def _assert_write_denied(resp):
    assert resp.status_code in (401, 403), f"yazma reddedilmeliydi, gelen {resp.status_code}: {resp.text}"
    assert resp.json().get("code") == "42501"


def _create_temp_user(http, email, password):
    resp = http.post(
        f"{_base_url()}/auth/v1/admin/users",
        json={"email": email, "password": password, "email_confirm": True},
        headers=_admin_headers(),
    )
    assert resp.status_code in (200, 201), f"geçici kullanıcı oluşturulamadı: {resp.status_code} {resp.text}"
    return resp.json()["id"]


def _login_access_token(http, email, password):
    resp = http.post(
        f"{_base_url()}/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": email, "password": password},
        headers={"apikey": os.environ["SUPABASE_ANON_KEY"], "Content-Type": "application/json"},
    )
    assert resp.status_code == 200, f"geçici kullanıcı login olamadı: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def _delete_temp_user(http, user_id):
    resp = http.delete(f"{_base_url()}/auth/v1/admin/users/{user_id}", headers=_admin_headers())
    assert resp.status_code in (200, 204), f"geçici kullanıcı silinemedi: {resp.status_code} {resp.text}"


def _make_key_manager(monkeypatch):
    from api_key_manager import GeminiKeyManager

    monkeypatch.setenv("GEMINI_API_KEYS", "test-key-1")
    manager = GeminiKeyManager()
    manager.load_keys()
    return manager


def _description_echo_side_effect(model, contents):
    """Gemini taklidi: istek metnindeki MARK- işaretçisini description'a yazar."""
    marker = re.search(r"MARK-[0-9a-f]{12}", contents).group(0)
    response = MagicMock()
    response.text = json.dumps({**PARSED_TEMPLATE, "description": marker})
    return response


@pytest.fixture(autouse=True)
def _cache_client_reset_and_sync_submit(monkeypatch):
    """Önbellek istemcisini her testte sıfırlar; arka plan işleri senkron çalışır (F5 sözleşmesi)."""
    import concurrent.futures

    import parser as parser_mod

    def sync_submit(fn, *args, **kwargs):
        future = concurrent.futures.Future()
        try:
            future.set_result(fn(*args, **kwargs))
        except BaseException as exc:  # noqa: BLE001 - istisna Future'a taşınır
            future.set_exception(exc)
        return future

    monkeypatch.setattr(parser_mod, "_CACHE_CLIENT", None, raising=False)
    monkeypatch.setattr(parser_mod, "_submit", sync_submit, raising=False)
    yield


@pytest.fixture
def markers():
    created = []

    def make():
        marker = _new_marker()
        created.append(marker)
        return marker

    yield make
    for marker in created:
        _cleanup(marker)


@pytest.fixture
def cache_env(monkeypatch):
    """Bayrak açık, LRU temiz, gerçek DB; genai mock'u description-echo davranışlı."""
    from parse_cache import clear

    monkeypatch.setenv(FLAG, "true")
    clear()
    manager = _make_key_manager(monkeypatch)
    with patch("parser.genai") as genai:
        genai.Client.return_value.models.generate_content.side_effect = _description_echo_side_effect
        yield {"manager": manager, "genai": genai}
    clear()


def _parse(text, manager):
    from parser import parse_listing_message

    return asyncio.run(parse_listing_message(text, manager))


# ---------------------------------------------------------------------------
# AC-S1 / AC-S7: anon ve authenticated doğrudan REST erişimi
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_acs1_anon_read_returns_no_rows_even_when_row_exists(markers):
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    _seed_row(marker)
    assert len(_rows_with_marker(marker)) == 1, "ön koşul: servis rolü satırı görmeli"

    resp = _http_get(os.environ["SUPABASE_ANON_KEY"])

    _assert_denied_or_empty_read(resp)


@pytest.mark.integration
def test_acs1_anon_insert_rejected_and_no_row_added(markers):
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    row = {
        "key": _key_for(marker),
        "is_listing": True,
        "parsed": {**PARSED_TEMPLATE, "description": marker},
        "version": "test-v1",
        "created_at": CREATED,
        "expires_at": FAR_FUTURE,
    }

    resp = _http_insert(os.environ["SUPABASE_ANON_KEY"], row)

    _assert_write_denied(resp)
    assert len(_rows_with_marker(marker)) == 0


@pytest.mark.integration
def test_acs1_anon_update_and_delete_affect_zero_rows(markers):
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    seeded = _seed_row(marker)
    anon = os.environ["SUPABASE_ANON_KEY"]

    upd = _http_update(anon, marker)
    assert upd.status_code in (200, 204), f"anon UPDATE beklenen 200/204, gelen {upd.status_code}"
    affected = upd.json() if upd.content else []
    assert affected == [], f"anon UPDATE {len(affected)} satır etkiledi"

    dele = _http_delete(anon, marker)
    assert dele.status_code in (200, 204), f"anon DELETE beklenen 200/204, gelen {dele.status_code}"
    affected = dele.json() if dele.content else []
    assert affected == [], f"anon DELETE {len(affected)} satır etkiledi"

    after = _rows_with_marker(marker)
    assert len(after) == 1
    assert after[0]["expires_at"] != PAST
    assert after[0]["key"] == seeded["key"]


@pytest.mark.integration
def test_acs7_authenticated_jwt_read_returns_no_rows_and_write_is_42501(markers):
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    _seed_row(marker)
    assert len(_rows_with_marker(marker)) == 1, "ön koşul: servis rolü satırı görmeli"

    email = f"cache-test-{uuid.uuid4().hex}@example.com"
    password = f"Pw-{uuid.uuid4().hex}-Aa1!"
    user_id = None
    try:
        with httpx.Client(timeout=15) as http:
            user_id = _create_temp_user(http, email, password)
            jwt = _login_access_token(http, email, password)

        _assert_denied_or_empty_read(_http_get(os.environ["SUPABASE_ANON_KEY"], jwt=jwt))

        probe = {
            "key": _key_for(marker + "-probe"),
            "is_listing": True,
            "parsed": {**PARSED_TEMPLATE, "description": marker + "-probe"},
            "version": "test-v1",
            "created_at": CREATED,
            "expires_at": FAR_FUTURE,
        }
        _assert_write_denied(_http_insert(os.environ["SUPABASE_ANON_KEY"], probe, jwt=jwt))
        assert len(_rows_with_marker(marker + "-probe")) == 0
    finally:
        if user_id:
            with httpx.Client(timeout=15) as http:
                _delete_temp_user(http, user_id)


# ---------------------------------------------------------------------------
# AC-S2: satır şekli, ham metin yok
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_acs2_row_written_by_parser_has_only_allowed_columns_and_no_raw_text(markers, cache_env, monkeypatch):
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    raw_marker = f"GIZLI-RAW-{uuid.uuid4().hex[:10]}"
    text = f"{raw_marker} satılık daire kadıköy temiz {marker}"

    result = _parse(text, cache_env["manager"])
    assert result is not None

    rows = _rows_with_marker(marker)
    assert len(rows) == 1, "parser başarılı sonucu kalıcı önbelleğe yazmalı"
    row = rows[0]
    assert set(row.keys()) == ROW_COLUMNS
    assert row["is_listing"] is True
    assert raw_marker not in json.dumps(row, ensure_ascii=False)


# ---------------------------------------------------------------------------
# AC-3 / AC-4 / AC-S5: yeniden başlatma isabeti, TTL okuma ve temizleme
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_persisted_entry_is_hit_after_lru_reset_without_gemini(markers, cache_env, caplog):
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from parse_cache import clear

    caplog.set_level(logging.DEBUG)
    marker = markers()
    text = f"satılık daire kadıköy temiz {marker}"

    first = _parse(text, cache_env["manager"])
    assert first is not None
    assert cache_env["genai"].Client.call_count == 1

    clear()  # süreç yeniden başlatma taklidi: yalnız LRU boşalır
    second = _parse(text, cache_env["manager"])

    assert second == first
    assert cache_env["genai"].Client.call_count == 1
    assert re.search(r"layer=supabase\b", caplog.text) is not None


@pytest.mark.integration
def test_expired_db_entry_is_not_used_and_is_purged(markers, cache_env):
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    from parse_cache import clear
    from supabase_client import purge_expired_parse_cache

    marker = markers()
    text = f"satılık daire kadıköy temiz {marker}"
    assert _parse(text, cache_env["manager"]) is not None

    service = _service()
    service.table("parse_cache").update({"expires_at": PAST}).like(
        "parsed->>description", f"%{marker}%"
    ).execute()
    clear()

    # Gemini başarısız: süresi dolmuş satır yeniden yazılmamalı ve kullanılmamalı.
    cache_env["genai"].Client.return_value.models.generate_content.side_effect = ConnectionError("network")
    result = _parse(text, cache_env["manager"])

    assert result is None
    assert cache_env["genai"].Client.call_count == 2
    assert len(_rows_with_marker(marker)) == 1

    purge_expired_parse_cache(service)

    assert _rows_with_marker(marker) == []


# ---------------------------------------------------------------------------
# AC-18: paralel yazım bütünlüğü
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_parallel_distinct_writes_produce_one_complete_row_each(markers, cache_env):
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    texts = []
    batch = []
    for _ in range(10):
        marker = markers()
        batch.append(marker)
        texts.append(f"satılık daire kadıköy temiz {marker}")

    manager = cache_env["manager"]
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda t: _parse(t, manager), texts))

    assert all(r is not None for r in results)
    for marker in batch:
        rows = _rows_with_marker(marker)
        assert len(rows) == 1
        assert isinstance(rows[0]["parsed"], dict)
        assert rows[0]["is_listing"] is True


@pytest.mark.integration
def test_parallel_same_key_writes_leave_exactly_one_row(markers, cache_env):
    _require_env("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    marker = markers()
    text = f"satılık daire kadıköy temiz {marker}"
    manager = cache_env["manager"]

    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(lambda _i: _parse(text, manager), range(5)))

    assert all(r is not None for r in results)
    assert len(_rows_with_marker(marker)) == 1
