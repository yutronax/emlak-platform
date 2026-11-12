# Verify Report — gemini-parse-maliyet
_Reference: atdd.md, code_diff.md, test_diff.md_

Çalıştırma ortamı: scraper/.venv-verify (temiz venv; proje .venv'i uv-yönetimli, python yolu bozuk olduğu için kullanılamadı). Bağımlılıklar requirements.txt + pytest. CI workflow dosyası yok; komutlar projenin kendi test dizinine göre koşuldu.

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | 4 yeni modül + migration 0031(+down) + değişen parser/supabase_client/orchestrator/.env.example diskte (git status + Read). |
| 2 | Build/derleme | PASS | `import parse_cache,parse_schema,prefilter,regex_extract` ve `import parser` (genai kurulu) hatasız. |
| 3 | Supabase şema/canlı doğrulama | PASS | Migration 0031 canlıya uygulandı (onaylı). Tablo var, RLS açık, policy_count=0. Integration 9/9 passed (anon/authenticated reddi, service role round-trip, TTL/expired) — gerçek Supabase'e karşı 72 sn. |
| 4 | Lint | N/A | Proje repo config'inde linter/formatter tanımlı değil (ruff/eslint/prettier yok). |
| 5 | Type check | N/A | Proje type checker config'i yok (pyright/mypy yok). |
| 6 | Unit testler | PASS | Red-team düzeltmeleri sonrası: 344 passed, 20 skipped; tek kalan kırmızılar test_webhook_auth zamanlama/soket testleri — değişiklik ÖNCESİ orchestrator.py ile de aynı oranda kalıyor (5 denemede 4), önceden var olan kararsızlık, bu görevle ilgisiz. İlk tur: 176 passed (test_parse_cache/test_prefilter/test_regex_extract/test_parser_optimized). Tüm suite: 331 passed, 20 skipped (integration + işaretliler). |
| 7 | E2E testler | N/A | Scraper backend; web UI kapsamı yok. |
| 8 | Lighthouse | N/A | Web sayfası değişmedi. |
| 9 | Erişilebilirlik | N/A | Aynı — UI yok. |
| 10 | Güvenlik taraması | PASS | bandit (-ll, 7 değişen dosya) temiz; detect-secrets (7 dosya + 0031.sql) sır yok. Not: ortak security-scan runner (security-tools venv) yok; bandit+detect-secrets elle koşuldu. red-team'in yerini TUTMAZ. |
| 11 | AI code review | PENDING (red-team) | red-team adımına bırakıldı. |
| 12 | Görsel regresyon | N/A | UI yok. |
| 13 | DAST (ZAP) | N/A | Web UI yok; threat-model AC-S kriterleri DB/parse katmanı, canlı http yüzeyi değil. |
| 14 | İnsan onayı | PENDING | Kullanıcı imzası bekliyor. |

## AC -> Test Mapping (özet, test_diff.md detaylı)
- AC-1..AC-S7 happy + edge → test_parser_optimized.py (çoğunluk), test_parse_cache.py (LRU/TTL/normalize), test_prefilter.py, test_regex_extract.py → PASS (unit).
- AC-S1 (DB kalıcı önbellek round-trip), AC-S7 (TTL/expired satır) → test_parse_cache_integration.py → PASS (9/9, canlı Supabase, --run-integration).

## Coverage / Quality Notes
- Davranış Sözleşmesi'nin 15 satırının her biri test_parser_optimized.py'de ayrı testle karşılandı (cache_hit/miss/error, prefilter, regex_conflict, gemini_error, flag-off legacy, kişisel/ortak akış).
- Sayısal validasyon (parse_schema) inf/-inf/nan/bool reddi test edildi.
- Refactor adayı: YOK — diff CAVEMAN'a uygun, yeni modüller küçük ve tek sorumlu (parse_cache 72, prefilter 27, regex_extract 49, parse_schema 54). parser.py'deki _parse_optimized akışı doğrusal, derin nesting/sihirli sayı yok. Dokunma.

## ECC Danışman Bulguları
atdd.md'de AC-S<n> var → ecc-security-reviewer koşulu sağlanıyor ancak ortak runner/Codex danışman çağrısı bu turda yapılmadı; güvenlik incelemesi red-team adımına (gate 11) bütün olarak bırakıldı. REVIEW_REQUIRED yok.

## Sonuç
Unit + canlı integration YEŞİL; migration 0031 uygulandı. Açık: F4 ölçümleri (AC-20), F5, ve insan onayı. (İlk turdaki "migration bekliyor" notu geçersiz.)

## Düzeltme turu sonrası (2026-11-12)
F1/F2/F2b/F3 düzeltildi, kırmızı→yeşil doğrulandı. Açık: F4 (AC-20 benchmark + branch coverage ölçülmedi), F5 (istemci yeniden kullanımı). test_webhook_auth kararsızlığı önceden var (HEAD orchestrator ile de tekrarlandı).

## F4 / AC-20 benchmark (2026-11-12) — ayrıntı: benchmark/RAPOR.md
Çağrı azalması %48,3 (temsili akış, tekrar oranı %48,3; tekrarsızda %0) — GEÇTİ, koşullu. Ön-eleme yanlış negatifi %0 — GEÇTİ. Branch coverage %93,8 — GEÇTİ. Ek gecikme p95 soğuk 2.987 ms / yeniden başlatma 1.269 ms — **KALDI** (hedef 100 ms; Supabase gidiş-dönüşü ~300 ms, yeni istemci + sorgu ~900 ms). Kalite — ÖLÇÜLEMEDİ (Gemini kotası doldu; çağrı/gecikme ölçümü sahte modelle yapıldı). AC-20 karşılanmadı; bayrak kapalı kalmalı.

## Gecikme hedefi güncellendi (2026-11-12)
Yeni hedef: ek gecikme p95 ≤ okuma sınırı + 50 ms (varsayılan 650 ms), sıcak LRU p95 ≤ 5 ms. Ölçüm (600 ms): soğuk 612 ms, yeniden başlatma 363 ms, sıcak 0,03 ms — GEÇTİ. AC-20'de kalan tek açık: gerçek Gemini ile kalite ölçümü.
