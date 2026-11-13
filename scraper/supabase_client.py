# -*- coding: utf-8 -*-
"""Scraper worker'ın Supabase'e yazımı için ince istemci.

Service-role key kullanır (RLS'i bypass eder) — bu dosya SADECE scraper
worker'ın kendi sunucusunda/container'ında çalışır, tarayıcıya asla gönderilmez.
"""

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from postgrest.exceptions import APIError
from supabase import Client, create_client

logger = logging.getLogger("scraper.supabase_client")

UNIQUE_VIOLATION_CODE = "23505"
PARSE_CACHE_TABLE = "parse_cache"
# ingest_personal_listing dönüşü. "unselected": seçim DB'de yok; "not_connected": bağlantı yok
# veya kesme istendi. İkisinde de hiçbir şey yazılmadı.
# Sayaçların hepsi (personal_* ve threshold_fallback) DB tarafında, RPC içinde artırılır.
PERSONAL_INGEST_STATUSES = ("approved", "pending", "duplicate", "unselected", "not_connected")
# bump_sidecar_counter ile aynı kural (DB de ayrıca doğrular).
SIDECAR_COUNTER_KEY_RE = re.compile(r"^[a-z_]{1,40}$")
# Parse hatasında yeniden işlenmek üzere bekletilen ham mesajlar (migration 0032).
# Sınırlar DB CHECK'leriyle aynıdır; aşan değer DB'ye hiç gönderilmez.
PENDING_RAW_TABLE = "pending_raw_messages"
PENDING_RAW_TEXT_MAX_CHARS = 20000
PENDING_REASON_RE = re.compile(r"^[a-z_]{1,40}$")
PENDING_UNKNOWN_REASON = "unknown"
PENDING_SELECT_COLUMNS = "id,source_message_id,agent_id,source_group,source_group_name,raw_text,reason,attempts"


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def insert_raw_listing(client: Client, record: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], bool]:
    """raw_listings tablosuna tek kayıt ekler (atomik, unique-violation'a karşı güvenli).

    record alanları: source, source_group, source_message_id, raw_text,
    parsed (dict), fingerprint, quality_score.
    source_message_id üzerindeki unique index aynı mesajın iki kez
    eklenmesini veritabanı seviyesinde engeller (dedup'ın son savunma hattı).
    fingerprint kolonunda da (status <> 'rejected' koşuluyla) PARTIAL bir
    unique index var (bkz. migration 0007) — paralel worker'ların aynı
    fingerprint'i neredeyse aynı anda insert etmeye çalıştığı race condition'ı
    DB seviyesinde engeller. Bu fonksiyon, o unique-violation'ı (23505)
    try/except ile yakalayıp sessizce `(None, False)` döndürerek atomikliği
    sağlar; 23505 DIŞINDA bir hata (gerçek DB/bağlantı/yetki hatası) YUKARI
    FIRLATILIR, yutulmaz.

    Dönüş: (kayıt veya None, inserted: bool).
    """
    try:
        result = client.table("raw_listings").insert(record).execute()
    except APIError as error:
        if error.code == UNIQUE_VIOLATION_CODE:
            return None, False
        raise
    return (result.data[0] if result.data else {}), True


def fingerprint_exists(client: Client, fingerprint: str) -> bool:
    """Ortak havuz (owner_agent_id null) için dedup. Kişisel kayıtlar bu kontrolü tetiklemez (AC-11).

    rejected satırlar sayılmaz: DB unique index'i (migration 0024) de `status <> 'rejected'` koşulludur;
    admin'in reddettiği ilan ortak havuza yeniden girebilir.
    """
    result = (
        client.table("raw_listings")
        .select("id")
        .eq("fingerprint", fingerprint)
        .is_("owner_agent_id", "null")
        .neq("status", "rejected")
        .limit(1)
        .execute()
    )
    return bool(result.data)


def is_group_selected(client: Client, agent_id: str, group_jid: Optional[str]) -> bool:
    """Grup, emlakçının DB'deki güncel seçimlerinde mi? (service-role, wa_group_selection)

    Sidecar seçim önbelleği 60 sn eski olabilir; bu yüzden kişisel yolda parse'tan ÖNCE
    DB'ye sorulur. Seçili değilse mesaj metni üçüncü tarafa (Gemini) gönderilmez (KVKK).
    Sorgu hatası YUKARI FIRLATILIR; çağıran taraf pesimist davranır (parse etmez).
    group_jid boşsa sorgu yapılmadan False döner.
    """
    if not group_jid:
        return False
    result = (
        client.table("wa_group_selection")
        .select("group_jid")
        .eq("agent_id", agent_id)
        .eq("group_jid", group_jid)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def ingest_personal_listing(client: Client, agent_id: str, record: Dict[str, Any]) -> str:
    """Kişisel ilanı tek transaction'da yazar (service-role RPC).

    owner yalnız agent_id'den gelir; record içindeki owner alanı RPC'ye taşınmaz.
    Bağlantı ve seçim kontrolü DB'de yapılır (kilitli): bağlı değil -> "not_connected";
    seçili olmayan grup -> "unselected". İkisinde de hiçbir şey yazılmaz.
    Dönüş: "approved" | "pending" | "duplicate" | "unselected" | "not_connected".
    Beklenmeyen dönüş ValueError fırlatır.
    """
    result = client.rpc(
        "ingest_personal_listing",
        {"p_agent_id": agent_id, "p_record": record},
    ).execute()
    status = result.data
    if status not in PERSONAL_INGEST_STATUSES:
        raise ValueError("ingest_personal_listing beklenmeyen sonuç döndürdü")
    return status


def get_parse_cache(client: Client, key: str) -> Optional[Dict[str, Any]]:
    """parse_cache satırı ya da None. Sorgu hatası YUKARI FIRLATILIR (çağıran cache_error loglar)."""
    result = (
        client.table(PARSE_CACHE_TABLE)
        .select("key,is_listing,parsed,version,created_at,expires_at")
        .eq("key", key)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def put_parse_cache(
    client: Client,
    key: str,
    is_listing: bool,
    parsed: Optional[Dict[str, Any]],
    version: str,
    expires_at: str,
) -> bool:
    """parse_cache'e upsert eder. Best-effort: hata yutulur, başarı bayrağı False döner."""
    row = {
        "key": key,
        "is_listing": is_listing,
        "parsed": parsed,
        "version": version,
        "expires_at": expires_at,
    }
    try:
        client.table(PARSE_CACHE_TABLE).upsert(row, on_conflict="key").execute()
    except Exception:  # noqa: BLE001 - önbellek yazımı hızlandırıcıdır; çağıran cache_error loglar
        return False
    return True


def delete_parse_cache(client: Client, key: str) -> bool:
    """Tek bir parse_cache satırını siler. Best-effort; başarı bayrağı döner."""
    try:
        client.table(PARSE_CACHE_TABLE).delete().eq("key", key).execute()
    except Exception:  # noqa: BLE001 - çağıran cache_error loglar
        return False
    return True


def purge_expired_parse_cache(client: Client) -> int:
    """Süresi dolmuş parse_cache satırlarını siler. Dönüş: silinen satır sayısı. Hata yukarı fırlatılır."""
    now = datetime.now(timezone.utc).isoformat()
    result = client.table(PARSE_CACHE_TABLE).delete().lte("expires_at", now).execute()
    return len(result.data or [])


def park_raw_message(
    client: Client,
    *,
    message_id: str,
    agent_id: Optional[str],
    group: Optional[str],
    group_name: Optional[str],
    text: str,
    reason: Optional[str],
) -> bool:
    """Parse'ı hatayla biten mesajı pending_raw_messages'e bekletir (agent_id None = ortak havuz).

    Idempotent: (source_message_id, agent_id) unique index'i çakışırsa (23505) satır zaten
    bekliyordur; başarı sayılır, metin asla üzerine yazılmaz. 23505 dışındaki hata YUKARI FIRLATILIR.
    Mesaj kimliği yoksa, metin boşsa ya da üst sınırı aşıyorsa bekletilmez (False). Geçersiz
    neden kodu "unknown" olur. Metin loglanmaz.
    Dönüş: satır bekliyor mu (yeni eklendi ya da zaten vardı).
    """
    if not message_id:
        logger.warning("pending_park_skipped reason=no_message_id")
        return False
    if not text or len(text) > PENDING_RAW_TEXT_MAX_CHARS:
        logger.warning("pending_park_skipped reason=text_length message_id=%s", message_id)
        return False
    if not isinstance(reason, str) or not PENDING_REASON_RE.match(reason):
        reason = PENDING_UNKNOWN_REASON
    row = {
        "source_message_id": message_id,
        "agent_id": agent_id,
        "source_group": group,
        "source_group_name": group_name,
        "raw_text": text,
        "reason": reason,
    }
    try:
        client.table(PENDING_RAW_TABLE).insert(row).execute()
    except APIError as error:
        if error.code == UNIQUE_VIOLATION_CODE:
            return True
        raise
    return True


def fetch_due_pending(client: Client, limit: int) -> List[Dict[str, Any]]:
    """Vadesi gelmiş (next_attempt_at <= şimdi), süresi dolmamış, status='pending' satırlar; eskiden yeniye.

    dead satırlar alınmaz. Sorgu hatası YUKARI FIRLATILIR.
    """
    now = datetime.now(timezone.utc).isoformat()
    result = (
        client.table(PENDING_RAW_TABLE)
        .select(PENDING_SELECT_COLUMNS)
        .eq("status", "pending")
        .lte("next_attempt_at", now)
        .gt("expires_at", now)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return list(result.data or [])


def delete_pending(client: Client, row_id: str) -> None:
    """Bekleyen satırı siler (işlendi ya da düşürüldü). Hata YUKARI FIRLATILIR."""
    client.table(PENDING_RAW_TABLE).delete().eq("id", row_id).execute()


def reschedule_pending(client: Client, row_id: str, attempts: int, next_attempt_at: datetime, dead: bool) -> None:
    """Deneme sayısını ve sonraki deneme zamanını yazar; dead=True ise status='dead' (süre dolana dek kalır).

    Metne dokunulmaz. Hata YUKARI FIRLATILIR.
    """
    values = {
        "attempts": attempts,
        "next_attempt_at": next_attempt_at.isoformat(),
        "status": "dead" if dead else "pending",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    client.table(PENDING_RAW_TABLE).update(values).eq("id", row_id).execute()


def purge_expired_pending(client: Client) -> int:
    """Süresi dolmuş (expires_at < şimdi) bekleyen satırları siler (dead dahil). Dönüş: silinen sayısı."""
    now = datetime.now(timezone.utc).isoformat()
    result = client.table(PENDING_RAW_TABLE).delete().lt("expires_at", now).execute()
    return len(result.data or [])


def bump_sidecar_counter(client: Client, key: str) -> bool:
    """Orchestrator sayacını sidecar_heartbeat.counters.orchestrator[key] içinde +1 yapar.

    Best-effort: RPC hatası yutulur, yalnız anahtar adı ve hata tipi loglanır (içerik yok).
    Dönüş: başarı bayrağı. Geçersiz anahtar RPC'ye gönderilmez.
    """
    if not isinstance(key, str) or not SIDECAR_COUNTER_KEY_RE.match(key):
        logger.warning("Geçersiz sayaç anahtarı, sayılmadı: %r", key if isinstance(key, str) else type(key).__name__)
        return False
    try:
        client.rpc("bump_sidecar_counter", {"p_key": key}).execute()
    except Exception as error:  # noqa: BLE001 - sayaç yazımı akışı durdurmaz
        logger.warning("Sayaç artırılamadı (%s): %s", key, type(error).__name__)
        return False
    return True
