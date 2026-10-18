# Verify Report — pricing-plans-sort-order-fix
_Reference: atdd.md, plan.md, test_diff.md, code_diff.md_

## GÜNCELLEME — Gate 3 artık PASS
Kullanıcı 0003 (iki ayrı çalıştırma: önce `alter type ... add value`, sonra
tablolar/index — enum kısıtı nedeniyle tek script yerine ayrı çalıştırıldı;
index predicate'indeki `status::text` cast'i de `status` olarak düzeltildi,
çünkü enum→text cast'i STABLE'dır, IMMUTABLE değil, partial index'te
kullanılamaz) ve 0006'yı gerçek Supabase projesine SQL Editor'den uyguladı.
Doğrulama (REST, service-role ile):
- `GET /rest/v1/plans?select=id,name,price_minor_unit,sort_order` → 200, `[]` (tablo/kolon var, satır yok)
- `GET /rest/v1/subscriptions?select=id,plan_id` → 200, `[]` (kolon var)
- `GET /rest/v1/payment_events` → 200, `[]` (tablo var)

AC-5 (backfill sıralaması) bu projede şu an tartışmasız: `plans` tablosu
boş olduğu için backfill'in hiçbir satırı yok, sıralama çakışması riski
yok. Gate 3 → **PASS**.

## KRİTİK BULGU (ilk tespit, artık giderildi — Gate 3 — Supabase canlı doğrulama FAIL idi)
Gerçek Supabase projesinde (`bbjmjzixcugdwbcwydux.supabase.co`, REST API
ile doğrudan sorgulandı) **`plans` tablosu HİÇ YOK**:
```
GET /rest/v1/plans?select=id,name,sort_order&limit=1
→ 404 {"code":"PGRST205", "message":"Could not find the table 'public.plans' in the schema cache"}
```
Ayrıca `subscriptions.plan_id` kolonu ve `payment_events` tablosu da yok
(`42703` / `PGRST205`). Bu, `0006_plans_sort_order.sql`'in bir eksiği
DEĞİL — `supabase/migrations/0003_subscriptions_payment.sql`'in (plans
tablosunu, payment_events'i ve subscriptions.plan_id'yi oluşturan migration)
GERÇEK projeye HİÇ UYGULANMADIĞININ kanıtı. Bu proje migration'ları
`supabase db push` ile değil, elle SQL Editor'den uyguluyor (bkz.
`supabase-check` skill'inin kendi notu) — 0003 bu şekilde hiç çalıştırılmamış.

**Sonuç: EML-19'un orijinal varsayımı ("plans tablosu var ama sort_order
eksik") gerçek projede YANLIŞ — plans tablosu gerçek projede zaten yok.**
Kod/test tarafı (atdd.md'nin varsaydığı senaryo) doğru ve tamamlandı, ama
canlıda hiçbir şey çalışmayacak çünkü temel tablo eksik.

**Kullanıcıdan gereken eylem:** Supabase Dashboard → SQL Editor'de SIRAYLA
çalıştırılmalı:
1. `supabase/migrations/0003_subscriptions_payment.sql` (plans, payment_events,
   subscriptions.plan_id vb. — hiç uygulanmamış)
2. `supabase/migrations/0004_fix_agents_self_update_rls.sql`,
   `0005_agents_immutable_columns.sql` (bunların uygulanıp uygulanmadığı da
   bu görev kapsamında doğrulanmadı — ayrı bir kontrol gerekebilir)
3. `supabase/migrations/0006_plans_sort_order.sql` (bu görevin kendi migration'ı)

Bu skill (`supabase-check`) kod yazmaz/düzeltmez, sadece doğrular — bu
eksikliği gidermek `code-copilot`'un işi değil, SQL Editor'den elle
çalıştırma kullanıcının işi.

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | `Read` ile doğrulandı: `supabase/migrations/0006_plans_sort_order.sql`, `web/src/test/fake-supabase.ts` diskte, code_diff.md'nin iddia ettiği gibi. |
| 2 | Build/derleme | PASS | `npm run build` → "Compiled successfully", `/pricing` route listede (ƒ dynamic). |
| 3 | Supabase şema/canlı doğrulama | **PASS** (düzeltme sonrası) | İlk denemede FAIL idi (plans tablosu yoktu). Kullanıcı 0003+0006'yı SQL Editor'den uyguladı (index predicate'indeki enum::text cast hatası düzeltilerek). Şimdi `plans`/`sort_order`, `subscriptions.plan_id`, `payment_events` gerçek projede REST ile doğrulandı (200, bkz. yukarıdaki "Güncelleme"). |
| 4 | Lint | PASS (2 uyarı) | `npm run lint` → 0 error, 2 warning (`fake-supabase.ts:70` kullanılmayan generic `T` — bu PR'ın kendi eklediği kod; `agents-self-update-rls.test.ts:61` önceden var olan, bu PR'a ait değil). Formatter (`prettier`) proje config'inde tanımlı değil — N/A. |
| 5 | Type check | PASS | `npx tsc --noEmit` → çıktı yok, hata yok. |
| 6 | Unit testler | PASS | `npm run test -- --run` → 8 dosya, 44/44 test PASS (migration dosya-sistemi testi dahil, önceden red idi). |
| 7 | E2E testler | N/A | Projede konfigüre edilmiş bir e2e suite yok; gerçek bir e2e/Playwright akışı gate 3'ün FAIL olması nedeniyle gerçek veriyle çalıştırılamaz (plans tablosu yok). |
| 8 | Lighthouse | N/A | Bu görev performans kriteri taşımıyor (atdd.md: "Performance Target: yok"). |
| 9 | Erişilebilirlik | N/A | Aynı gerekçe — gate 8 ile birlikte N/A. |
| 10 | Güvenlik taraması | PASS | `security-scan` skill'i çalıştırıldı: secrets=PASS, python_sast/python_deps/node_deps=N/A (ilgisiz dosya türleri). Verdict: PASS. |
| 11 | AI code review | PENDING (pm/red-team) | Bu adıma devredilmiş, burada yapılmadı. |
| 12 | Görsel regresyon | N/A | Bu görevde hiçbir `.tsx`/`.css` dosyası değişmedi (bkz. `plan.md`'nin frontend-pipeline notu). |
| 13 | DAST (ZAP) | N/A | threat-model AC-S<n> üretmedi (atdd.md: `threat_model: not-applicable`). |
| 14 | İnsan onayı | PENDING | Her zaman son adım — kullanıcı onayı bekleniyor. |

## AC -> Test Mapping
1. AC-1 (happy path, sıralı render) → `page.test.tsx`: "AC-1 / Davranış Sözleşmesi #1" → PASS (mock seviyesinde; gerçek DB'de gate 3 FAIL nedeniyle doğrulanamadı)
2. AC-2 (şema: integer/not null/default 0) → `plans-sort-order.test.ts`: iki test → PASS (dosya-sistemi seviyesinde; gerçek DB'de gate 3 FAIL nedeniyle doğrulanamadı)
3. AC-3 (boş liste) → `page.test.tsx`: "AC-3 / Davranış Sözleşmesi #2" → PASS
4. AC-4 (42703 regresyon) → `page.test.tsx`: "AC-4 / Davranış Sözleşmesi #3" → PASS
5. AC-5 (backfill sıralaması farklı/fiyat sırasına uygun) → Kapsanmadı (unit testlerde test edilemez) → gerçek DB'de gate 3 FAIL nedeniyle doğrulanamadı, migration 0003+0006 uygulandıktan SONRA ayrıca kontrol edilmeli.

## Coverage / Quality Notes
- Tüm Acceptance Criteria'ların en az bir testi var; AC-5 sadece gerçek DB'de
  doğrulanabilir, bu normal (atdd.md de bunu Integration katmanına
  bırakmıştı).
- `fake-supabase.ts:70`'teki kullanılmayan generic `T` lint uyarısı küçük
  bir temizlik adayı ama davranışı etkilemiyor (TS'in gerçek supabase-js
  `.returns<T>()` imzasıyla tip uyumu için orada duruyor).

## Refactor Aday Kontrolü
Refactor adayı yok (diff zaten minimal/CAVEMAN'a uygun) — tek migration
dosyası + `FakeQuery`'ye iki küçük metod eklemesi, tekrar/sihirli
sayı/derin nesting/uzun parametre listesi yok.

## Sonuç
Tüm uygulanabilir gate'ler PASS (gate 3 dahil, düzeltme sonrası). Kalan
PENDING adımlar: gate 11 (AI code review → `pm`) ve gate 14 (insan onayı).
Bu görev artık `pm` incelemesine hazır.
