# -*- coding: utf-8 -*-
"""plans tablosu RLS: anon/authenticated SELECT izni ve anon yazma reddi
(EML-68 / EML-69, ATDD AC-1, AC-2, AC-S1, AC-S2).

Tüm testler gerçek Supabase projesine karşı çalışır (mock YASAK — authz-test
kuralı) ve `integration` işaretlidir; varsayılan olarak atlanır
(bkz. tests/conftest.py). Çalıştırmak için:
    pytest --run-integration
veya
    RUN_INTEGRATION=1 pytest

Gerekli ortam değişkenleri:
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
Opsiyonel (eksikse ilgili test anlamlı mesajla atlanır):
    SUPABASE_DB_URL         -> AC-S2 için pg_policies okumak üzere Postgres bağlantı dizesi
AC-2 kendi geçici auth kullanıcısını oluşturup finally'de siler (env değişkeni gerekmez).

Red step: migration 0010_plans_anon_select.sql henüz yazılmadığı için bu
testler şu an FAIL etmesi beklenen davranıştır.
"""

import os
import uuid

import httpx
import pytest

PLANS_PATH = "/rest/v1/plans"


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


def _service_client():
    # Lazy import: supabase bağımlılığı yoksa modül yine collect edilir, test anlamlı şekilde atlanır.
    from supabase_client import get_client

    return get_client()


def _service_rows():
    """service_role ile plans'ın tam snapshot'ı (id'ye göre sıralı)."""
    rows = _service_client().table("plans").select("*").execute().data or []
    return sorted(rows, key=lambda r: r["id"])


def _http_get_plans(key, jwt=None):
    with httpx.Client(timeout=15) as http:
        return http.get(
            f"{_base_url()}{PLANS_PATH}",
            params={"select": "*"},
            headers=_headers(key, jwt),
        )


def _probe_row(name):
    return {
        "name": name,
        "price_minor_unit": 1,
        "currency": "TRY",
        "max_listings": 1,
        "sort_order": 999,
    }


def _cleanup_by_name(name):
    _service_client().table("plans").delete().eq("name", name).execute()


# Yazma-denemesi testleri için güvenlik koruması: plans beklenen placeholder
# (3 satır) dışında büyükse ortam yanlış (üretim olabilir) demektir; testler çalıştırılmaz.
WRITE_PROBE_MAX_SAFE_ROWS = 100


def _guard_write_probe_environment():
    rows = _service_client().table("plans").select("id").execute().data or []
    if len(rows) > WRITE_PROBE_MAX_SAFE_ROWS:
        pytest.fail(
            f"Güvenlik koruması: plans tablosunda {WRITE_PROBE_MAX_SAFE_ROWS}'den fazla satır var, "
            "bu beklenmeyen bir ortam (üretim olabilir) — yazma-denemesi testleri burada ÇALIŞTIRILMADI"
        )


# ---------------------------------------------------------------------------
# AC-1 (Critical): anon SELECT satır sayısı service_role sayımına TAM EŞİT
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_ac1_anon_select_returns_exact_service_row_count():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")

    expected_count = len(_service_rows())
    # Boş tablo PASS sayılmaz: RLS engeli de 200 + [] döner, ayırt edilemez.
    assert expected_count == 3, (
        f"Ön koşul: plans 3 satır içermeli (ATDD AC-1), service_role sayımı={expected_count}"
    )

    resp = _http_get_plans(os.environ["SUPABASE_ANON_KEY"])

    assert resp.status_code == 200, f"anon SELECT beklenen 200, gelen {resp.status_code}: {resp.text}"
    anon_rows = resp.json()
    assert isinstance(anon_rows, list)
    assert len(anon_rows) == expected_count, (
        f"anon {len(anon_rows)} satır gördü, service_role {expected_count} satır sayıyor "
        "(RLS engeli boş liste olarak görünür — migration uygulanmamış olabilir)"
    )


# ---------------------------------------------------------------------------
# AC-2 (Critical, regresyon): authenticated SELECT aynı satır sayısı
# ---------------------------------------------------------------------------

def _admin_headers():
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


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
    resp = http.delete(
        f"{_base_url()}/auth/v1/admin/users/{user_id}",
        headers=_admin_headers(),
    )
    assert resp.status_code in (200, 204), f"geçici kullanıcı silinemedi: {resp.status_code} {resp.text}"


@pytest.mark.integration
def test_ac2_authenticated_select_returns_same_row_count():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")

    expected_count = len(_service_rows())
    assert expected_count == 3, (
        f"Ön koşul: plans 3 satır içermeli (ATDD AC-2), service_role sayımı={expected_count}"
    )

    email = f"rls-test-{uuid.uuid4().hex}@example.com"
    password = f"Pw-{uuid.uuid4().hex}-Aa1!"
    user_id = None
    try:
        with httpx.Client(timeout=15) as http:
            user_id = _create_temp_user(http, email, password)
            jwt = _login_access_token(http, email, password)

        resp = _http_get_plans(os.environ["SUPABASE_ANON_KEY"], jwt=jwt)

        assert resp.status_code == 200, f"authenticated SELECT beklenen 200, gelen {resp.status_code}: {resp.text}"
        assert len(resp.json()) == expected_count
    finally:
        if user_id:
            with httpx.Client(timeout=15) as http:
                _delete_temp_user(http, user_id)


# ---------------------------------------------------------------------------
# AC-S1 (High): anon INSERT reddi + veri değişmedi (service_role ile doğrula)
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_acs1_anon_insert_rejected_and_table_unchanged():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    _guard_write_probe_environment()

    before = _service_rows()
    probe_name = f"rls-probe-insert-{uuid.uuid4().hex}"

    try:
        with httpx.Client(timeout=15) as http:
            resp = http.post(
                f"{_base_url()}{PLANS_PATH}",
                json=_probe_row(probe_name),
                headers=_headers(
                    os.environ["SUPABASE_ANON_KEY"],
                    prefer="return=representation",
                ),
            )

        # Davranış sözleşmesi #3: 401/403 (42501 RLS ihlali)
        assert resp.status_code in (401, 403), (
            f"anon INSERT reddedilmeliydi (401/403), gelen {resp.status_code}: {resp.text}"
        )
        assert resp.json().get("code") == "42501", f"RLS hata kodu 42501 olmalı: {resp.text}"

        # İkinci seviye kanıt: veri gerçekten değişmemiş olmalı.
        after = _service_rows()
        assert len(after) == len(before), (
            f"anon INSERT tabloyu değiştirdi: önce {len(before)}, sonra {len(after)} satır"
        )
        assert after == before
        assert all(r["name"] != probe_name for r in after)
    finally:
        _cleanup_by_name(probe_name)


# ---------------------------------------------------------------------------
# AC-S1 (High): anon UPDATE/DELETE 0 satır etkiler + veri değişmedi
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_acs1_anon_update_affects_zero_rows_and_data_unchanged():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    _guard_write_probe_environment()

    before = _service_rows()
    assert before, "Ön koşul: en az bir plans satırı olmalı"
    target = before[0]
    marker = f"rls-probe-update-{uuid.uuid4().hex}"

    with httpx.Client(timeout=15) as http:
        resp = http.patch(
            f"{_base_url()}{PLANS_PATH}",
            params={"id": f"eq.{target['id']}"},
            json={"name": marker},
            headers=_headers(
                os.environ["SUPABASE_ANON_KEY"],
                prefer="return=representation",
            ),
        )

    # Yanıt kodu tek başına yetmez: 200 (boş gövde) ya da 204 dönebilir.
    assert resp.status_code in (200, 204), f"anon UPDATE beklenen 200/204, gelen {resp.status_code}"
    affected = resp.json() if resp.content else []
    assert len(affected) == 0, f"anon UPDATE {len(affected)} satır etkiledi (beklenen 0)"

    # İkinci seviye kanıt: service_role ile veri gerçekten değişmemiş olmalı.
    after = _service_rows()
    assert after == before, "anon UPDATE yanıtı 0 satır dese de veri değişmiş"
    assert all(r["name"] != marker for r in after)


@pytest.mark.integration
def test_acs1_anon_delete_affects_zero_rows_and_data_unchanged():
    _require_env("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    _guard_write_probe_environment()

    before = _service_rows()
    assert before, "Ön koşul: en az bir plans satırı olmalı"
    target = before[-1]

    with httpx.Client(timeout=15) as http:
        resp = http.delete(
            f"{_base_url()}{PLANS_PATH}",
            params={"id": f"eq.{target['id']}"},
            headers=_headers(
                os.environ["SUPABASE_ANON_KEY"],
                prefer="return=representation",
            ),
        )

    assert resp.status_code in (200, 204), f"anon DELETE beklenen 200/204, gelen {resp.status_code}"
    affected = resp.json() if resp.content else []
    assert len(affected) == 0, f"anon DELETE {len(affected)} satır etkiledi (beklenen 0)"

    after = _service_rows()
    assert len(after) == len(before), (
        f"anon DELETE yanıtı 0 satır dese de satır sayısı {len(before)} -> {len(after)}"
    )
    assert after == before


# ---------------------------------------------------------------------------
# AC-S2 (High): pg_policies — SELECT rolleri {anon, authenticated}, anon için
# INSERT/UPDATE/DELETE/ALL policy'si yok
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_acs2_pg_policies_plans_select_roles_and_no_anon_write_policy():
    _require_env("SUPABASE_DB_URL")
    psycopg = pytest.importorskip(
        "psycopg",
        reason="SUPABASE_DB_URL ile pg_policies okumak için psycopg gerekli",
    )

    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select policyname, cmd, roles from pg_policies "
                "where schemaname = 'public' and tablename = 'plans'"
            )
            policies = cur.fetchall()

    assert policies, "plans tablosunda hiç policy yok"

    select_roles = set()
    for _name, cmd, roles in policies:
        if cmd == "SELECT":
            select_roles.update(roles)
    assert {"anon", "authenticated"} <= select_roles, (
        f"plans SELECT policy rolleri {{anon, authenticated}} içermeli, gelen: {sorted(select_roles)}"
    )

    # anon'u (ya da PUBLIC'i) kapsayan yazma policy'si olmamalı.
    for name, cmd, roles in policies:
        if cmd in ("INSERT", "UPDATE", "DELETE", "ALL"):
            covers_anon = bool({"anon", "public"} & set(roles or ["public"]))
            assert not covers_anon, (
                f"anon için yazma policy'si bulundu: policy={name}, cmd={cmd}, roles={roles}"
            )
