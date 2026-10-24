# Test Diff — faz-b-scraper-guvenilirlik-sertlestirme
_Reference: atdd.md, plan.md_

## Oluşturulan dosyalar
- `scraper/tests/test_orchestrator_webhook_encoding.py` — AC-1, AC-2 (gerçek TCP soket + `http.client`, `test_webhook_auth.py` deseni)
- `scraper/tests/test_parser_timeout.py` — AC-3, AC-4 (`genai.Client`'ın `http_options=HttpOptions(timeout=30000)` ile çağrıldığını mock argümanlarından assert ediyor)
- `scraper/sidecar/bridge.unhandled-log.test.js` — AC-5, AC-6 (`node:test`, `bridge.filter.test.js` deseni)

## Bağımsız doğrulama (orkestratör tarafından, alt-ajanın raporuna güvenilmeden)
- `scraper/.venv/Scripts/python.exe -m pytest tests/test_orchestrator_webhook_encoding.py tests/test_parser_timeout.py -v` → **7 failed, 4 passed** (alt-ajanın raporuyla birebir eşleşti).
- `node --test bridge.unhandled-log.test.js` → **6 failed, 2 passed**.

## AC -> Test Mapping
1. AC-1 -> `test_ac1_broken_utf8_body_returns_400_with_invalid_body_error[leading_invalid_bytes,invalid_utf8_inside_string]` + 2 yan kontrol -> RED
2. AC-2 -> `test_ac2_valid_json_without_text_returns_200_with_empty_object`, `test_ac2_valid_json_without_text_is_not_enqueued`, `test_ac2_valid_json_with_empty_text_is_not_enqueued` -> RED
3. AC-3 -> `test_ac3_genai_client_is_constructed_with_http_timeout_30000ms`, `test_ac3_timeout_is_applied_on_every_client_construction_during_rotation` -> RED
4. AC-4 -> `test_ac4_normal_response_still_returns_parsed_dict_unchanged`, `test_ac4_normal_response_is_not_treated_as_timeout` -> GREEN (regresyon, beklenen)
5. AC-5 -> 4 test (dosyaya satır ekleme, PII yokluğu, konsol logu korunması, üst üste yazma) -> RED
6. AC-6 -> 4 test (appendFileSync hatası fırlatmaz, uyarı mesajı, akış devam eder, PII yok) -> RED (2'si zaten yeşil çıktı, implementasyon öncesi beklenmeyen bir durum değil — mevcut akışın "devam etme" davranışı zaten vardı)

## Plan.md'nin ötesinde çıkan gerçek kapsam notu (önemli)
`plan.md`, AC-2'nin "mevcut davranış korunur (regresyon testi)" olduğunu varsaymıştı, ama test-copilot kod okuyarak şunu buldu: `orchestrator.py` şu an `text` alanı kontrolü YAPMADAN payload'ı kuyruğa koyuyor — yani AC-2 aslında YENİ bir davranış gerektiriyor (regresyon değil). Bu, atdd.md'nin AC-2 metninin ("kuyruğa EKLENMEZ") zaten talep ettiği şey — kapsam genişlemesi değil, plan.md'nin yanlış bir varsayımının düzeltilmesi. `code-copilot`'a bu netleştirmeyle gidecek.
