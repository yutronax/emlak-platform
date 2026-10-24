# Plan — faz-b-scraper-guvenilirlik-sertlestirme
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev, scraper/ dosyaları).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| scraper/orchestrator.py | `do_POST`'taki `json.loads(body or b"{}")` çağrısı except'siz — AC-1/AC-2 | low | backend |
| scraper/parser.py | `genai.Client(api_key=api_key)` çağrısına `http_options=HttpOptions(timeout=30000)` eklenecek — AC-3/AC-4 | low | backend |
| scraper/sidecar/bridge.js | `processIncomingMessage`'ın `else` dalına (no_text) dosya loglama eklenecek — AC-5/AC-6 | low | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| scraper/tests/test_orchestrator_webhook_encoding.py | AC-1/AC-2 — bozuk body/eksik alan testleri | backend |
| scraper/tests/test_parser_timeout.py | AC-3/AC-4 — Gemini timeout/normal cevap testleri | backend |
| scraper/sidecar/bridge.unhandled-log.test.js | AC-5/AC-6 — unhandled log yazımı/log-hatası testleri | backend |

## Dependencies
- `scraper/orchestrator.py::do_POST` — mevcut 401/404/400(JSON parse hatası zaten var, satır 126-129) akışına ek olarak, `json.loads`'ın KENDİSİNİN de (satır 125) `json.JSONDecodeError` DIŞINDA `UnicodeDecodeError` fırlatabildiği doğrulandı (Faz A'da canlı tespit edildi) — mevcut `except json.JSONDecodeError` bloğu `UnicodeDecodeError`'ı YAKALAMIYOR, bu yüzden `except (json.JSONDecodeError, UnicodeDecodeError):` olarak genişletilecek.
- `scraper/parser.py::parse_listing_message` — `genai.Client(api_key=api_key)` çağrısı her denemede (retry döngüsü içinde) yeniden oluşturuluyor; `http_options=HttpOptions(timeout=30000)` parametresi bu constructor çağrısına eklenecek. **Doğrulandı (gerçek SDK API'si):** `google.genai.types.HttpOptions.model_fields['timeout']` = `Union[int, None]`, açıklama: "Timeout for the request in milliseconds." — yani değer **milisaniye** cinsinden, 30000 = 30s.
- `scraper/sidecar/bridge.js::processIncomingMessage` — `else` dalındaki mevcut `console.log('[filter] skipped (type=no_text...)')` satırının YANINA (yerine değil) bir `fs.appendFileSync(UNHANDLED_LOG, ...)` eklenecek. maviLojistik/sidecar/bridge.js'teki `UNHANDLED_LOG` sabiti (`path.join(__dirname, 'bridge_unhandled_messages.log')`) ve try/catch ile sarmalanmış (asıl işlevi durdurmayan) desen birebir örnek alınacak.

## Migration Required?
Hayır — hiçbir şema/veri değişikliği yok.

## Risks
- (atdd.md'den) Gemini timeout'un `generate_content`'in SENKRON çağrısını gerçekten kesip kesmediği — `http_options.timeout` sunucu tarafı bağlantı/okuma timeout'udur (SDK'nın HTTP client'ına iletilir), Python tarafında thread'i zorla kesmez ama HTTP isteğinin kendisi bu süre sonunda bağlantı hatası fırlatacak şekilde yapılandırılıyor — bu, atdd.md'nin AC-3'ünün beklediği "worker thread asılı kalmaz" sonucunu sağlıyor (istek süresiz değil, SDK'nın HTTP client'ı belirtilen sürede timeout exception'ı fırlatacak).
- `UnicodeDecodeError`'ın `except` bloğuna eklenmesi, mevcut `except json.JSONDecodeError` davranışını (zaten var olan, atdd.md'nin regresyon şartı olan AC-2'nin bir parçası) BOZMAMALI — sadece ek bir exception türü yakalanacak, mevcut dal değişmeyecek.

## Open Questions
Yok — atdd.md'nin Unknowns bölümündeki tek madde (Gemini SDK'nın timeout API'si) bu adımda doğrulanıp çözüldü (yukarıdaki Dependencies bölümü).
