# -*- coding: utf-8 -*-
"""Süreç içi (LRU) ayrıştırma önbelleği. Ham mesaj saklanmaz; yalnız anahtar ve sonuç tutulur.

Anahtar: normalize edilmiş metin + sürüm için SHA-256. Kayıtlar TTL ile sona erer
(pozitif 7 gün, negatif 24 saat). Okuma TTL'yi yenilemez. Dönen ve kabul edilen
sözlükler derin kopyalanır; çağıranın değişikliği sonraki isabete taşınmaz.
Kilit yalnız bellek işlemlerinde tutulur, ağ çağrısında tutulmaz.
"""

import copy
import hashlib
import threading
import time
import unicodedata
from collections import OrderedDict
from typing import Any, Dict, Optional

MAX_ENTRIES = 1000
POSITIVE_TTL_SECONDS = 7 * 24 * 60 * 60
NEGATIVE_TTL_SECONDS = 24 * 60 * 60

_lock = threading.Lock()
# anahtar -> (son kullanma anı (monotonic), is_listing, parsed)
_entries: "OrderedDict[str, tuple]" = OrderedDict()


def normalize(text: str) -> str:
    """Unicode NFC, baş/son boşluk temizliği, ardışık boşlukların tek boşluğa indirilmesi."""
    return " ".join(unicodedata.normalize("NFC", text).split())


def cache_key(text: str, version: str) -> str:
    """Normalize metnin sürümlü SHA-256 özeti (64 karakter, küçük harf hex)."""
    payload = f"{version}\x1f{normalize(text)}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def put(
    key: str,
    is_listing: bool,
    parsed: Optional[Dict[str, Any]],
    positive_ttl: float = POSITIVE_TTL_SECONDS,
    negative_ttl: float = NEGATIVE_TTL_SECONDS,
) -> None:
    ttl = positive_ttl if is_listing else negative_ttl
    stored = copy.deepcopy(parsed)
    expires_at = time.monotonic() + ttl
    with _lock:
        _entries[key] = (expires_at, is_listing, stored)
        _entries.move_to_end(key)
        while len(_entries) > MAX_ENTRIES:
            _entries.popitem(last=False)


def get(key: str) -> Optional[Dict[str, Any]]:
    """{"is_listing", "parsed"} kopyası ya da None (yok veya süresi dolmuş)."""
    with _lock:
        entry = _entries.get(key)
        if entry is None:
            return None
        expires_at, is_listing, parsed = entry
        if time.monotonic() >= expires_at:
            del _entries[key]
            return None
        _entries.move_to_end(key)
    return {"is_listing": is_listing, "parsed": copy.deepcopy(parsed)}


def clear() -> None:
    """Yalnız test izolasyonu için."""
    with _lock:
        _entries.clear()
