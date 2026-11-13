# -*- coding: utf-8 -*-
"""scraper/parser.py raise_unavailable sözleşmesi (ATDD kalici-parse-kuyrugu AC-6).

Sözleşme:
- raise_unavailable=False (varsayılan): bugünkü davranış; geçici ulaşılamamada None.
- raise_unavailable=True:
    * geçici ulaşılamama (anlık 3 deneme tükendi: 503/504/timeout) -> GeminiUnavailable
    * tüm anahtarlar 429 -> GeminiUnavailable
    * kalıcı hata (400), geçersiz JSON, "ilan değil" -> None (fırlatmaz)
- Hata sonucu hiçbir önbelleğe yazılmaz (optimize yol).
Her test hem bayrak kapalı (legacy) hem açık (optimize) yolda koşar (flag fixture).

Mock kuralı test_parser_retry.py ile aynı: patch hedefi parser.genai; _sleep no-op.
Bu dosya KIRMIZI (red) beklenir: GeminiUnavailable ve raise_unavailable henüz yok.
"""

import asyncio
import concurrent.futures
import json
from unittest.mock import MagicMock, patch

import pytest

import parser as parser_mod
from api_key_manager import GeminiKeyManager
from parse_cache import clear as clear_parse_cache
from parser import GeminiUnavailable, parse_listing_message

FLAG = "GEMINI_PARSE_OPTIMIZATION_ENABLED"
TEXT = "satılık daire kadıköy temiz"

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
NOT_LISTING_JSON = json.dumps(
    {
        "is_listing": False,
        "title": None,
        "price": None,
        "currency": None,
        "rooms": None,
        "area_m2": None,
        "city": None,
        "district": None,
        "neighborhood": None,
        "description": None,
    }
)

_CHAIN_METHODS = (
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "limit",
    "order",
    "upsert",
    "insert",
    "update",
    "delete",
    "single",
    "maybe_single",
    "match",
    "filter",
    "in_",
)

TRANSIENT_ERRORS = [
    pytest.param(lambda: Exception("503 UNAVAILABLE the model is overloaded"), id="503"),
    pytest.param(lambda: Exception("504 Gateway Timeout"), id="504"),
    pytest.param(lambda: TimeoutError("read timed out"), id="timeout"),
]


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------


def _manager(monkeypatch, keys="test-key-1"):
    monkeypatch.setenv("GEMINI_API_KEYS", keys)
    manager = GeminiKeyManager()
    manager.load_keys()
    return manager


def _response(text):
    response = MagicMock()
    response.text = text
    return response


def _client(*outcomes):
    client = MagicMock(name="genai_client")
    client.models.generate_content.side_effect = list(outcomes)
    return client


def _parse(text, manager, **kwargs):
    return asyncio.run(parse_listing_message(text, manager, **kwargs))


def _sync_submit(fn, *args, **kwargs):
    future = concurrent.futures.Future()
    try:
        future.set_result(fn(*args, **kwargs))
    except BaseException as exc:  # noqa: BLE001 - istisna Future'a taşınır
        future.set_exception(exc)
    return future


def _db_client():
    chain = MagicMock(name="table_chain")
    for method in _CHAIN_METHODS:
        getattr(chain, method).return_value = chain
    chain.execute.return_value.data = []
    client = MagicMock(name="supabase_client")
    client.table.return_value = chain
    return client


def _db_write_attempted(db):
    chain = db.table.return_value
    return bool(chain.upsert.called or chain.insert.called)


# ---------------------------------------------------------------------------
# Fixture'lar
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def sleeps(monkeypatch):
    """_sleep çağrılarını kaydeder; gerçek bekleme yapmaz."""
    recorded = []

    async def fake_sleep(delay):
        recorded.append(delay)

    monkeypatch.setattr(parser_mod, "_sleep", fake_sleep, raising=False)
    return recorded


@pytest.fixture(autouse=True)
def db(monkeypatch):
    clear_parse_cache()
    monkeypatch.setattr(parser_mod, "_CACHE_CLIENT", None, raising=False)
    monkeypatch.setattr(parser_mod, "_submit", _sync_submit, raising=False)
    client = _db_client()
    patcher = patch("supabase_client.get_client", return_value=client)
    patcher.start()
    yield client
    patcher.stop()
    clear_parse_cache()


@pytest.fixture
def genai():
    with patch("parser.genai") as mocked:
        yield mocked


@pytest.fixture(params=["false", "true"])
def flag(request, monkeypatch):
    monkeypatch.setenv(FLAG, request.param)
    return request.param


# ---------------------------------------------------------------------------
# Geçici ulaşılamama -> GeminiUnavailable (raise_unavailable=True)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("make_error", TRANSIENT_ERRORS)
def test_transient_failures_exhausted_raise_gemini_unavailable(flag, monkeypatch, genai, sleeps, make_error):
    manager = _manager(monkeypatch)
    client = _client(make_error(), make_error(), make_error())
    genai.Client.return_value = client

    with pytest.raises(GeminiUnavailable):
        _parse(TEXT, manager, raise_unavailable=True)

    assert client.models.generate_content.call_count == 3
    assert sleeps == [2.0, 6.0]


@pytest.mark.parametrize("make_error", TRANSIENT_ERRORS)
def test_transient_failures_exhausted_default_returns_none(flag, monkeypatch, genai, sleeps, make_error):
    manager = _manager(monkeypatch)
    client = _client(make_error(), make_error(), make_error())
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert client.models.generate_content.call_count == 3


def test_all_keys_rate_limited_raise_gemini_unavailable(flag, monkeypatch, genai, sleeps):
    # Yedek tur bu testin kapsamı dışı (test_parser_fallback.py); ana model rotasyon sınırını ölçer.
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", "", raising=False)
    manager = _manager(monkeypatch, keys="key-1,key-2")
    genai.Client.side_effect = lambda **_kwargs: _client(Exception("429 RESOURCE_EXHAUSTED"))

    with pytest.raises(GeminiUnavailable):
        _parse(TEXT, manager, raise_unavailable=True)

    assert genai.Client.call_count == 2
    assert sleeps == [], "429 geçici sayılmaz, bekleme yok"


def test_all_keys_rate_limited_default_returns_none(flag, monkeypatch, genai, sleeps):
    # Yedek tur bu testin kapsamı dışı (test_parser_fallback.py); ana model rotasyon sınırını ölçer.
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", "", raising=False)
    manager = _manager(monkeypatch, keys="key-1,key-2")
    genai.Client.side_effect = lambda **_kwargs: _client(Exception("429 RESOURCE_EXHAUSTED"))

    assert _parse(TEXT, manager) is None
    assert genai.Client.call_count == 2


# ---------------------------------------------------------------------------
# Kalıcı / ilan dışı / geçersiz çıktı -> None (raise_unavailable=True iken de fırlatmaz)
# ---------------------------------------------------------------------------


def test_permanent_400_with_raise_flag_returns_none_without_exception(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(Exception("400 INVALID_ARGUMENT: request is malformed"))
    genai.Client.return_value = client

    assert _parse(TEXT, manager, raise_unavailable=True) is None
    assert client.models.generate_content.call_count == 1
    assert sleeps == []


def test_invalid_json_with_raise_flag_returns_none(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client(_response("bu bir json değil"))

    assert _parse(TEXT, manager, raise_unavailable=True) is None


def test_not_listing_with_raise_flag_returns_none(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client(_response(NOT_LISTING_JSON))

    assert _parse(TEXT, manager, raise_unavailable=True) is None


def test_success_with_raise_flag_returns_parsed(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    genai.Client.return_value = _client(_response(D_JSON))

    assert _parse(TEXT, manager, raise_unavailable=True) == D


# ---------------------------------------------------------------------------
# Optimize yol: GeminiUnavailable sonrası önbelleğe hiçbir şey yazılmaz
# ---------------------------------------------------------------------------


def test_optimized_unavailable_writes_no_cache_and_next_parse_goes_to_gemini(monkeypatch, genai, sleeps, db):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    client = _client(
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
    )
    genai.Client.return_value = client

    with pytest.raises(GeminiUnavailable):
        _parse(TEXT, manager, raise_unavailable=True)
    assert client.models.generate_content.call_count == 3
    assert _db_write_attempted(db) is False

    # LRU'da da kayıt yok: sonraki parse Gemini'ye gider ve başarılı sonuç döner.
    client.models.generate_content.side_effect = [_response(D_JSON)]
    assert _parse(TEXT, manager, raise_unavailable=True) == D
    assert client.models.generate_content.call_count == 4
