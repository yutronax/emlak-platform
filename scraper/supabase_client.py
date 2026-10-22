# -*- coding: utf-8 -*-
"""Scraper worker'ın Supabase'e yazımı için ince istemci.

Service-role key kullanır (RLS'i bypass eder) — bu dosya SADECE scraper
worker'ın kendi sunucusunda/container'ında çalışır, tarayıcıya asla gönderilmez.
"""

import os
from typing import Any, Dict, Optional, Tuple

from postgrest.exceptions import APIError
from supabase import Client, create_client

UNIQUE_VIOLATION_CODE = "23505"


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
    result = (
        client.table("raw_listings")
        .select("id")
        .eq("fingerprint", fingerprint)
        .limit(1)
        .execute()
    )
    return bool(result.data)
