# -*- coding: utf-8 -*-
"""Scraper worker'ın Supabase'e yazımı için ince istemci.

Service-role key kullanır (RLS'i bypass eder) — bu dosya SADECE scraper
worker'ın kendi sunucusunda/container'ında çalışır, tarayıcıya asla gönderilmez.
"""

import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

from postgrest.exceptions import APIError
from supabase import Client, create_client

logger = logging.getLogger("scraper.supabase_client")

UNIQUE_VIOLATION_CODE = "23505"
# ingest_personal_listing dönüşü. "unselected": seçim DB'de yok; "not_connected": bağlantı yok
# veya kesme istendi. İkisinde de hiçbir şey yazılmadı.
# Sayaçların hepsi (personal_* ve threshold_fallback) DB tarafında, RPC içinde artırılır.
PERSONAL_INGEST_STATUSES = ("approved", "pending", "duplicate", "unselected", "not_connected")
# bump_sidecar_counter ile aynı kural (DB de ayrıca doğrular).
SIDECAR_COUNTER_KEY_RE = re.compile(r"^[a-z_]{1,40}$")


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
    """Ortak havuz (owner_agent_id null) için dedup. Kişisel kayıtlar bu kontrolü tetiklemez (AC-11)."""
    result = (
        client.table("raw_listings")
        .select("id")
        .eq("fingerprint", fingerprint)
        .is_("owner_agent_id", "null")
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
