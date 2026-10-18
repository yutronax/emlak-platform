# Plan — pricing-plans-sort-order-fix
_Reference: atdd.md_

Frontend-pipeline: tetikleyici değerlendirildi (`frontend-pipeline` skill'i
çağrıldı) — hiçbir `.tsx`/`.jsx`/`.css` dosyası değişmiyor (sadece bir
Supabase migration), bu bir UI reshape/yeni UI görevi değil, küçük bir
backend bug fix. Skill'in kendi kuralı ("Design Direction yalnızca yeni
UI/kapsamlı reshape'te zorunlu, küçük bug fix'lerde atlanır") gereği
Discover→Audit→Design Direction adımları atlandı.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/test/fake-supabase.ts | `FakeQuery` sınıfında `.order()` ve `.returns()` metodları YOK. page.tsx şu zinciri çağırıyor: `.select(...).order("sort_order", {ascending:true}).returns<PlanRow[]>()`. Bu metodlar eklenmeden pricing sayfasını fake-supabase ile test eden HİÇBİR unit test çalışamaz (`order is not a function` hatası alınır). `.order()` gerçek satır sıralamasını (asc/desc) uygulamalı, `.returns()` runtime'da no-op (tip-only) olmalı. | medium (mevcut tüm fake-supabase kullanıcı testlerini bozmamalı — ekleme, davranış değişikliği yok) | backend (test altyapısı, Supabase istemci sahtesi) |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| supabase/migrations/0006_plans_sort_order.sql | `plans` tablosuna `sort_order integer not null default 0` kolonu ekler + mevcut satırları `price_minor_unit` artan (eşitlikte `created_at`) sırasına göre backfill eder. | backend |

Not: Migration dosya numarası `0006` — mevcut en yüksek migration `0005_agents_immutable_columns.sql` (bkz. aşağıdaki Dependencies). `0004_plans_sort_order.sql` adı atdd.md'de bir yer tutucuydu, gerçek numara repodaki mevcut dosyalara göre `0006` olmalı.

## Dependencies
- Gerçek migration geçmişi: `0001_init.sql`, `0002_admin_review.sql`,
  `0003_subscriptions_payment.sql` (plans tablosunu burada oluşturdu, kolon:
  id, name, price_minor_unit, currency, max_listings, created_at —
  `sort_order` yok), `0004_fix_agents_self_update_rls.sql`,
  `0005_agents_immutable_columns.sql`. Yeni migration bunların SONRASINA
  (`0006_`) eklenecek.
- `web/src/app/pricing/page.tsx` — DEĞİŞMEYECEK. Zaten
  `.from("plans").select("id, name, price_minor_unit, sort_order").order("sort_order", {ascending:true}).returns<PlanRow[]>()`
  çağırıyor ve `PlanRow` tipinde `sort_order: number` zaten tanımlı
  (page.tsx:14). Kod migration'ı bekliyor, kodda değişiklik gerekmiyor.
- `plans` tablosunda üretilmiş bir TS tip dosyası (`database.types.ts` vb.)
  bu repoda BULUNAMADI — grep ile arandı, yok. atdd.md'nin "Etkilenen
  Dosyalar" bölümündeki bu madde bir varsayımdı, gerçekte uygulanmıyor
  (eklenmeyecek bir dosya için not düşülmesine gerek yok).
- `plans_authenticated_select` RLS policy'si (0003'te tanımlı) yeni kolonu
  da otomatik kapsar — RLS tarafında ek değişiklik gerekmiyor.

## Migration Required?
Evet — `plans` tablosuna `sort_order integer not null default 0` kolonu
eklenecek ve mevcut satırlar backfill edilecek. Repoda ad-hoc migration'ı
yasaklayan bir ADR/CLAUDE.md kuralı bulunamadı (proje kökünde CLAUDE.md
yok); `supabase/migrations/` altında numaralı, sıralı migration dosyaları
zaten standart pratik (0001-0005), bu da aynı desenle `0006` olarak eklenir.

## Risks
- atdd.md'den taşınan risk: backfill'in fiyat sırasına göre yapılması bir
  varsayım — gerçek iş sıralaması (pazarlama tercihi) farklıysa elle
  düzeltme gerekebilir. (atdd.md'nin Hard Stop onayı pipeline'ın devamına
  izin verdi, ama bu SPESİFİK backfill-sıralaması varsayımı ayrıca
  kullanıcıya tek tek sorulmadı — atdd.md'nin Assumptions bölümündeki
  "kullanıcı onayı alınmadı" notu hâlâ geçerli, PM incelemesinin
  derlediği `red_team.json` buna dikkat çekti.)
  — Yeni: `fake-supabase.ts`'e eklenecek `.order()` implementasyonu basit
  bir `Array.sort()` olacak; mevcut tabloda `tables[table]` referansı
  korunduğu için sıralama sonrası diğer testlerin sıra bağımlılığı
  olmadığından etkilenmemesi gerekir — code-copilot bunu eklerken mevcut
  testlerin hepsinin geçtiğini doğrulamalı.

## Open Questions
Yok. atdd.md'nin Unknowns bölümündeki madde ("plans tablosunda şu anda
gerçekten satır olup olmadığı") bu plan aşamasında çözülmedi — ama bu bir
"açık soru" değil, `supabase-check`/`verify` adımında gerçek projeye
bakılarak doğrulanacak bir gerçek-sistem kontrolü (atdd.md'de de böyle
işaretlenmişti). Koda/teste karar vermeyi engellemiyor: migration hem dolu
hem boş tablo için güvenli (backfill boş tabloda no-op).
