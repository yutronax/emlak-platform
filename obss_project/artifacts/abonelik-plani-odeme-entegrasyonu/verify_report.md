# Verify Report — abonelik-plani-odeme-entegrasyonu
_Reference: atdd.md, code_diff.md, test_diff.md_

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | Tüm dosyalar `code_diff.md`'nin belirttiği yerde (`git status --short` ile doğrulandı) |
| 2 | Build/derleme | PASS | `npm run build` (web/) — ilk denemede `/account/subscription` prerender hatası (Next.js 16 Cache Components), `export const instant = false;` (projenin kendi `admin/layout.tsx` konvansiyonu) eklenerek düzeltildi, sonra başarılı |
| 3 | Supabase şema/canlı doğrulama | PASS (2026-10-20'de re-verify edildi) | Migration kullanıcı tarafından Supabase Dashboard'dan uygulandı. Canlı REST doğrulaması: `plans` (200), `payment_events` (200), `subscriptions.plan_id` (200) — üçü de artık gerçek projede mevcut. `plans` tablosu şu an BOŞ (0 satır) — bu bir şema sorunu değil, plan fiyatlandırma verisinin (business kararı) henüz Dashboard'dan girilmemiş olması; aşağıya insani-görev olarak not edildi. |
| 4 | Lint | PASS | `npm run lint` (eslint src) — hatasız |
| 5 | Type check | PASS | `npx tsc --noEmit` — hatasız |
| 6 | Unit testler | PASS | `npx vitest run` — 6 dosya, 32/32 test yeşil |
| 7 | E2E testler | N/A | Projede Playwright/Cypress e2e suite'i kurulu değil; gerçek tarayıcı akışı migration uygulanmadan (gate 3 FAIL) anlamlı test edilemez — migration uygulandıktan sonra ayrıca yapılmalı |
| 8 | Lighthouse | N/A | Dev sunucusu bu doğrulama turunda ayağa kaldırılmadı (gate 3 bloke ederken anlamsız) |
| 9 | Erişilebilirlik | N/A | Gate 8 ile aynı sebep |
| 10 | Güvenlik taraması | PENDING | Bu doğrulama turunda çalıştırılmadı — `security-scan` skill'i ayrıca çağrılmalı |
| 11 | AI code review | PENDING (red-team/pm) | Ayrı pipeline adımı |
| 12 | Görsel regresyon | N/A | Gate 3 bloke ederken sayfalar gerçek veriyle render edilemiyor; migration uygulandıktan sonra yapılmalı |
| 13 | DAST (ZAP) | N/A | Gate 3/12 ile aynı sebep — canlı sistem henüz tam çalışır durumda değil |
| 14 | İnsan onayı | PENDING | Her zaman son adım |

## Supabase'e uygulanması gereken SQL
Dashboard > SQL Editor'de çalıştırın (dosya: `supabase/migrations/0003_subscriptions_payment.sql`):
```sql
alter type subscription_status add value if not exists 'pending';
alter type subscription_status add value if not exists 'failed';
alter type subscription_status add value if not exists 'needs_review';

create table plans (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    price_minor_unit integer not null,
    currency text not null default 'TRY',
    max_listings integer,
    created_at timestamptz not null default now()
);
alter table plans enable row level security;
create policy plans_authenticated_select on plans
    for select to authenticated using (true);

alter table subscriptions
    add column plan_id uuid references plans(id),
    add column provider_subscription_id text,
    add column provider_customer_id text,
    alter column plan drop not null,
    alter column current_period_end drop not null;
comment on column subscriptions.plan is 'Deprecated: plan_id kullanılmalı. Kaldırma ayrı bir migration ile yapılacak.';

create unique index subscriptions_one_open_per_agent_idx
    on subscriptions (agent_id)
    where status::text in ('pending', 'active');

create table payment_events (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid references subscriptions(id) on delete cascade,
    provider_event_id text not null unique,
    event_type text not null,
    raw_payload jsonb not null,
    created_at timestamptz not null default now()
);
alter table payment_events enable row level security;
```
**Not:** `ALTER TYPE ... ADD VALUE` ile `CREATE TABLE`/`ALTER TABLE` komutları aynı anda (tek "Run" tıklamasıyla) çalıştırılabilir — enum genişletmenin aynı transaction'da kullanılamaması kısıtı burada sorun değil, çünkü aşağıdaki hiçbir ifade yeni enum değerlerini (`'pending'` vb.) literal olarak KULLANMIYOR (unique index `status::text` metin karşılaştırması yapıyor).

Ayrıca `.env.local` (web/) veya runtime ortamına `SUPABASE_SERVICE_ROLE_KEY` eklenmesi gerekiyor — `createServiceRoleClient()` bunu okuyor, şu an web/ projesinde bu değişken yok (sadece `scraper/.env`'de var).

## AC -> Test Mapping
| AC | Test | Sonuç |
|---|---|---|
| AC-1 happy path | checkout/webhook happy path testleri | PASS (mock) |
| AC-2 kart reddi | webhook `PAYMENT_FAILED` testi | PASS (mock) |
| AC-3 idempotency | webhook duplicate event testi | PASS (mock) |
| AC-4 zaten aktif | checkout 409 testi | PASS (mock) |
| AC-5 kısmi başarı | webhook update-hatası testi | PASS (mock) |
| AC-S1 fiyat manipülasyonu | checkout price-ignore testi | PASS (mock) |
| AC-S2 IDOR | `[id]/route.test.ts` | PASS (mock) |
| AC-S3 sahte webhook | webhook imza testi | PASS (mock) |
| AC-S4 rate limit | checkout rate-limit testi | PASS (mock) |
| AC-S5 bilgi sızıntısı | webhook/iyzico hata-maskeleme testi | PASS (mock) |

**Önemli uyarı:** Yukarıdaki tüm PASS'ler **mock'lu unit testlerden** geliyor.
Gate 3 FAIL olduğu için hiçbiri gerçek Supabase'e karşı henüz doğrulanmadı
— bu skill'in kendi açılış notu tam bu durumu anlatıyor ("testler yeşil"
≠ "özellik gerçekten çalışıyor"). Migration uygulanmadan bu görev
tamamlanmış sayılamaz.

## Refactor Aday Kontrolü
Aday yok (diff zaten minimal/CAVEMAN'a uygun) — route handler'lar kısa,
tekrar eden mantık (rate limit Map, HMAC doğrulama) tek bir yerde, sihirli
sayı/derin nesting/uzun parametre listesi gözlenmedi.

## 2026-10-20 Güncelleme — PM sonrası düzeltmeler
PM incelemesi (`red_team.json`, verdict: block) iki orta-seviye reliability
bulgusu buldu:
1. Webhook'ta olmayan bir `subscription_id`'ye gelen event sessizce
   `{received:true}` dönüyordu, hiçbir log yoktu.
2. Checkout'ta başarısız ödeme sonrası `status:"failed"` güncellemesinin
   hatası kontrol edilmiyordu.

Her ikisi de `emlak-platform-backend-copilot` session'ı tarafından
düzeltildi (davranış sözleşmesi/response şekli değişmedi, sadece sessizce
yutulan hatalar artık loglanıyor). `npx vitest run` tekrar çalıştırıldı:
**44/44 test PASS** (önceki 32'den fazla — proje genelindeki diğer test
dosyaları da dahil, regresyon yok).

Gate 3 artık PASS (migration kullanıcı tarafından uygulandı, canlı
doğrulandı). İnsani görev (bkz. DECISION.md / sonraki adım): `plans`
tablosuna en az bir gerçek plan satırı (ad, fiyat, max_listings) Supabase
Dashboard'dan girilmeli — bu bir fiyatlandırma/business kararı, teknik
ekip tarafından icat edilmedi.
