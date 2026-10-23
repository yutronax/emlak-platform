# -*- coding: utf-8 -*-
"""scraper/fingerprint.py::compute_fingerprint testleri (ATDD EML-59, AC-1/AC-2).

Not: fingerprint.py mevcut davranışı DEĞİŞTİRİLMİYOR, sadece test ekleniyor
(bu dosya GREEN geçmeli — red step formalitesi yok, mevcut implementasyon
zaten bu davranışı uyguluyor).
"""

import hashlib

from fingerprint import compute_fingerprint


# ---------------------------------------------------------------------------
# AC-1: normalizasyon deterministik — büyük/küçük harf ve boşluk farkı
# aynı hash'i üretir.
# ---------------------------------------------------------------------------

def test_same_listing_with_different_case_and_whitespace_produces_same_fingerprint():
    # Not: "I"/"ı" (noktasız i) Python'un varsayılan (Türkçe'ye özel olmayan)
    # .lower()'ında simetrik değil (örn. "I".lower() == "i", "ı" DEĞİL) — bu
    # yüzden test verisi bu tuzağa düşmeyen harfler (İ/i, Ş/ş, Ç/ç) kullanır.
    listing_a = {
        "city": "İstanbul",
        "district": "Beşiktaş",
        "rooms": "2+1",
        "price": 1000000,
        "area_m2": 90,
    }
    listing_b = {
        "city": "  istanbul  ",
        "district": "BEŞİKTAŞ",
        "rooms": "2+1",
        "price": 1000000,
        "area_m2": 90,
    }

    assert compute_fingerprint(listing_a) == compute_fingerprint(listing_b)


def test_fingerprint_is_sha256_hex_digest_of_normalized_fields():
    listing = {
        "city": "Ankara",
        "district": "Çankaya",
        "rooms": "3+1",
        "price": 2500000,
        "area_m2": 120,
    }

    result = compute_fingerprint(listing)

    expected_raw = "|".join(
        [
            "ankara",
            "cankaya",
            "3+1",
            "2500000",
            "120",
        ]
    )
    assert result == hashlib.sha256(expected_raw.encode("utf-8")).hexdigest()
    assert len(result) == 64


def test_different_listings_produce_different_fingerprints():
    listing_a = {"city": "İzmir", "district": "Bornova", "rooms": "1+1", "price": 500000, "area_m2": 60}
    listing_b = {"city": "İzmir", "district": "Bornova", "rooms": "1+1", "price": 600000, "area_m2": 60}

    assert compute_fingerprint(listing_a) != compute_fingerprint(listing_b)


# ---------------------------------------------------------------------------
# AC-2: eksik alan (None) -> hata fırlatmadan boş string olarak hashlenir,
# farklı (ama geçerli) bir hash üretir, çökmez.
# ---------------------------------------------------------------------------

def test_missing_field_is_hashed_as_empty_string_without_raising():
    listing_with_all_fields = {
        "city": "Bursa",
        "district": "Nilüfer",
        "rooms": "2+1",
        "price": 800000,
        "area_m2": 100,
    }
    listing_missing_district = {
        "city": "Bursa",
        "district": None,
        "rooms": "2+1",
        "price": 800000,
        "area_m2": 100,
    }

    result = compute_fingerprint(listing_missing_district)

    assert isinstance(result, str)
    assert len(result) == 64
    assert result != compute_fingerprint(listing_with_all_fields)


def test_empty_dict_does_not_raise_and_returns_valid_hash():
    result = compute_fingerprint({})

    assert isinstance(result, str)
    assert len(result) == 64
    expected_raw = "|".join(["", "", "", "", ""])
    assert result == hashlib.sha256(expected_raw.encode("utf-8")).hexdigest()


def test_all_fields_none_does_not_raise_and_matches_empty_dict_fingerprint():
    listing_all_none = {
        "city": None,
        "district": None,
        "rooms": None,
        "price": None,
        "area_m2": None,
    }

    assert compute_fingerprint(listing_all_none) == compute_fingerprint({})
