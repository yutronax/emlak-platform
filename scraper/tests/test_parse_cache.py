# -*- coding: utf-8 -*-
"""scraper/parse_cache.py birim testleri (ATDD gemini-parse-maliyet).

Kapsam (atdd.md): AC-2 normalizasyon ve sürümlü anahtar, AC-3 LRU kapasitesi,
AC-4 TTL sınırları (pozitif 7 gün, negatif 24 saat, tam sona erme anı),
AC-18 mutasyon izolasyonu ve thread güvenliği, AC-S5 süresi dolmuş kaydın
LRU tarafında kullanılmaması.

Red step: parse_cache.py henüz yok. Modül import'ları test gövdesinde yapılır;
böylece eksik modül pytest toplamasını durdurmaz, her test kendi ImportError'ı
ile başarısız olur.

Test-kontratı varsayımları (implementasyon bunları karşılamalıdır):
- parse_cache.clear() yalnız test izolasyonu içindir.
- get(key) kayıt olarak {"is_listing": bool, "parsed": dict | None} döner.
- Zaman, time.time ve time.monotonic üzerinden okunur; test bu ikisini sahte
  saate bağlar. put(..., positive_ttl=, negative_ttl=) saniye cinsindendir.
"""

import copy
import re
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

DAY = 24 * 60 * 60

PARSED_D = {
    "is_listing": True,
    "title": "Satılık daire",
    "price": 2500000,
    "currency": "TRY",
    "rooms": "3+1",
    "area_m2": 120,
    "city": "İstanbul",
    "district": "Kadıköy",
    "neighborhood": None,
    "description": "Temiz daire",
}


@pytest.fixture(autouse=True)
def _fresh_cache():
    from parse_cache import clear

    clear()
    yield
    clear()


@pytest.fixture
def clock(monkeypatch):
    now = {"t": 1_800_000_000.0}
    monkeypatch.setattr(time, "time", lambda: now["t"])
    monkeypatch.setattr(time, "monotonic", lambda: now["t"])
    return now


# ---------------------------------------------------------------------------
# AC-2: normalize
# ---------------------------------------------------------------------------


def test_normalize_applies_unicode_nfc():
    from parse_cache import normalize

    # "e" + birleşik akut (U+0301) -> NFC "é" (U+00E9)
    assert normalize("é") == "é"


def test_normalize_strips_leading_and_trailing_whitespace():
    from parse_cache import normalize

    assert normalize("  satılık daire \n") == "satılık daire"


def test_normalize_collapses_consecutive_whitespace_into_single_space():
    from parse_cache import normalize

    assert normalize("2+1\t\tdaire \n  Kadıköy") == "2+1 daire Kadıköy"


def test_normalize_preserves_letters_emoji_punctuation_phone_and_url():
    from parse_cache import normalize

    text = "Satılık 🏠 daire!!! Tel: 0532 111 22 33 https://ornek.example/ilan/9?x=1"
    assert normalize(text) == text


def test_normalize_keeps_different_phone_numbers_distinct():
    from parse_cache import normalize

    assert normalize("0532 111 22 33") != normalize("0532 111 22 34")


def test_normalize_empty_and_whitespace_only_become_empty_string():
    from parse_cache import normalize

    assert normalize("") == ""
    assert normalize(" \n\t ") == ""


# ---------------------------------------------------------------------------
# AC-2: cache_key (sürümlü SHA-256)
# ---------------------------------------------------------------------------


def test_cache_key_is_64_char_lowercase_hex():
    from parse_cache import cache_key

    key = cache_key("satılık daire", "v1")
    assert isinstance(key, str)
    assert re.fullmatch(r"[0-9a-f]{64}", key) is not None


def test_cache_key_is_deterministic_for_same_input():
    from parse_cache import cache_key

    assert cache_key("satılık daire", "v1") == cache_key("satılık daire", "v1")


def test_cache_key_same_for_nfc_and_whitespace_variants():
    from parse_cache import cache_key

    assert cache_key("é daire  Kadıköy ", "v1") == cache_key("é daire Kadıköy", "v1")


def test_cache_key_differs_when_version_changes():
    from parse_cache import cache_key

    assert cache_key("satılık daire", "v1") != cache_key("satılık daire", "v2")


def test_cache_key_differs_for_different_phone_numbers():
    from parse_cache import cache_key

    assert cache_key("satılık 0532 111 22 33", "v1") != cache_key("satılık 0532 111 22 34", "v1")


def test_cache_key_differs_when_punctuation_or_letters_change():
    from parse_cache import cache_key

    assert cache_key("satılık daire.", "v1") != cache_key("satılık daire", "v1")
    assert cache_key("Kadıköy", "v1") != cache_key("Kadikoy", "v1")


def test_record_stored_under_old_version_key_is_a_miss(clock):
    from parse_cache import cache_key, get, put

    text = "satılık daire kadıköy"
    put(cache_key(text, "v1"), True, PARSED_D)
    assert get(cache_key(text, "v2")) is None


# ---------------------------------------------------------------------------
# put / get temel sözleşme
# ---------------------------------------------------------------------------


def test_put_positive_then_get_returns_equal_record(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D)
    record = get(key)

    assert record is not None
    assert record["is_listing"] is True
    assert record["parsed"] == PARSED_D


def test_get_unknown_key_returns_none():
    from parse_cache import cache_key, get

    assert get(cache_key("hiç yazılmadı", "v1")) is None


def test_negative_record_has_is_listing_false_and_no_parsed(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("sohbet mesajı", "v1")
    put(key, False, None)
    record = get(key)

    assert record is not None
    assert record["is_listing"] is False
    assert record["parsed"] is None


# ---------------------------------------------------------------------------
# AC-4: TTL sınırları (pozitif 7 gün, negatif 24 saat)
# ---------------------------------------------------------------------------


def test_positive_record_still_valid_one_second_before_seven_days(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D)
    clock["t"] += 7 * DAY - 1

    assert get(key) is not None


def test_positive_record_is_unusable_exactly_at_seven_days(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D)
    clock["t"] += 7 * DAY

    assert get(key) is None


def test_negative_record_valid_until_24_hours_then_unusable(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("sohbet mesajı", "v1")
    put(key, False, None)

    clock["t"] += DAY - 1
    assert get(key) is not None

    clock["t"] += 1
    assert get(key) is None


def test_put_accepts_explicit_ttl_overrides(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D, positive_ttl=60)

    clock["t"] += 59
    assert get(key) is not None

    clock["t"] += 1
    assert get(key) is None


def test_read_does_not_renew_expiry(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D)

    clock["t"] += 6 * DAY
    assert get(key) is not None

    clock["t"] += 1 * DAY
    assert get(key) is None


# ---------------------------------------------------------------------------
# AC-18: mutasyon izolasyonu (derin kopya)
# ---------------------------------------------------------------------------


def test_mutating_returned_record_does_not_change_next_hit(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, copy.deepcopy(PARSED_D))

    first = get(key)
    first["parsed"]["price"] = 1
    first["parsed"]["city"] = "Ankara"

    assert get(key)["parsed"] == PARSED_D


def test_mutating_input_dict_after_put_does_not_change_cached_value(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    payload = copy.deepcopy(PARSED_D)
    put(key, True, payload)
    payload["price"] = 1

    assert get(key)["parsed"] == PARSED_D


def test_two_reads_return_independent_parsed_objects(clock):
    from parse_cache import cache_key, get, put

    key = cache_key("satılık daire", "v1")
    put(key, True, PARSED_D)

    first = get(key)
    second = get(key)
    assert first["parsed"] is not second["parsed"]


# ---------------------------------------------------------------------------
# AC-3: LRU kapasitesi 1000 ve en az yakın zamanda kullanılanın çıkarılması
# ---------------------------------------------------------------------------


def test_lru_keeps_at_most_1000_records(clock):
    from parse_cache import cache_key, get, put

    keys = [cache_key(f"ilan {i}", "v1") for i in range(1001)]
    for key in keys:
        put(key, True, PARSED_D)

    present = [key for key in keys if get(key) is not None]

    assert len(present) == 1000
    assert get(keys[0]) is None


def test_lru_evicts_least_recently_used_not_recently_read(clock):
    from parse_cache import cache_key, get, put

    keys = [cache_key(f"ilan {i}", "v1") for i in range(1000)]
    for key in keys:
        put(key, True, PARSED_D)

    # En eski kayıt okunarak en yeni konuma taşınır.
    assert get(keys[0]) is not None

    extra = cache_key("yeni ilan", "v1")
    put(extra, True, PARSED_D)

    assert get(keys[1]) is None
    assert get(keys[0]) is not None
    assert get(extra) is not None


def test_concurrent_puts_keep_capacity_and_record_integrity(clock):
    from parse_cache import cache_key, get, put

    keys = [cache_key(f"paralel ilan {i}", "v1") for i in range(2000)]

    def writer(i):
        put(keys[i], True, {**PARSED_D, "title": f"ilan-{i}"})

    with ThreadPoolExecutor(max_workers=10) as pool:
        list(pool.map(writer, range(2000)))

    present = {}
    for i, key in enumerate(keys):
        record = get(key)
        if record is not None:
            present[i] = record

    assert len(present) == 1000
    for i, record in present.items():
        assert record["is_listing"] is True
        assert record["parsed"]["title"] == f"ilan-{i}"
