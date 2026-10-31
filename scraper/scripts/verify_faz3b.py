# -*- coding: utf-8 -*-
"""Faz 3b canlı iki-emlakçılı izolasyon doğrulaması (ATDD EML-107,
AC-S1, AC-S2, AC-S5, AC-S6).

Gerçek Supabase projesine, gerçek JWT'lerle karşı PostgREST/RPC çağrıları yapar.
Yalnız okuma + "reddedilmesi beklenen" yazma denemeleri yapar; kalıcı veri
değiştirmesi beklenen tek yazma (PATCH/INSERT) reddedilmelidir.

Çalıştırma (scraper/ içinden):
    python -m scripts.verify_faz3b

Gerekli ortam değişkenleri:
    SUPABASE_URL              proje URL'i (https://<ref>.supabase.co)
    SUPABASE_ANON_KEY         anon (publishable) anahtar
    AGENT_A_JWT               emlakçı A oturumunun access token'ı
    AGENT_B_JWT               emlakçı B oturumunun access token'ı
    AGENT_A_ID                A'nın agents.id (UUID)
    AGENT_B_ID                B'nin agents.id (UUID)
    AGENT_A_LISTING_ID        A'ya ait bir kişisel listings.id
    AGENT_A_GROUP_JID         A'nın wa_groups içindeki bir group_jid (B'nin bilmediği)

Kurallar:
  - Hata kodu / durum eşleşmeleri TAM eşleşmeyle (==) yapılır.
  - Eksik kanıt her zaman FAIL'dir (sessiz geçiş yok).
  - Herhangi bir FAIL -> çıkış kodu 1.
  - Sadece standart kütüphane (paket kurulumu gerekmez).

Kapsam dışı (bu betik yapamaz, raporda belirtilir): admin JWT gerektiren
kontroller (invalid_value, admin onay RPC'sinin owner koruması), push
gönderici, feed_unread_count'un sayısal doğruluğu (yalnız hata/sızıntı kontrolü).
"""

import json
import os
import sys
import urllib.error
import urllib.request

REQUIRED_ENV = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "AGENT_A_JWT",
    "AGENT_B_JWT",
    "AGENT_A_ID",
    "AGENT_B_ID",
    "AGENT_A_LISTING_ID",
    "AGENT_A_GROUP_JID",
)

RLS_CODE = "42501"
UNKNOWN_GROUP_RESULT = {"ok": False, "error": "unknown_group"}
FORBIDDEN_RESULT = {"ok": False, "error": "forbidden"}
THRESHOLD_KEY = "personal_auto_approve_threshold"


# ---------------------------------------------------------------------------
# HTTP yardımcıları (stdlib)
# ---------------------------------------------------------------------------

def request(env, method, path, jwt, body=None):
    """(status, parsed_body) döner. Ağ hatasında status 0 — bu her zaman FAIL'dir."""
    url = env["SUPABASE_URL"].rstrip("/") + path
    headers = {
        "apikey": env["SUPABASE_ANON_KEY"],
        "Authorization": "Bearer " + jwt,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status, raw = resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        status, raw = err.code, err.read().decode("utf-8", errors="replace")
    except urllib.error.URLError:
        return 0, {"transport_error": True}
    if not raw:
        return status, None
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw


def contains_value(obj, value):
    """obj (iç içe dict/list) içinde value'ya TAM eşit bir değer var mı."""
    if isinstance(obj, dict):
        for v in obj.values():
            if contains_value(v, value):
                return True
        return False
    if isinstance(obj, list):
        for v in obj:
            if contains_value(v, value):
                return True
        return False
    return obj == value


def is_denied(status, body):
    """Açık erişim reddi: 401, 403 veya PostgREST 42501 kodu."""
    if status == 401:
        return True
    if status == 403:
        return True
    if isinstance(body, dict) and body.get("code") == RLS_CODE:
        return True
    return False


def denied_or_empty(status, body):
    """Reddedildi VEYA 200 + 0 satır (RLS filtresi sonucu boş döner)."""
    if is_denied(status, body):
        return True
    if status == 200 and body == []:
        return True
    return False


def no_leak(status, body, forbidden_values):
    """Erişim reddedildi ya da 200 dönüp yasak değerlerin hiçbiri yanıtta yok."""
    if is_denied(status, body):
        return True
    if status != 200:
        return False
    for value in forbidden_values:
        if contains_value(body, value):
            return False
    return True


# ---------------------------------------------------------------------------
# Kontroller: her biri (ad, geçti_mi, açıklama) döner
# ---------------------------------------------------------------------------

def check_listing_read_denied(env):
    status, body = request(
        env, "GET",
        f"/rest/v1/listings?owner_agent_id=eq.{env['AGENT_A_ID']}&select=id,owner_agent_id",
        env["AGENT_B_JWT"],
    )
    return ("[AC-S1] B -> listings?owner_agent_id=eq.A: 0 satır / reddedildi",
            denied_or_empty(status, body),
            f"status={status}")


def check_listing_unfiltered_no_leak(env):
    status, body = request(env, "GET", "/rest/v1/listings?select=id,owner_agent_id", env["AGENT_B_JWT"])
    ok = no_leak(status, body, [env["AGENT_A_ID"], env["AGENT_A_LISTING_ID"]])
    return ("[AC-S1] B -> listings (filtresiz): A'nın kişisel ilanı yok",
            ok, f"status={status}")


def check_raw_listings_denied(env):
    status, body = request(
        env, "GET",
        f"/rest/v1/raw_listings?owner_agent_id=eq.{env['AGENT_A_ID']}&select=id",
        env["AGENT_B_JWT"],
    )
    return ("[AC-S1] B -> raw_listings?owner_agent_id=eq.A: 0 satır / reddedildi",
            denied_or_empty(status, body),
            f"status={status}")


def check_raw_listings_unfiltered_no_leak(env):
    status, body = request(env, "GET", "/rest/v1/raw_listings?select=id,owner_agent_id", env["AGENT_B_JWT"])
    ok = no_leak(status, body, [env["AGENT_A_ID"]])
    return ("[AC-S1] B -> raw_listings (filtresiz): A'nın kaydı yok",
            ok, f"status={status}")


def check_wa_groups_denied(env):
    status, body = request(
        env, "GET",
        f"/rest/v1/wa_groups?agent_id=eq.{env['AGENT_A_ID']}&select=group_jid",
        env["AGENT_B_JWT"],
    )
    return ("[AC-S1] B -> wa_groups?agent_id=eq.A: 0 satır / reddedildi",
            denied_or_empty(status, body),
            f"status={status}")


def check_wa_groups_unfiltered_no_leak(env):
    status, body = request(env, "GET", "/rest/v1/wa_groups?select=agent_id,group_jid", env["AGENT_B_JWT"])
    ok = no_leak(status, body, [env["AGENT_A_ID"], env["AGENT_A_GROUP_JID"]])
    return ("[AC-S1] B -> wa_groups (filtresiz): A'nın grubu yok",
            ok, f"status={status}")


def _feed_rpc_check(env, name, rpc):
    status, body = request(env, "POST", f"/rest/v1/rpc/{rpc}", env["AGENT_B_JWT"], body={})
    ok = status == 200 and no_leak(status, body, [env["AGENT_A_ID"], env["AGENT_A_LISTING_ID"]])
    return (f"[AC-S1] B -> rpc/{rpc}: A'nın kişisel ilanı yok ({name})", ok, f"status={status}")


def check_feed_listings(env):
    return _feed_rpc_check(env, "akış", "feed_listings")


def check_feed_filter_options(env):
    return _feed_rpc_check(env, "filtre seçenekleri", "feed_filter_options")


def check_feed_unread_count(env):
    # Sayı doğruluğu seed veri gerektirir; burada yalnız hata ve sızıntı (dizi/nesne içinde
    # A değerleri) kontrol edilir. Raporda kapsam sınırı olarak belirtilir.
    status, body = request(env, "POST", "/rest/v1/rpc/feed_unread_count", env["AGENT_B_JWT"], body={})
    ok = status == 200 and no_leak(status, body, [env["AGENT_A_ID"], env["AGENT_A_LISTING_ID"]])
    return ("[AC-S1] B -> rpc/feed_unread_count: hata yok ve A'ya ait veri yok (yalnız sızıntı kontrolü)",
            ok, f"status={status}")


def _get_my_groups(env, jwt):
    return request(env, "POST", "/rest/v1/rpc/get_my_wa_groups", jwt, body={})


def check_set_selection_unknown_group(env):
    status, body = request(
        env, "POST", "/rest/v1/rpc/set_my_wa_group_selection", env["AGENT_B_JWT"],
        body={"p_group_jids": [env["AGENT_A_GROUP_JID"]]},
    )
    ok = status == 200 and body == UNKNOWN_GROUP_RESULT
    return ("[AC-S2] B -> set_my_wa_group_selection(A'nın jid'i) == unknown_group (tam eşleşme)",
            ok, f"status={status} body={body!r}")


def check_a_selection_unchanged(env, before):
    status_after, body_after = _get_my_groups(env, env["AGENT_A_JWT"])
    ok = status_after == before[0] == 200 and body_after == before[1]
    return ("[AC-S2] B denemesinden sonra A'nın seçimi/grupları değişmedi",
            ok, f"status_before={before[0]} status_after={status_after}")


def check_wa_group_selection_insert_denied(env):
    status, body = request(
        env, "POST", "/rest/v1/wa_group_selection", env["AGENT_B_JWT"],
        body={"agent_id": env["AGENT_A_ID"], "group_jid": env["AGENT_A_GROUP_JID"]},
    )
    return ("[AC-S2] B -> wa_group_selection INSERT (A adına): 42501/403 reddi",
            is_denied(status, body), f"status={status}")


def check_wa_groups_insert_denied(env):
    status, body = request(
        env, "POST", "/rest/v1/wa_groups", env["AGENT_B_JWT"],
        body={"agent_id": env["AGENT_A_ID"], "group_jid": "120363000000000999@g.us", "name": "sahte"},
    )
    return ("[AC-S2] B -> wa_groups INSERT (A adına): 42501/403 reddi",
            is_denied(status, body), f"status={status}")


def check_wa_group_selection_update_denied(env):
    status, body = request(
        env, "PATCH", f"/rest/v1/wa_group_selection?agent_id=eq.{env['AGENT_A_ID']}", env["AGENT_B_JWT"],
        body={"group_jid": "120363000000000999@g.us"},
    )
    return ("[AC-S2] B -> wa_group_selection UPDATE (A satırı): reddedildi veya 0 satır",
            denied_or_empty(status, body), f"status={status}")


def check_threshold_rpc_forbidden(env):
    status, body = request(
        env, "POST", "/rest/v1/rpc/admin_set_threshold", env["AGENT_A_JWT"],
        body={"p_threshold": 0.5},
    )
    ok = status == 200 and body == FORBIDDEN_RESULT
    return ("[AC-S5] A (emlakçı) -> admin_set_threshold == forbidden (tam eşleşme)",
            ok, f"status={status} body={body!r}")


def check_threshold_direct_update_denied(env):
    status, body = request(
        env, "PATCH", f"/rest/v1/app_settings?key=eq.{THRESHOLD_KEY}", env["AGENT_A_JWT"],
        body={"value": 0.99},
    )
    return ("[AC-S5] A -> app_settings UPDATE (doğrudan REST): 42501/403 veya 0 satır",
            denied_or_empty(status, body), f"status={status}")


def check_listing_owner_patch_by_b_denied(env):
    status, body = request(
        env, "PATCH", f"/rest/v1/listings?id=eq.{env['AGENT_A_LISTING_ID']}", env["AGENT_B_JWT"],
        body={"owner_agent_id": env["AGENT_B_ID"]},
    )
    return ("[AC-S6] B -> listings PATCH owner_agent_id (A'nın ilanı): 42501/403 veya 0 satır",
            denied_or_empty(status, body), f"status={status}")


def check_listing_owner_patch_by_owner_denied(env):
    status, body = request(
        env, "PATCH", f"/rest/v1/listings?id=eq.{env['AGENT_A_LISTING_ID']}", env["AGENT_A_JWT"],
        body={"owner_agent_id": None},
    )
    return ("[AC-S6] A (sahip) -> listings PATCH owner_agent_id=null: 42501/403 veya 0 satır",
            denied_or_empty(status, body), f"status={status}")


def check_listing_owner_kept(env):
    status, body = request(
        env, "GET", f"/rest/v1/listings?id=eq.{env['AGENT_A_LISTING_ID']}&select=owner_agent_id",
        env["AGENT_A_JWT"],
    )
    ok = status == 200 and body == [{"owner_agent_id": env["AGENT_A_ID"]}]
    return ("[AC-S6] A'nın kişisel ilanı hâlâ A'ya ait (owner korundu)",
            ok, f"status={status} body={body!r}")


# ---------------------------------------------------------------------------
# Çalıştırma
# ---------------------------------------------------------------------------

def missing_env(env):
    return [name for name in REQUIRED_ENV if not env.get(name)]


def run_checks(env):
    results = []
    for check in (
        check_listing_read_denied,
        check_listing_unfiltered_no_leak,
        check_raw_listings_denied,
        check_raw_listings_unfiltered_no_leak,
        check_wa_groups_denied,
        check_wa_groups_unfiltered_no_leak,
        check_feed_listings,
        check_feed_filter_options,
        check_feed_unread_count,
    ):
        results.append(check(env))

    # AC-S2: A'nın seçimi, B'nin denemesinden önce ve sonra aynı olmalı.
    before = _get_my_groups(env, env["AGENT_A_JWT"])
    results.append(check_set_selection_unknown_group(env))
    results.append(check_a_selection_unchanged(env, before))
    results.append(check_wa_group_selection_insert_denied(env))
    results.append(check_wa_groups_insert_denied(env))
    results.append(check_wa_group_selection_update_denied(env))

    results.append(check_threshold_rpc_forbidden(env))
    results.append(check_threshold_direct_update_denied(env))

    results.append(check_listing_owner_patch_by_b_denied(env))
    results.append(check_listing_owner_patch_by_owner_denied(env))
    results.append(check_listing_owner_kept(env))
    return results


def main():
    env = {name: os.environ.get(name, "") for name in REQUIRED_ENV}
    missing = missing_env(env)
    if missing:
        for name in missing:
            print(f"FAIL [ortam] {name} tanımlı değil (kanıt eksik)")
        print("GENEL: FAIL")
        return 1

    results = run_checks(env)
    failed = 0
    for label, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} {label} - {detail}")
        if not ok:
            failed += 1

    verdict = failed == 0
    print(f"GENEL: {'PASS' if verdict else 'FAIL'} ({len(results) - failed}/{len(results)} kontrol geçti)")
    return 0 if verdict else 1


if __name__ == "__main__":
    sys.exit(main())
