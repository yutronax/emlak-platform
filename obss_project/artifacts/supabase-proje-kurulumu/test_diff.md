# Test Diff — supabase-proje-kurulumu

## Oluşturulan dosyalar
- `scraper/tests/test_verify_supabase.py` (460 satır, yeni)
- `scraper/tests/conftest.py` (46 satır, yeni — `scraper/`'ı sys.path'e ekler, `integration` marker'ını `--run-integration`/`RUN_INTEGRATION=1` olmadan skip eder)

## AC → Test eşlemesi
- **AC-2 (şema smoke check):** `test_schema_full_result_is_pass`, `test_schema_required_tables_are_the_six_expected`, `test_schema_partial_missing_one_table_is_fail`, `test_schema_missing_is_admin_column_is_fail`, `test_schema_missing_one_rpc_is_fail`, `test_schema_nothing_found_is_fail_not_silent_pass`, `test_schema_missing_lists_exact_missing_items`, `test_check_schema_missing_table_query_raises_is_reported_missing` + integration: `test_integration_schema_check_passes_on_real_project`
- **AC-3 (yaz-oku-sil):** `test_write_read_ok_with_matching_id_is_pass`, `test_write_read_row_none_is_fail`, `test_write_read_exception_is_fail`, `test_write_read_id_mismatch_is_fail`, `test_write_read_not_cleaned_is_fail`, `test_check_write_read_*` (roundtrip/empty/exception/delete-failure) + integration: `test_integration_write_read_roundtrip_on_real_project`
- **AC-4 (RLS reddi):** `test_rls_insert_succeeded_is_fail`, `test_rls_rejected_with_42501_is_pass`, `test_rls_rejected_with_row_level_security_message_is_pass`, `test_rls_failed_with_network_error_is_fail`, `test_check_rls_rejection_*` + integration: `test_integration_anon_insert_rejected_by_rls_on_real_project`
- **Kısmi başarı (zorunlu):** `test_schema_partial_missing_one_table_is_fail`, `test_partial_success_overall_is_fail`, `test_partial_schema_overall_is_fail`
- **Sessiz başarı yasağı (zorunlu):** `test_schema_nothing_found_is_fail_not_silent_pass`, `test_nothing_done_but_no_error_is_not_silent_pass`
- **Boş sonuç ↔ hata ayrımı (zorunlu):** `test_write_read_row_none_is_fail` vs `test_write_read_exception_is_fail` (ayrı senaryo), `test_describe_write_read_distinguishes_empty_from_error`, `test_empty_and_error_both_fail_as_separate_scenarios`

## Doğrulama
`python -m pytest scraper/tests -q` çalıştırıldığında `scripts.verify_supabase` henüz yazılmadığı için `ModuleNotFoundError` ile collection hatası veriyor — **beklenen red durumu**, implementasyon yok.

## code-copilot için önerilen imzalar
Alt-ajanın raporunda verdiği imzalar (`evaluate_schema`, `schema_missing`, `evaluate_write_read`, `describe_write_read`, `evaluate_rls_rejection`, `overall_verdict`, `check_schema`, `check_write_read`, `check_rls_rejection`, `main`) — tam liste rapor geçmişinde, code-copilot dispatch prompt'una aktarılacak.

## Varsayımlar (alt-ajandan taşındı, code-copilot'un doğrulaması gerek)
- Anon key ortam değişkeni adı `SUPABASE_ANON_KEY` varsayıldı (`.env.example`'da yoktu, eklenmesi gerekecek).
- RPC varlığı kontrolü (PostgREST üzerinden) henüz netleşmedi — code-copilot `0002_admin_review.sql`'deki fonksiyon imzalarını kontrol etmeli.
- Anon ile başarılı (yanlışlıkla) insert olursa temizlik yapılamaz (RLS silmeyi de reddeder) — script bunu raporda "temizlenemedi" olarak işaretlemeli, bunun için ayrı bir test yok, code-copilot not almalı.

## Change-log
Saga bağlantısı yok, atlandı.
