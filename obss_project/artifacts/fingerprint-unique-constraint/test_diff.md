# Test Diff — fingerprint-unique-constraint

## Oluşturulan Dosyalar
- `scraper/tests/test_insert_raw_listing.py` (yeni, pytest + unittest.mock)
- `scraper/tests/test_orchestrator_dedup.py` (yeni, pytest + unittest.mock)

## AC → Test Eşleşmesi
| AC | Test |
|---|---|
| AC-1 | `test_integration_fingerprint_partial_unique_index_exists_on_real_project` (integration) |
| AC-2 | `test_duplicate_fingerprint_unique_violation_is_swallowed_returns_inserted_false` |
| AC-3 | `test_integration_concurrent_inserts_with_same_fingerprint_result_in_one_row` (integration, gerçek threading) |
| AC-4 | `test_first_insert_succeeds_returns_inserted_true`, `test_different_fingerprints_both_insert_successfully` |
| AC-5 | `test_non_unique_violation_api_error_is_not_swallowed_raises`, `test_generic_connection_error_is_not_swallowed_raises` |
| AC-6 | `test_handle_message_logs_written_when_insert_raw_listing_reports_inserted_true`, `test_handle_message_logs_written_vs_skipped_are_distinct`, `test_handle_message_logs_skipped_when_insert_raw_listing_reports_inserted_false` |
| AC-7 | Henüz test yok — migration'ın RAISE NOTICE çıktısı pytest ile doğrudan test edilemez (migration çalıştırma log'u), code-copilot migration'ı yazdıktan sonra `supabase-check`/`verify` adımında manuel/log kontrolüyle doğrulanacak |

## Doğrulama
`scraper/.venv/Scripts/python.exe -m pytest tests/test_insert_raw_listing.py tests/test_orchestrator_dedup.py -v` çalıştırıldı (orkestratör tarafından bağımsız olarak, scraper'ın kendi venv'i kullanılarak):
- 5 FAILED (beklenen red — insert_raw_listing henüz "inserted" sözleşmesini desteklemiyor)
- 3 PASSED (AC-5'in exception-propagation testleri — mevcut kod zaten hatayı yutmuyor, bu davranış korunacak, yeni değil)
- 2 SKIPPED (integration testleri, `--run-integration`/`SUPABASE_URL` gerektirir, varsayılan davranış)

## Mock-Patch Doğrulaması
`test_orchestrator_dedup.py`, `orchestrator.insert_raw_listing`'i (test edilen kodun import namespace'i) patch'liyor — `supabase_client.insert_raw_listing` DEĞİL. Doğru hedef.

## Doğrudan Tetikleme Doğrulaması
Her iki test dosyası da gerçek fonksiyonları (`insert_raw_listing`, `orchestrator.handle_message`) doğrudan çağırıyor, kendi "if" dalı yazmıyor.
