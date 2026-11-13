# -*- coding: utf-8 -*-
"""scraper/parser.py::parse_listing_outcome üç durumlu sonuç testleri.

listing / not_listing / error ayrımı: teknik hata (anahtar yok, rate limit, zaman aşımı,
ağ, sağlayıcı hatası, geçersiz JSON) ASLA not_listing'e çökmez. Hem eski yol (bayrak kapalı)
hem optimizasyon yolu (bayrak açık) kapsanır. parse_listing_message geri uyumlu sarmalayıcıdır.

Mock kuralları test_parser.py / test_parser_optimized.py ile aynı: patch hedefi `parser.genai`,
GeminiKeyManager gerçek sınıftır, Supabase `supabase_client.get_client` ile mock'lanır.
"""

import asyncio
import json
import logging
import uuid
from unittest.mock import MagicMock, patch

import pytest

from api_key_manager import GeminiKeyManager
import parser as parser_mod
from parser import ParseOutcome, parse_listing_message, parse_listing_outcome

FLAG = "GEMINI_PARSE_OPTIMIZATION_ENABLED"

D = {
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
D_JSON = json.dumps(D)
NOT_LISTING_JSON = json.dumps({"is_listing": False})
SECRET_TEXT = "GIZLI-ILAN-METNI 3+1 Kadıköy 5321234512"


def _uid(base):
    return f"{base} ref{uuid.uuid4().hex[:12]}"


def _client_returning(text):
    client = MagicMock(name="genai_client")
    response = MagicMock()
    response.text = text
    client.models.generate_content.return_value = response
    return client


def _client_failing(exc):
    client = MagicMock(name="genai_client_failing")
    client.models.generate_content.side_effect = exc
    return client


def _manager(monkeypatch, keys="test-key-1"):
    monkeypatch.setenv("GEMINI_API_KEYS", keys)
    manager = GeminiKeyManager()
    manager.load_keys()
    return manager


def _outcome(text, manager):
    return asyncio.run(parse_listing_outcome(text, manager))


@pytest.fixture(autouse=True)
def _fresh_cache():
    from parse_cache import clear

    clear()
    yield
    clear()


@pytest.fixture(autouse=True)
def db():
    chain = MagicMock(name="table_chain")
    for method in ("select", "eq", "gt", "gte", "limit", "upsert", "insert", "delete", "maybe_single"):
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = []
    client = MagicMock(name="supabase_client")
    client.table.return_value = chain
    with patch("supabase_client.get_client", return_value=client):
        yield client


@pytest.fixture
def genai():
    with patch("parser.genai") as mocked:
        yield mocked


@pytest.fixture(params=["false", "true"], ids=["legacy", "optimized"])
def any_path(request, monkeypatch):
    """Her iki ayrıştırma yolunda da aynı üç durumlu sözleşme geçerli olmalı."""
    monkeypatch.setenv(FLAG, request.param)
    return request.param


# ---------------------------------------------------------------------------
# Tip sözleşmesi
# ---------------------------------------------------------------------------


def test_parse_outcome_is_immutable_with_status_parsed_reason():
    outcome = ParseOutcome("error", None, "rate_limit")
    assert (outcome.status, outcome.parsed, outcome.reason) == ("error", None, "rate_limit")
    with pytest.raises(AttributeError):
        outcome.status = "listing"  # type: ignore[misc]
    assert ParseOutcome("not_listing").parsed is None
    assert ParseOutcome("not_listing").reason is None


# ---------------------------------------------------------------------------
# listing / not_listing (her iki yol)
# ---------------------------------------------------------------------------


def test_valid_listing_yields_listing_with_parsed(monkeypatch, any_path, genai):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(D_JSON)
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome.status == "listing"
    assert outcome.parsed["price"] == 2500000
    assert outcome.reason is None


def test_is_listing_false_yields_not_listing(monkeypatch, any_path, genai):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(NOT_LISTING_JSON)
    outcome = _outcome(_uid("bu daire hala satılık mı"), manager)
    assert outcome == ParseOutcome("not_listing", None, None)


# ---------------------------------------------------------------------------
# Teknik hatalar -> error (not_listing DEĞİL), neden kodu ile
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        (TimeoutError("read timed out"), "timeout"),
        (Exception("Deadline exceeded"), "timeout"),
        (ConnectionError("connection reset"), "network"),
        (Exception("500 INTERNAL server error"), "provider_error"),
        (Exception("503 UNAVAILABLE"), "provider_error"),
    ],
)
def test_provider_failure_yields_error_with_reason(monkeypatch, any_path, genai, failure, reason):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_failing(failure)
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, reason)


def test_all_keys_rate_limited_yields_error_rate_limit(monkeypatch, any_path, genai):
    manager = _manager(monkeypatch, keys="k1,k2")
    genai.Client.side_effect = lambda *a, **k: _client_failing(Exception("429 RESOURCE_EXHAUSTED"))
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "rate_limit")
    assert genai.Client.call_count == 2


def test_no_key_yields_error_no_key_without_client(monkeypatch, any_path, genai):
    monkeypatch.delenv("GEMINI_API_KEYS", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    manager = GeminiKeyManager()
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "no_key")
    genai.Client.assert_not_called()


@pytest.mark.parametrize("response_text", ["sadece düz metin, JSON yok", '{"is_listing": true,}'])
def test_invalid_json_yields_error_json_invalid(monkeypatch, any_path, genai, response_text):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(response_text)
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "json_invalid")


# ---------------------------------------------------------------------------
# Optimizasyon yoluna özgü: _ERROR artık error olarak dışarı çıkar
# ---------------------------------------------------------------------------


def test_optimized_schema_invalid_yields_error_schema_invalid(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps({**D, "price": "çok pahalı"}))
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "schema_invalid")


def test_optimized_conflict_second_call_error_yields_error(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    conflicting = json.dumps({**D, "rooms": "2+1"})
    genai.Client.side_effect = [
        _client_returning(conflicting),
        _client_failing(ConnectionError("down")),
    ]
    outcome = _outcome(_uid("Satılık 3+1 daire 120 m² 2.500.000 TL Kadıköy"), manager)
    assert outcome == ParseOutcome("error", None, "network")


def test_optimized_prefilter_rejection_yields_not_listing(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    outcome = _outcome("merhaba", manager)
    assert outcome == ParseOutcome("not_listing", None, None)
    genai.Client.assert_not_called()


def test_optimized_error_is_not_cached_so_next_call_retries_model(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    text = _uid("satılık daire kadıköy temiz")
    genai.Client.return_value = _client_failing(TimeoutError("t"))
    assert _outcome(text, manager).status == "error"
    genai.Client.return_value = _client_returning(D_JSON)
    assert _outcome(text, manager).status == "listing"


def test_optimized_cache_hits_keep_listing_and_not_listing(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    pos, neg = _uid("satılık daire kadıköy temiz"), _uid("bu daire hala satılık mı")
    genai.Client.return_value = _client_returning(D_JSON)
    _outcome(pos, manager)
    genai.Client.return_value = _client_returning(NOT_LISTING_JSON)
    _outcome(neg, manager)
    calls = genai.Client.call_count

    assert _outcome(pos, manager).status == "listing"
    assert _outcome(neg, manager) == ParseOutcome("not_listing", None, None)
    assert genai.Client.call_count == calls


# ---------------------------------------------------------------------------
# Geri uyumlu sarmalayıcı ve içeriksiz log
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("outcome", "expected"),
    [
        (ParseOutcome("listing", {"k": 1}, None), {"k": 1}),
        (ParseOutcome("not_listing", None, None), None),
        (ParseOutcome("error", None, "rate_limit"), None),
    ],
)
def test_parse_listing_message_wraps_outcome(outcome, expected):
    async def _fake(raw_text, key_manager):
        return outcome

    with patch.object(parser_mod, "parse_listing_outcome", new=_fake):
        assert asyncio.run(parse_listing_message("x", MagicMock())) == expected


def test_error_outcome_logs_reason_but_no_message_text(monkeypatch, any_path, genai, caplog):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_failing(Exception(f"500 boom {SECRET_TEXT}"))
    outcome = _outcome(SECRET_TEXT, manager)
    assert outcome.reason == "provider_error"
    assert "reason=provider_error" in caplog.text
    assert SECRET_TEXT not in caplog.text
    assert "boom" not in caplog.text


# ---------------------------------------------------------------------------
# Eski yol (bayrak kapalı): ilan çıktısı da şema doğrulamasından geçer
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad",
    [
        {**D, "price": "2.500.000"},
        {**D, "area_m2": "120 m2"},
        {**D, "price": True},
        {**D, "currency": "USD"},
        {**D, "currency": "EUR"},
        {**D, "currency": ""},
        {**D, "currency": 123},
        {**D, "currency": ["TRY"]},
        {**D, "rooms": 3},
        {**D, "city": ["İstanbul"]},
        {**D, "is_listing": "true"},
        {**D, "is_listing": 1},
        {**D, "price": "2.500.000", "phone": "05321234512", "currency": "TL"},
    ],
    ids=[
        "price_str", "area_str", "price_bool", "usd", "eur", "empty_currency", "currency_int",
        "currency_list", "rooms_int", "city_list", "is_listing_str", "is_listing_int",
        "price_str_with_extras_and_alias",
    ],
)
def test_legacy_schema_invalid_listing_yields_error_schema_invalid(monkeypatch, genai, bad):
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps(bad))
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "schema_invalid")


def test_legacy_valid_listing_returns_validated_dict_with_missing_fields_filled(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    partial = {"is_listing": True, "price": 2500000.0, "rooms": "3+1", "city": "İstanbul"}
    genai.Client.return_value = _client_returning(json.dumps(partial))
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome.status == "listing"
    assert outcome.parsed == {
        "is_listing": True,
        "title": None,
        "price": 2500000.0,
        "currency": None,
        "rooms": "3+1",
        "area_m2": None,
        "city": "İstanbul",
        "district": None,
        "neighborhood": None,
        "description": None,
    }


@pytest.mark.parametrize(
    "not_listing",
    [{"is_listing": False, "reason": "sohbet"}, {"is_listing": False, "price": "yok"}, {"is_listing": None}, {}],
    ids=["extra_key", "bad_price", "null_flag", "empty"],
)
def test_legacy_falsy_is_listing_stays_not_listing_without_validation(monkeypatch, genai, not_listing):
    """İlan olmayan yanıt hiçbir şey yazmaz; doğrulama onu hataya (bekletme/replay) çevirmemeli."""
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps(not_listing))
    outcome = _outcome(_uid("bu daire hala satılık mı"), manager)
    assert outcome == ParseOutcome("not_listing", None, None)


def test_legacy_schema_invalid_logs_reason_without_content(monkeypatch, genai, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps({**D, "price": SECRET_TEXT}))
    _outcome(SECRET_TEXT, manager)
    assert "reason=schema_invalid" in caplog.text
    assert SECRET_TEXT not in caplog.text


# ---------------------------------------------------------------------------
# Eski yol: kozmetik sapmalar (fazla anahtar, TL yazım varyantları) ilanı düşürmez
# ---------------------------------------------------------------------------

SCHEMA_KEYS = {"is_listing", "title", "price", "currency", "rooms", "area_m2", "city", "district", "neighborhood", "description"}


def _legacy(monkeypatch, genai, obj):
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps(obj))
    return _outcome(_uid("satılık daire kadıköy temiz"), manager)


def test_legacy_extra_keys_are_dropped_and_listing_accepted(monkeypatch, genai):
    outcome = _legacy(monkeypatch, genai, {**D, "phone": "05321234512", "property_type": "daire", "floor": 3})
    assert outcome.status == "listing"
    assert set(outcome.parsed) == SCHEMA_KEYS
    assert outcome.parsed == D


@pytest.mark.parametrize("alias", ["TL", "tl", " TL ", "₺", "try", "TRY", " Try\n"])
def test_legacy_turkish_lira_aliases_map_to_try(monkeypatch, genai, alias):
    outcome = _legacy(monkeypatch, genai, {**D, "currency": alias})
    assert outcome.status == "listing"
    assert outcome.parsed["currency"] == "TRY"


def test_legacy_normalizer_does_not_mutate_input_or_coerce_types():
    original = {**D, "currency": " tl ", "extra": 1, "price": "2500000", "is_listing": "true"}
    snapshot = dict(original)
    result = parser_mod._normalize_legacy_output(original)
    assert original == snapshot
    assert result is not original
    assert "extra" not in result
    assert result["currency"] == "TRY"
    assert result["price"] == "2500000" and result["is_listing"] == "true"


def test_legacy_normalization_log_has_counts_only(monkeypatch, genai, caplog):
    caplog.set_level(logging.DEBUG)
    _legacy(monkeypatch, genai, {**D, "currency": "TL", "phone": SECRET_TEXT})
    assert "legacy_normalized extra_keys=1 currency_alias=true" in caplog.text
    assert SECRET_TEXT not in caplog.text
    assert "phone" not in caplog.text


def test_legacy_valid_output_logs_no_normalization(monkeypatch, genai, caplog):
    caplog.set_level(logging.DEBUG)
    _legacy(monkeypatch, genai, D)
    assert "legacy_normalized" not in caplog.text


def test_optimized_path_still_rejects_extra_keys_and_tl(monkeypatch, genai):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client_returning(json.dumps({**D, "currency": "TL", "phone": "x"}))
    outcome = _outcome(_uid("satılık daire kadıköy temiz"), manager)
    assert outcome == ParseOutcome("error", None, "schema_invalid")
