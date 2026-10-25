# Verify Report — plans-rls-anon-select-izni
_Reference: atdd.md, code_diff.md, test_diff.md_

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | `git status --short` — `supabase/migrations/0010_plans_anon_select.sql` ve `scraper/tests/test_plans_rls_anon_select.py` untracked, diskte mevcut |
| 2 | Build/derleme | N/A | SQL migration için derleme adımı yok; Python test dosyası `ast.parse` ile syntax-sağlam doğrulandı (PASS) |
| 3 | Supabase şema/canlı doğrulama | **PASS** | Migration kullanıcı tarafından Dashboard SQL Editor'den uygulandı. Canlı doğrulama: migration öncesi anon SELECT → `200+[]` (sorunun kendisi); migration sonrası anon SELECT → `200` + 3 satır (service_role sayımına eşit). Anon INSERT → `401`, `code: 42501`. Gerçek bir test kullanıcısı oluşturulup (auth admin API) authenticated SELECT ile 3 satır doğrulandı, sonra kullanıcı silindi (temizlik yapıldı) |
| 4 | Lint | N/A | Proje linter tanımlamıyor (eslintrc/ruff/flake8 config yok) |
| 5 | Type check | N/A | Proje type-checker tanımlamıyor (CI workflow dosyası da yok) |
| 6 | Unit testler | PASS (integration ağırlıklı) | `RUN_INTEGRATION=1 pytest tests/test_plans_rls_anon_select.py --run-integration -v` → **4 passed, 2 skipped**. Geçenler: AC-1 (anon SELECT), AC-S1×3 (anon INSERT/UPDATE/DELETE reddi). Skip olanlar aşağıda "Coverage / Quality Notes"ta |
| 7 | E2E testler | N/A | `/pricing` kodu değişmedi (atdd.md Kapsam Dışı), e2e render testi bu görevin parçası değil |
| 8 | Lighthouse (performans) | N/A | Web UI'ya dokunulmuyor |
| 9 | Erişilebilirlik | N/A | Aynı neden |
| 10 | Güvenlik taraması | PASS | `security-scan` → secrets: PASS, python_sast: PASS, deps: N/A (manifest yok). Verdict: PASS, exit 0 |
| 11 | AI code review | PENDING (red-team) | Bu adıma bırakıldı |
| 12 | Görsel regresyon | N/A | UI kodu değişmiyor |
| 13 | DAST (ZAP) | N/A | Web UI kapsamı yok, AC-S'ler zaten DB-seviyesinde canlı doğrulandı |
| 14 | İnsan onayı | PENDING | commit öncesi kullanıcı onayı bekleniyor |

## AC → Test Mapping
| AC | Test | Sonuç |
|---|---|---|
| AC-1 | `test_ac1_anon_select_returns_exact_service_row_count` | **PASS** (canlı) |
| AC-2 | `test_ac2_authenticated_select_returns_same_row_count` | SKIP (ortamda `SUPABASE_TEST_USER_JWT` yok) — **ayrıca canlı olarak elle doğrulandı**: geçici test kullanıcısı oluşturulup authenticated SELECT ile 3 satır görüldü, kullanıcı silindi |
| AC-S1 (INSERT) | `test_acs1_anon_insert_rejected_and_table_unchanged` | **PASS** (canlı) |
| AC-S1 (UPDATE) | `test_acs1_anon_update_affects_zero_rows_and_data_unchanged` | **PASS** (canlı) |
| AC-S1 (DELETE) | `test_acs1_anon_delete_affects_zero_rows_and_data_unchanged` | **PASS** (canlı) |
| AC-S2 | `test_acs2_pg_policies_plans_select_roles_and_no_anon_write_policy` | SKIP (ortamda `SUPABASE_DB_URL` yok, `pg_policies`'e PostgREST üzerinden erişilemiyor) — **kısmen kapsanmış**: migration dosyasının kod incelemesi (`for select`, `for all` DEĞİL) + AC-S1'in canlı PASS sonucu (anon'un gerçekten yazamadığı ampirik olarak kanıtlandı) bu AC'nin pratik güvencesini sağlıyor, ama `pg_policies` yapısal introspection'ı çalıştırılamadı |
| AC-S3 | (statik/manuel kontrol, `plan` adımında) | **PASS** — `plans` sütun listesi (`id, name, price_minor_unit, currency, max_listings, created_at, sort_order`) incelendi, hassas sütun yok |
| AC-6 (boş tablo) | (test yazılmadı) | **Kapsanmadı** — aşağıda not edildi |

## Coverage / Quality Notes
- **AC-2 ve AC-S2 otomatik testte skip oldu** ama AC-2 bu raporda canlı olarak elle doğrulandı (yukarıda). AC-S2'nin `pg_policies` introspection'ı bu ortamda (`SUPABASE_DB_URL` yok) çalıştırılamadı — ileride bu ortam değişkeni eklenirse test otomatik PASS olacak, şimdilik statik kod incelemesi + AC-S1'in canlı kanıtı ile kabul edilebilir bir risk.
- **AC-6 (plans tablosu boşsa)** için hiç test yazılmadı (test_diff.md'de de not edilmişti) — gerçek tabloda zaten 3 satır var ve bu senaryo düşük öncelikli (Medium), ama bu bir test-gap olarak açıkça kayıtlı.
- Test stratejisi oranı (unit 10/integration 70/e2e 20) fiilen integration-ağırlıklı gerçekleşti; "unit %10" ayrı bir dosya olarak değil, migration içeriğinin statik incelemesi olarak karşılandı — bu plan.md'de zaten öngörülmüştü.

## Refactor Aday Kontrolü
Değişen dosyalar: tek bir 5 satırlık migration dosyası + tek bir test dosyası. Tekrar/sihirli sayı/derin nesting/uzun parametre listesi/ölü kod kriterlerine bakıldı — **aday yok** (diff zaten minimal/CAVEMAN'a uygun, hiçbir dosya değiştirilmedi, sadece 2 yeni dosya eklendi).

## Red-team Sonrası Yeniden Doğrulama (2026-10-25)
Red-team'in 4 bulgusundan 3'ü düzeltildi, 1'i kullanıcı kararıyla kabul edilmiş risk:
- **AC-2 fix (PASS, canlı):** test artık kendi geçici kullanıcısını oluşturup siliyor, dış JWT bağımlılığı kalktı.
- **Rollback dosyası (eklendi):** `supabase/rollback/0010_plans_anon_select_rollback.sql`.
- **Yazma-denemesi güvenlik koruması (eklendi):** `_guard_write_probe_environment()`, >100 satır varsa testi durdurur.
- **AC-S2 (kabul edilmiş risk):** Kullanıcı gerçek DB şifresini sağladı, doğrudan bağlantı (`db.<ref>.supabase.co:5432`) denendi, bu ortamda IPv6 çıkışı olmadığından host çözülemedi (`getaddrinfo failed`). Kullanıcı "kabul edilmiş risk, commit et" dedi.

**Son test koşumu:** `RUN_INTEGRATION=1 pytest tests/test_plans_rls_anon_select.py --run-integration -v` → **5 passed, 1 skipped** (sadece AC-S2 skip).
