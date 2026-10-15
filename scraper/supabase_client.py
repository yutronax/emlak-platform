# -*- coding: utf-8 -*-
"""Scraper worker'ın Supabase'e yazımı için ince istemci.

Service-role key kullanır (RLS'i bypass eder) — bu dosya SADECE scraper
worker'ın kendi sunucusunda/container'ında çalışır, tarayıcıya asla gönderilmez.
"""

import os
from typing import Any, Dict

from supabase import Client, create_client


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def insert_raw_listing(client: Client, record: Dict[str, Any]) -> Dict[str, Any]:
    """raw_listings tablosuna tek kayıt ekler.

    record alanları: source, source_group, source_message_id, raw_text,
    parsed (dict), fingerprint, quality_score.
    source_message_id üzerindeki unique index aynı mesajın iki kez
    eklenmesini veritabanı seviyesinde engeller (dedup'ın son savunma hattı).
    """
    result = client.table("raw_listings").insert(record).execute()
    return result.data[0] if result.data else {}


def fingerprint_exists(client: Client, fingerprint: str) -> bool:
    result = (
        client.table("raw_listings")
        .select("id")
        .eq("fingerprint", fingerprint)
        .limit(1)
        .execute()
    )
    return bool(result.data)
