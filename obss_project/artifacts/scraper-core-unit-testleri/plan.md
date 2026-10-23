# Plan — scraper-core-unit-testleri
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev, saf Python modülleri).

## Files to Modify
(Yok — mevcut implementasyon dosyalarına dokunulmuyor, sadece okunacak.)

## New Files
| File | Purpose | Alan |
|------|---------|------|
| scraper/tests/test_fingerprint.py | AC-1, AC-2 — `compute_fingerprint` normalizasyon/determinizm testleri | backend |
| scraper/tests/test_quality_gate.py | AC-3..10 — `score_listing`/`is_safe_to_auto_approve` testleri | backend |
| scraper/tests/test_parser.py | AC-11..16 — `parse_listing_message` testleri (Gemini client mock'lanır) | backend |

## Dependencies
- `scraper/fingerprint.py::compute_fingerprint` — dış bağımlılık yok (hashlib/re/unicodedata), saf fonksiyon.
- `scraper/quality_gate.py::score_listing`, `is_safe_to_auto_approve` — dış bağımlılık yok, saf fonksiyon.
- `scraper/parser.py::parse_listing_message` — `google.genai.Client` ve `api_key_manager.GeminiKeyManager`'a bağımlı.
  - `GeminiKeyManager` gerçek sınıfı basit (round-robin + cooldown, DB/network yok) — testlerde **gerçek instance** kullanılabilir, `monkeypatch.setenv("GEMINI_API_KEYS", ...)` ile key'ler enjekte edilir; `MagicMock()` yerine gerçek sınıf tercih edilir çünkü `get_all_keys()`/`switch_to_next_async()` arasındaki round-robin/cooldown etkileşimi gerçek davranış (bkz. AC-14/15 arayüzü gerçek sınıfın `_exhausted_at`/`_index` state'ine bağlı).
  - `genai.Client(...)` ve onun `.models.generate_content(...)` çağrısı `unittest.mock.patch("parser.genai")` ile TAM mock'lanır — gerçek API'ye hiç gidilmez.
  - **ZORUNLU mock-patch hedefi:** `parser.py` → `from google import genai` ile import ediyor, bu yüzden patch hedefi `parser.genai` olmalı (`google.genai` DEĞİL) — conftest/test_orchestrator_dedup.py'deki aynı "import eden modülün namespace'i" kuralı.

## Migration Required?
Hayır — hiçbir schema/veri değişikliği yok, sadece test dosyası ekleniyor.

## Risks
- `parser.py`'nin `async def parse_listing_message` olması nedeniyle testler `pytest.mark.asyncio` (veya `pytest-asyncio` kurulu değilse `asyncio.run(...)`) gerektirir — `scraper/requirements.txt`'te `pytest-asyncio` olup olmadığı test-copilot tarafından kontrol edilmeli, yoksa `asyncio.run()` ile çağrılmalı (ek bağımlılık eklememek için tercih edilir).
- `GeminiKeyManager.load_keys()` ortam değişkenini (`GEMINI_API_KEYS`/`GEMINI_API_KEY`) okuyor — testler `monkeypatch.setenv`/`delenv` ile izole edilmeli, gerçek `.env`'deki değere bağımlı olmamalı.
- `score_listing`'in kümülatif düşüş/clamp davranışı (AC-9) kodda doğrulandı ama hiç test edilmemişti — test-copilot tam sayısal beklenen değeri (ör. price_missing(-0.1) + city_missing(-0.3) + area_out_of_range(-0.2) = 0.4) elle hesaplayıp assert etmeli, yaklaşık/toleranslı karşılaştırma değil.

## Open Questions
(Yok — atdd.md'nin Unknowns bölümündeki tek madde, GeminiKeyManager arayüzü, bu adımda `api_key_manager.py` okunarak çözüldü: gerçek sınıf basit ve testte doğrudan kullanılabilir, mock gerektirmiyor.)
