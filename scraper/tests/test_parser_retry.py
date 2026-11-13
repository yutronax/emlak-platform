# -*- coding: utf-8 -*-
"""scraper/parser.py::_generate geçici hata yeniden deneme testleri.

Sözleşme:
- GEÇİCİ hata (_provider_error_reason "timeout"/"network", ya da mesajda 500/502/503/504,
  UNAVAILABLE, INTERNAL): aynı anahtarla en fazla 3 çağrı. 1. hatadan sonra _sleep(2.0),
  2. hatadan sonra _sleep(6.0). Her yeniden deneme içeriksiz log: gemini_retry attempt=<n> reason=<reason>.
  3 çağrı da başarısızsa gemini_error logu ve None (önbelleğe yazılmaz).
- KALICI hata (400/401/403/404, INVALID_ARGUMENT, PERMISSION_DENIED, diğerleri): tek çağrı, None.
- 429 / RESOURCE_EXHAUSTED: mevcut anahtar rotasyonu; geçici sayılmaz, _sleep çağrılmaz.
- Hem bayrak kapalı (legacy) hem bayrak açık (optimize) yol `_generate`'i kullanır; ikisi de test edilir.

Mock kuralı: parser.py `from google import genai` ile import eder -> patch hedefi `parser.genai`.
_sleep monkeypatch ile kaydedici sahteyle değiştirilir; testler gerçekten beklemez.
GeminiKeyManager gerçek sınıftır (monkeypatch.setenv + load_keys).
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
from parser import parse_listing_message

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
    """Tek bir genai istemcisi; generate_content her çağrıda sırayla yanıt ya da istisna verir."""
    client = MagicMock(name="genai_client")
    client.models.generate_content.side_effect = list(outcomes)
    return client


def _parse(text, manager):
    return asyncio.run(parse_listing_message(text, manager))


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
    """Her test hem legacy (false) hem optimize (true) yolda koşar."""
    monkeypatch.setenv(FLAG, request.param)
    return request.param


# ---------------------------------------------------------------------------
# (a) 504 sonra başarı -> bir yeniden deneme, doğru sonuç
# ---------------------------------------------------------------------------


def test_504_then_success_returns_parsed_after_one_retry(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    client = _client(Exception("504 Gateway Timeout"), _response(D_JSON))
    genai.Client.return_value = client

    result = _parse(TEXT, manager)

    assert result == D
    assert client.models.generate_content.call_count == 2
    assert sleeps == [2.0]
    assert "gemini_retry attempt=1 reason=timeout" in caplog.text


# ---------------------------------------------------------------------------
# (b) 503 üç kez -> None, 3 çağrı, 2 ve 6 sn beklemeler, gemini_error logu
# ---------------------------------------------------------------------------


def test_503_three_times_returns_none_after_three_calls_and_logs_error(flag, monkeypatch, genai, sleeps, caplog, db):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    client = _client(
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
        Exception("503 UNAVAILABLE the model is overloaded"),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert client.models.generate_content.call_count == 3
    assert sleeps == [2.0, 6.0]
    assert "gemini_error" in caplog.text
    assert _db_write_attempted(db) is False


# ---------------------------------------------------------------------------
# (c) TimeoutError iki kez sonra başarı -> 3 çağrı, 2 ve 6 sn
# ---------------------------------------------------------------------------


def test_timeout_error_twice_then_success_returns_parsed_after_two_retries(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(
        TimeoutError("read timed out"),
        TimeoutError("read timed out"),
        _response(D_JSON),
    )
    genai.Client.return_value = client

    result = _parse(TEXT, manager)

    assert result == D
    assert client.models.generate_content.call_count == 3
    assert sleeps == [2.0, 6.0]


# ---------------------------------------------------------------------------
# (d) ConnectionError bir kez sonra başarı -> 2 çağrı
# ---------------------------------------------------------------------------


def test_connection_error_once_then_success_returns_parsed(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    client = _client(ConnectionError("connection reset"), _response(D_JSON))
    genai.Client.return_value = client

    result = _parse(TEXT, manager)

    assert result == D
    assert client.models.generate_content.call_count == 2
    assert sleeps == [2.0]
    assert "gemini_retry attempt=1 reason=network" in caplog.text


# ---------------------------------------------------------------------------
# (e) 400 INVALID_ARGUMENT -> kalıcı: tek çağrı, None, bekleme yok
# ---------------------------------------------------------------------------


def test_400_invalid_argument_is_permanent_single_call_no_sleep(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(Exception("400 INVALID_ARGUMENT: request is malformed"))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert client.models.generate_content.call_count == 1
    assert sleeps == []


# ---------------------------------------------------------------------------
# (f) 403 PERMISSION_DENIED -> kalıcı: tek çağrı, None, bekleme yok
# ---------------------------------------------------------------------------


def test_403_permission_denied_is_permanent_single_call_no_sleep(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch)
    client = _client(Exception("403 PERMISSION_DENIED: caller lacks permission"))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert client.models.generate_content.call_count == 1
    assert sleeps == []


# ---------------------------------------------------------------------------
# (g) 429 RESOURCE_EXHAUSTED -> mevcut rotasyon, _sleep yok
# ---------------------------------------------------------------------------


def test_429_rotates_to_second_key_without_sleep(flag, monkeypatch, genai, sleeps):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    rate_limited = _client(Exception("429 RESOURCE_EXHAUSTED"))
    successful = _client(_response(D_JSON))
    genai.Client.side_effect = [rate_limited, successful]

    with patch.object(manager, "switch_to_next_async", wraps=manager.switch_to_next_async) as mocked_switch:
        result = _parse(TEXT, manager)

    assert result == D
    mocked_switch.assert_called_once()
    assert genai.Client.call_count == 2
    assert successful.models.generate_content.call_count == 1
    assert sleeps == []


# ---------------------------------------------------------------------------
# (h) Optimize yol (bayrak açık): 504 sonra başarı önbelleğe yazılır;
#     3 kez 504 -> None ve önbelleğe hiçbir şey yazılmaz
# ---------------------------------------------------------------------------


def test_optimized_504_then_success_returns_and_writes_cache(monkeypatch, genai, sleeps, db):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    client = _client(Exception("504 Gateway Timeout"), _response(D_JSON))
    genai.Client.return_value = client

    assert _parse(TEXT, manager) == D
    assert client.models.generate_content.call_count == 2
    assert sleeps == [2.0]
    assert _db_write_attempted(db) is True

    # Pozitif önbellek isabeti: ikinci parse Gemini'ye gitmez.
    assert _parse(TEXT, manager) == D
    assert client.models.generate_content.call_count == 2


def test_optimized_three_504_returns_none_and_caches_nothing(monkeypatch, genai, sleeps, db):
    monkeypatch.setenv(FLAG, "true")
    manager = _manager(monkeypatch)
    client = _client(
        Exception("504 Gateway Timeout"),
        Exception("504 Gateway Timeout"),
        Exception("504 Gateway Timeout"),
    )
    genai.Client.return_value = client

    assert _parse(TEXT, manager) is None
    assert client.models.generate_content.call_count == 3
    assert sleeps == [2.0, 6.0]
    assert _db_write_attempted(db) is False

    # LRU'da da kayıt yok: ikinci parse yeniden Gemini'ye gider ve başarılı olursa sonuç döner.
    client.models.generate_content.side_effect = [_response(D_JSON)]
    assert _parse(TEXT, manager) == D
    assert client.models.generate_content.call_count == 4


# ---------------------------------------------------------------------------
# (i) İçeriksiz log: mesaj metni, telefon ve sağlayıcı metni loglanmaz
# ---------------------------------------------------------------------------


def test_retry_logs_contain_no_message_or_provider_text(flag, monkeypatch, genai, sleeps, caplog):
    caplog.set_level(logging.DEBUG)
    manager = _manager(monkeypatch)
    provider_error = "504 Gateway Timeout GIZLI-SAGLAYICI 0532 111 22 33"
    client = _client(
        Exception(provider_error),
        Exception(provider_error),
        _response(D_JSON),
    )
    genai.Client.return_value = client

    assert _parse("GIZLI-MESAJ-ALFA satılık daire kadıköy temiz", manager) == D

    assert "gemini_retry attempt=1 reason=timeout" in caplog.text
    assert "gemini_retry attempt=2 reason=timeout" in caplog.text
    for token in ("GIZLI", "0532", "111 22 33"):
        assert token not in caplog.text
