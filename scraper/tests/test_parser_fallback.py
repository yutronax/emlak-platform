# -*- coding: utf-8 -*-
"""scraper/parser.py yedek model (FALLBACK_MODEL) sözleşmesi testleri.

Sözleşme:
- FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite"), import anında okunur.
  Testler monkeypatch.setattr(parser, "FALLBACK_MODEL", ...) ile değiştirir. "" = yedek kapalı.
- Bir anahtar için çağrı sırası: 1. MODEL; geçici hata -> _sleep(2.0) -> 2. FALLBACK_MODEL;
  yine geçici hata -> _sleep(6.0) -> 3. FALLBACK_MODEL; o da geçici hata -> GeminiUnavailable / None.
- FALLBACK_MODEL boşsa üç çağrı da MODEL.
- Yedek modele ilk geçişte içeriksiz log: "gemini_fallback model=<FALLBACK_MODEL>" (anahtar başına bir kez).
- Yedekten gelen başarılı yanıt normal sonuç gibi işlenir (optimize yolda önbelleğe yazılır).
- Kalıcı hata (400/403) -> yedek denenmez, tek çağrı. 429 -> mevcut anahtar döndürme; yeni anahtarda sıra MODEL'den.

Mock kuralı: patch hedefi parser.genai; _sleep kaydedici sahte; çağrı modelleri generate_content(model=...) kwargs'ından okunur.
"""

import asyncio
import concurrent.futures
import json
import logging
from unittest.mock import MagicMock, patch

import pytest

import parser as parser_mod
from api_key_manager import GeminiKeyManager
from parse_cache import clear as clear_parse_cache
from parser import GeminiUnavailable, parse_listing_message

FLAG = "GEMINI_PARSE_OPTIMIZATION_ENABLED"
FALLBACK = "gemini-3.5-flash-lite"
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


def _models(*clients):
    """Verilen istemcilerdeki generate_content çağrılarının model= argümanları, sırayla."""
    models = []
    for client in clients:
        for call in client.models.generate_content.call_args_list:
            models.append(call.kwargs["model"])
    return models


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
def fallback_model(monkeypatch):
    """Her testte yedek model açık ve bilinen değerde başlar; testler kendi değerini ayarlayabilir."""
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", FALLBACK, raising=False)
    return FALLBACK


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
    """Her test hem legacy (false) hem optimize (true) yolda koşar."""
    monkeypatch.setenv(FLAG, request.param)
    return request.param


# ---------------------------------------------------------------------------
# (a) 503 sonra yedekten başarı
# ---------------------------------------------------------------------------


def test_503_then_fallback_success_returns_parsed(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    manager = _manager(monkeypatch)
    client = _client(Exception("503 UNAVAILABLE the model is overloaded"), _response(D_JSON))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) == D
    assert _models(client) == [parser_mod.MODEL, FALLBACK]
    assert sleeps == [2.0]
    assert f"gemini_fallback model={FALLBACK}" in caplog.text


# ---------------------------------------------------------------------------
# (b) 504, 503, başarı -> yedek iki kez çağrılır, gemini_fallback logu tek
# ---------------------------------------------------------------------------


def test_504_503_then_success_uses_fallback_twice_and_logs_fallback_once(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    manager = _manager(monkeypatch)
    client = _client(
        Exception("504 Gateway Timeout"),
        Exception("503 UNAVAILABLE the model is overloaded"),
        _response(D_JSON),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) == D
    assert _models(client) == [parser_mod.MODEL, FALLBACK, FALLBACK]
    assert sleeps == [2.0, 6.0]
    assert caplog.text.count("gemini_fallback") == 1


# ---------------------------------------------------------------------------
# (c) üç geçici hata -> None (varsayılan) ve GeminiUnavailable (raise_unavailable=True)
# ---------------------------------------------------------------------------


def test_three_transient_errors_return_none_with_model_sequence(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert _models(client) == [parser_mod.MODEL, FALLBACK, FALLBACK]
    assert sleeps == [2.0, 6.0]


def test_three_transient_errors_raise_gemini_unavailable_with_model_sequence(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("504 Gateway Timeout"),
        TimeoutError("read timed out"),
    )
    genai.Client.return_value = client

    with pytest.raises(GeminiUnavailable):
        _parse(TEXT, manager, raise_unavailable=True)
    assert _models(client) == [parser_mod.MODEL, FALLBACK, FALLBACK]
    assert sleeps == [2.0, 6.0]


# ---------------------------------------------------------------------------
# (d) FALLBACK_MODEL boş -> yedek kapalı: üç çağrı da MODEL, gemini_fallback logu yok
# ---------------------------------------------------------------------------


def test_empty_fallback_model_keeps_primary_for_all_three_calls(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", "", raising=False)
    manager = _manager(monkeypatch)
    client = _client(
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert _models(client) == [parser_mod.MODEL, parser_mod.MODEL, parser_mod.MODEL]
    assert sleeps == [2.0, 6.0]
    assert "gemini_fallback" not in caplog.text


# ---------------------------------------------------------------------------
# (e) 400 -> kalıcı: tek çağrı MODEL, yedek denenmez
# ---------------------------------------------------------------------------


def test_400_is_permanent_single_primary_call_no_fallback(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    manager = _manager(monkeypatch)
    client = _client(Exception("400 INVALID_ARGUMENT: request is malformed"))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert _models(client) == [parser_mod.MODEL]
    assert sleeps == []
    assert "gemini_fallback" not in caplog.text


# ---------------------------------------------------------------------------
# (f) 429 ilk anahtarda -> ikinci anahtarın ilk çağrısı MODEL (yedek değil)
# ---------------------------------------------------------------------------


def test_429_on_first_key_second_key_starts_with_primary_model(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    rate_limited = _client(Exception("429 RESOURCE_EXHAUSTED"))
    successful = _client(_response(D_JSON))
    genai.Client.side_effect = [rate_limited, successful]

    assert _parse(TEXT, manager) == D
    assert _models(rate_limited) == [parser_mod.MODEL]
    assert _models(successful) == [parser_mod.MODEL]
    assert sleeps == []


# ---------------------------------------------------------------------------
# (g) Optimize yol: 503 sonra yedekten başarı -> sonuç döner ve önbelleğe yazılır
# ---------------------------------------------------------------------------


def test_optimized_503_then_fallback_success_returns_and_writes_cache(monkeypatch, genai, sleeps, db):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    client = _client(Exception("503 UNAVAILABLE the model is overloaded"), _response(D_JSON))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) == D
    assert _models(client) == [parser_mod.MODEL, FALLBACK]
    assert _db_write_attempted(db) is True

    # Önbellek isabeti: ikinci parse Gemini'ye gitmez.
    assert _parse(TEXT, manager) == D
    assert client.models.generate_content.call_count == 2


# ---------------------------------------------------------------------------
# (h) Loglarda mesaj metni yok (yedek geçişte de)
# ---------------------------------------------------------------------------


def test_fallback_logs_contain_no_message_or_provider_text(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    provider_error = "503 UNAVAILABLE GIZLI-SAGLAYICI 0532 111 22 33"
    client = _client(Exception(provider_error), Exception(provider_error), _response(D_JSON))
    genai.Client.return_value = client

    assert _parse("GIZLI-MESAJ-ALFA satılık daire kadıköy temiz", manager) == D

    assert f"gemini_fallback model={FALLBACK}" in caplog.text
    for token in ("GIZLI", "0532", "111 22 33"):
        assert token not in caplog.text


# ---------------------------------------------------------------------------
# (i)-(k) Ana model tüm anahtarlarda 429 -> yedek modelle bir anahtar turu daha
# ---------------------------------------------------------------------------


def test_both_keys_rate_limited_on_primary_then_fallback_key_succeeds(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    manager = _manager(monkeypatch, keys="key-1,key-2")
    # Tek istemci: çağrılar global sırada kaydedilir (MODEL, MODEL, FALLBACK).
    client = _client(
        Exception("429 RESOURCE_EXHAUSTED"),
        Exception("429 RESOURCE_EXHAUSTED"),
        _response(D_JSON),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) == D
    assert _models(client) == [parser_mod.MODEL, parser_mod.MODEL, FALLBACK]
    assert sleeps == []
    assert f"gemini_fallback model={FALLBACK} reason=rate_limit" in caplog.text


@pytest.mark.parametrize("raise_flag", [True, False], ids=["raise", "none"])
def test_both_models_rate_limited_everywhere_is_unavailable(flag, raise_flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    client = _client(
        Exception("429 RESOURCE_EXHAUSTED"),
        Exception("429 RESOURCE_EXHAUSTED"),
        Exception("429 RESOURCE_EXHAUSTED"),
        Exception("429 RESOURCE_EXHAUSTED"),
    )
    genai.Client.return_value = client

    if raise_flag:
        with pytest.raises(GeminiUnavailable):
            _parse(TEXT, manager, raise_unavailable=True)
    else:
        assert _parse(TEXT, manager) is None
    assert _models(client) == [parser_mod.MODEL, parser_mod.MODEL, FALLBACK, FALLBACK]
    assert sleeps == []


@pytest.mark.parametrize("raise_flag", [True, False], ids=["raise", "none"])
def test_empty_fallback_rate_limit_has_no_fallback_round(flag, raise_flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.INFO)
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", "", raising=False)
    manager = _manager(monkeypatch, keys="key-1,key-2")
    client = _client(
        Exception("429 RESOURCE_EXHAUSTED"),
        Exception("429 RESOURCE_EXHAUSTED"),
    )
    genai.Client.return_value = client

    if raise_flag:
        with pytest.raises(GeminiUnavailable):
            _parse(TEXT, manager, raise_unavailable=True)
    else:
        assert _parse(TEXT, manager) is None
    assert _models(client) == [parser_mod.MODEL, parser_mod.MODEL]
    assert sleeps == []
    assert "gemini_fallback" not in caplog.text
