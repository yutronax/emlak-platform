# Test Diff — plans-rls-anon-select-izni

## Oluşturulan Dosya
`scraper/tests/test_plans_rls_anon_select.py` (yeni, 6 integration test, `@pytest.mark.integration` ile işaretli — conftest.py'nin mevcut mekanizmasıyla varsayılan olarak atlanır, `--run-integration`/`RUN_INTEGRATION=1` gerektirir)

## AC → Test eşlemesi
| AC | Test fonksiyonu |
|---|---|
| AC-1 | `test_ac1_anon_select_returns_exact_service_row_count` |
| AC-2 | `test_ac2_authenticated_select_returns_same_row_count` |
| AC-S1 (INSERT) | `test_acs1_anon_insert_rejected_and_table_unchanged` |
| AC-S1 (UPDATE) | `test_acs1_anon_update_affects_zero_rows_and_data_unchanged` |
| AC-S1 (DELETE) | `test_acs1_anon_delete_affects_zero_rows_and_data_unchanged` |
| AC-S2 | `test_acs2_pg_policies_plans_select_roles_and_no_anon_write_policy` |

AC-S3 (hassas sütun kontrolü) zaten `plan` adımında statik olarak doğrulandı (kod okuyarak) — bu bir test değil, karar kaydı.
AC-6 (boş tablo) için ayrı bir test yazılmadı — mevcut 3 satırlık fixture veri üzerinden AC-1 "tam eşleşme" kuralı zaten bu senaryoyu dolaylı kapsıyor (not: ayrı bir boş-tablo testi yazılmadığı açıkça not edilmeli, bu bir sınırlama).

## Doğrulama (ilk red step)
`./.venv/Scripts/python -m pytest tests/test_plans_rls_anon_select.py -v` → 6/6 skipped (integration marker, ortam değişkenleri/`postgrest`/`psycopg` bu makinede yok) — collection hatasız, red step beklendiği gibi "henüz çalıştırılamıyor" durumunda.

## Varsayımlar (alt-ajandan)
- Authenticated token `SUPABASE_TEST_USER_JWT` env değişkeninden; yoksa AC-2 testi anlamlı mesajla skip eder. **(Red-team sonrası kaldırıldı — aşağıya bakın.)**
- `pg_policies` sorgusu PostgREST üzerinden değil, doğrudan Postgres'e (`SUPABASE_DB_URL` + `psycopg`) gidiyor — eksikse skip.
- Servis sayımının tam 3 olduğu varsayılıyor (atdd.md'deki placeholder veri).

## Sınırlama
AC-6 (boş tablo edge case) için ayrı bir integration test yazılmadı — bu, `verify`/`red-team` adımında `test-gap` olarak işaretlenmeli, kullanıcıya rapor edilecek.

## Red-team Sonrası Düzeltmeler (2026-10-25)
- AC-2 testi artık `SUPABASE_TEST_USER_JWT` ortam değişkenine bağımlı değil — test kendi geçici kullanıcısını oluşturup (service_role admin API) siliyor. Dış JWT sağlama adımı tamamen kalktı.
- 3 yazma-denemesi testine (`test_acs1_*`) ortak bir `_guard_write_probe_environment()` koruması eklendi: `plans` tablosunda 100'den fazla satır varsa test durur, yanlış/üretim ortamına karşı yazma denemesi göndermez.
- AC-S2 (`pg_policies`) testi hâlâ skip — `SUPABASE_DB_URL` ile doğrudan bağlantı denendi, bu ortamda IPv6 çıkışı olmadığından host çözülemedi. Kullanıcı kararıyla kabul edilmiş risk olarak bırakıldı (bkz. red_team.json, finding 1, outcome: accepted_risk → not: skipped).

## Son Koşum (verify sonrası)
`RUN_INTEGRATION=1 pytest tests/test_plans_rls_anon_select.py --run-integration -v` → **5 passed, 1 skipped** (sadece AC-S2).
