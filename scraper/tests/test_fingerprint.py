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


# ---------------------------------------------------------------------------
# Altın değerler: aşağıdaki hash'ler bu değişiklikten ÖNCEKİ implementasyonla
# hesaplandı. Yeterli bilgili girdilerde (ve raw_text verilse bile) birebir aynı
# kalmalı; DB'deki mevcut fingerprint'ler eşleşmeye devam etmeli.
# ---------------------------------------------------------------------------

import pytest  # noqa: E402

from fingerprint import MIN_FINGERPRINT_FIELDS  # noqa: E402

GOLDEN = [
    (
        {"city": "İstanbul", "district": "Kadıköy", "rooms": "3+1", "price": 2500000, "area_m2": 120},
        "74d15e55b8be35761598c4e38a926628f2894170d225a37a2c14f92946edda78",
    ),
    (
        {"city": "Ankara", "district": "Çankaya", "rooms": "2+1", "price": 1250000.5, "area_m2": 95.75},
        "2ed5ef15fdb3a53768b2373bb9037ce0ffa2056b6bcbe9a49860c3344384db3d",
    ),
    (
        {"city": "İzmir", "district": "Bornova", "rooms": "1+1", "price": "750000", "area_m2": "60"},
        "c404e59c7a94f06b473e34e345ad4879769ac959a1262752915aa578d1874760",
    ),
    (
        {"city": "Bursa", "district": None, "rooms": "2+1", "price": 800000, "area_m2": None},
        "084725f44b6b3260d778501f3090b154c416a925db42064a12b97fcb31ad02c8",
    ),
]


@pytest.mark.parametrize(("parsed", "expected"), GOLDEN)
def test_sufficient_info_golden_values_unchanged(parsed, expected):
    assert compute_fingerprint(parsed) == expected
    assert compute_fingerprint(parsed, raw_text="herhangi bir ilan metni") == expected
    assert compute_fingerprint(parsed, raw_text=None) == expected


def test_low_info_without_raw_text_keeps_legacy_hash():
    # raw_text verilmezse eski algoritma (geri uyum): boş dict sabit "||||" hash'i.
    assert compute_fingerprint({}) == "45ca31c3315a5978f40438aab46040d75e99c9b125c2fd01db6e10ac80bef906"
    assert (
        compute_fingerprint({"city": "İstanbul", "district": "Kadıköy", "rooms": "2+1"})
        == "03086b09acb05df6373d76aa25e234285b92becd979ba49971475a0fd493c75c"
    )


# ---------------------------------------------------------------------------
# Sayısal kanonikleştirme: regex int'i ile modelin float'ı aynı hash'i verir.
# ---------------------------------------------------------------------------


def test_integral_float_and_int_produce_same_fingerprint():
    as_int = {"city": "İstanbul", "district": "Kadıköy", "rooms": "3+1", "price": 2500000, "area_m2": 120}
    as_float = {"city": "İstanbul", "district": "Kadıköy", "rooms": "3+1", "price": 2500000.0, "area_m2": 120.0}
    assert compute_fingerprint(as_float) == compute_fingerprint(as_int)
    # Eski implementasyonda integral float "2500000.0" olarak hash'leniyordu (bb5fa2...): artık int ile aynı.
    assert compute_fingerprint(as_float) != "bb5fa215a98c3810d04fe94f987d2d1b549664d02b01df47f4ef62f61752af30"


def test_non_integral_float_keeps_stable_formatting():
    a = {"city": "Ankara", "district": "Çankaya", "rooms": "2+1", "price": 1250000.5, "area_m2": 95.75}
    expected_raw = "|".join(["ankara", "cankaya", "2+1", "1250000.5", "95.75"])
    assert compute_fingerprint(a) == hashlib.sha256(expected_raw.encode("utf-8")).hexdigest()


def test_bool_price_is_not_treated_as_number():
    # bool int alt sınıfıdır; kanonikleştirme onu "1"e çevirmemeli (eski str() davranışı korunur).
    a = {"city": "Ankara", "district": "Çankaya", "rooms": "2+1", "price": True, "area_m2": 90}
    expected_raw = "|".join(["ankara", "cankaya", "2+1", "True", "90"])
    assert compute_fingerprint(a) == hashlib.sha256(expected_raw.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Düşük bilgi: normalize ham metin hash'i karıştırılır.
# ---------------------------------------------------------------------------

LOW_INFO = {"city": "İstanbul", "district": "Kadıköy", "rooms": "2+1", "price": None, "area_m2": None}


def test_min_fields_constant_is_three():
    assert MIN_FINGERPRINT_FIELDS == 3


@pytest.mark.parametrize(
    "parsed",
    [
        {},
        {"city": "İstanbul"},
        {"city": "İstanbul", "price": 1000000},
        LOW_INFO,  # 3 alan ama sayısal alan yok
    ],
    ids=["empty", "one_field", "two_fields", "three_text_only"],
)
def test_low_info_different_texts_do_not_collide(parsed):
    a = compute_fingerprint(parsed, raw_text="Kadıköy'de 2+1 daire, fiyat için arayın")
    b = compute_fingerprint(parsed, raw_text="Kadıköy merkezde 2+1 kiralık, detay DM")
    assert a != b
    assert a != compute_fingerprint(parsed)


def test_low_info_identical_text_still_dedups():
    text = "Kadıköy'de 2+1 daire, fiyat için arayın"
    assert compute_fingerprint(LOW_INFO, raw_text=text) == compute_fingerprint(dict(LOW_INFO), raw_text=text)


def test_low_info_text_normalization_ignores_case_whitespace_and_diacritics():
    a = compute_fingerprint({}, raw_text="Satılık  Daire\nKadıköy  ")
    b = compute_fingerprint({}, raw_text="  satılık daire kadıköy")
    # Not: "I".lower() == "i" (Türkçe "ı" değil); test verisi bu tuzaktan kaçınır (bkz. AC-1 testi).
    c = compute_fingerprint({}, raw_text="SATILIK DAİRE KADIKÖY".replace("I", "ı"))
    assert a == b
    assert compute_fingerprint({}, raw_text="Moda daire") != a
    assert c == compute_fingerprint({}, raw_text="satılık daire kadıköy")


def test_low_info_blank_raw_text_falls_back_to_legacy():
    assert compute_fingerprint({}, raw_text="   ") == compute_fingerprint({})
    assert compute_fingerprint({}, raw_text="") == compute_fingerprint({})


def test_two_numeric_and_one_text_field_is_sufficient():
    parsed = {"city": "Bursa", "price": 800000, "area_m2": 100}
    assert compute_fingerprint(parsed, raw_text="a") == compute_fingerprint(parsed, raw_text="b")
