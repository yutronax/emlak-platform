# Plan — plans-rls-anon-select-izni
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — sadece SQL migration, `/pricing` koduna dokunulmuyor, Görsel/UI kriteri notu zaten "UI kodu değişmiyor" diyor).

## Keşif Sonucu (gerçek koddan)
- Mevcut policy: `supabase/migrations/0003_subscriptions_payment.sql:24-25`:
  ```sql
  create policy plans_authenticated_select on plans
      for select to authenticated using (true);
  ```
- `plans` tablosunun tam sütun listesi (0003 + 0006 migration'larının toplamı):
  `id, name, price_minor_unit, currency, max_listings, created_at, sort_order`.
  **AC-S3 sonucu: hassas sütun YOK** (cost_basis/internal_notes/margin benzeri hiçbir alan yok) — bu kontrol geçti, kullanıcıya sorulmasına gerek kalmadı.
- Son migration numarası: `0009_agents_self_insert.sql`. Yeni dosya: `0010_plans_anon_select.sql`.
- Mevcut policy adlandırma deseni: `<tablo>_<rol>_<işlem>` (örn. `plans_authenticated_select`, `agents_self_insert`). Yeni policy bu desene uyacak: `plans_public_select`.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| — | (mevcut hiçbir dosya değişmiyor — eski policy migration dosyasının içeriği DEĞİŞTİRİLMEZ, migration'lar geçmişe dönük düzenlenmez) | — | — |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `supabase/migrations/0010_plans_anon_select.sql` | `plans_authenticated_select` policy'sini DROP edip `anon, authenticated` için SELECT izni veren `plans_public_select` policy'sini CREATE eder | backend |
| `scraper/tests/test_plans_rls_anon_select.py` (veya projenin RLS testlerini tuttuğu eşdeğer konum — `test-copilot` gerçek test dizinini teyit edecek) | AC-1/AC-2/AC-S1/AC-S2'yi gerçek Supabase'e karşı integration testiyle doğrular | backend |

## Migration İçeriği (code-copilot'un birebir uygulayacağı)
```sql
-- 0010_plans_anon_select.sql
-- plans fiyat kataloğu herkese açık bilgi; anonim ziyaretçi de görebilmeli.
drop policy if exists plans_authenticated_select on plans;

create policy plans_public_select on plans
    for select to anon, authenticated using (true);
```
Not: `drop + create`, `alter policy`'ye tercih edilir — idempotent ve rollback'i (ters migration'da aynı iki satırı tersine çevirmek) daha okunur kılar (bkz. atdd.md Rollback Beklentisi).

## Dependencies
- `payment_events` ve `subscriptions` tabloları bu migration'dan etkilenmiyor — sadece `plans` SELECT policy'si değişiyor.
- `/pricing` sayfasının hangi key'i (anon/service_role) kullandığı (atdd.md Assumptions) — kod okunarak teyit edildi: proje genel olarak client-side Supabase client'ı `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile kuruyor (standart Next.js+Supabase deseni), ayrıca doğrulanacak bir backend route yok, bu assumption DOĞRULANDI sayılabilir — ek inceleme gerekmiyor çünkü migration'ın kendisi hangi key kullanıldığından bağımsız çalışır (anon key zaten yoksa bu değişiklik etkisiz olur, zarar vermez).

## Migration Required?
Evet — `supabase/migrations/0010_plans_anon_select.sql` (yukarıda). Ek veri taşıma/backfill yok, salt bir RLS policy değişikliği.

## Risks
atdd.md'den taşınan: Info disclosure (ileride hassas sütun eklenirse ifşa riski — kabul edilmiş risk, bu migration'ın kapsamında değil). Elevation of privilege (yanlışlıkla `FOR ALL` yazma riski — yukarıdaki migration içeriği açıkça `FOR SELECT` yazıyor, bu riski kod seviyesinde ortadan kaldırıyor).
Keşifte yeni bir risk çıkmadı.

## Open Questions
Yok — atdd.md'nin Unknowns bölümündeki tek madde ("plans tablosunun tam sütun listesi") bu adımda çözüldü (yukarıdaki Keşif Sonucu). "Assumption: /pricing anon key kullanıyor" maddesi de yukarıda ele alındı, migration'ın doğruluğunu etkilemiyor.

## test-copilot / code-copilot Dispatch Talimatı (somut, yorum gerektirmeyecek kadar)
**Dosya:** `supabase/migrations/0010_plans_anon_select.sql`
**Tam içerik:** yukarıdaki "Migration İçeriği" bloğu, birebir.
**Test dosyası:** gerçek Supabase'e karşı (mock YASAK — authz-test kuralı) şu senaryoları integration testi olarak yaz:
- anon key ile `plans` SELECT → satır sayısı service_role ile önceden sayılan sayıya eşit (AC-1)
- authenticated key ile `plans` SELECT → aynı satır sayısı (AC-2)
- anon key ile `plans` INSERT → 401/403/42501, veri değişmez (AC-S1)
- anon key ile `plans` UPDATE/DELETE → 0 satır etkiler, service_role ile tekrar okunup doğrulanır (AC-S1)
- `pg_policies` sorgusu: `plans` için SELECT policy rolleri `{anon, authenticated}` içerir, `anon` için başka cmd'li policy yok (AC-S2)
**Dokunulmayacak dosyalar:** `/pricing` sayfa kodu, diğer tüm migration dosyaları (geçmişe dönük düzenleme yok), `subscriptions`/`payment_events` tabloları.
