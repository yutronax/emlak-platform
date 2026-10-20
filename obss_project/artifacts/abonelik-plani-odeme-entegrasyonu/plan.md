# Plan — abonelik-plani-odeme-entegrasyonu
_Reference: atdd.md_

Frontend-pipeline: tetikleyici var (yeni sayfalar: `/pricing`, `/account/subscription`).
Discover + Audit + Design Direction aşağıda yapıldı (ayrı skill çağrısı yerine
doğrudan kod keşfiyle — proje çok küçük/erken aşamada, gerçek bir tasarım
sistemi yok, mevcut 3 sayfanın (login/admin/dashboard) tutarlı house-style'ı
zaten tasarım yönünü belirliyor).

## Discover + Audit (gerçek kod keşfi)
- Next.js 16 + React 19, Tailwind v4 (config dosyası yok, `@theme inline` ile
  `globals.css` içinde token tanımı). Component kütüphanesi YOK (shadcn/MUI
  vb. yok) — tüm sayfalar ham Tailwind utility class'larıyla yazılmış.
- Mevcut desen (login, admin/listings, agent/dashboard sayfalarından):
  - Server Component + doğrudan Supabase sorgusu (`createClient()` from
    `lib/supabase/server.ts`), mutasyonlar `actions.ts` + Server Actions
    (`useActionState`) ile.
  - Container: `mx-auto max-w-{sm|2xl|3xl} p-8`.
  - Input: `rounded border px-3 py-2`. Primary buton: `rounded bg-foreground
    px-4 py-2 text-background disabled:opacity-50`. Durum rengi butonlar:
    `bg-green-600`/`bg-red-600 ... text-white hover:bg-{color}-700`.
  - İkincil metin: `text-zinc-600 dark:text-zinc-400` (veya `zinc-500`).
  - Hata metni: `text-red-600` / `text-sm`.
  - Tüm UI metni Türkçe, kısa ve doğrudan.
- **`agent/dashboard/page.tsx` ZATEN bu özelliğe referans veriyor:**
  "Supabase Auth girişi ve abonelik durumuna göre onaylı ilan akışı Faz 4'te
  buraya eklenecek." — bu sayfa subscription durumu entegrasyonu için
  doğal bir ekleme noktası.
- Audit bulgusu: mevcut sayfalarda erişilebilirlik/klavye/hover-focus sorunu
  yok (çok basit, native form elemanları kullanılıyor) — bu görev kapsamında
  ek bir "polish" ihtiyacı yok, sadece aynı deseni takip etmek yeterli.

## Design Direction
Yeni bir görsel dil GEREKMİYOR — mevcut 3 sayfa zaten tutarlı bir minimal
house-style kurmuş (nötr renkler, `foreground`/`background` semantic token,
renk-kodlu durum butonları, Türkçe kısa metin). `/pricing` ve
`/account/subscription` bu deseni birebir takip edecek: plan kartları
`rounded border p-4` ile (admin/listings'teki `article` kartına benzer),
aktif/seçili plan `bg-foreground text-background`, durum rozetleri
(`active`→yeşil, `past_due`→sarı/amber, `failed`/`canceled`→kırmızı) zaten
projede kullanılan `green-600`/`red-600` tonlarıyla tutarlı genişletilir.

## ⚠️ Kritik keşif — atdd.md'nin şema varsayımını güncelliyor
`supabase/migrations/0001_init.sql` içinde **`subscriptions` tablosu ZATEN
VAR**:
```sql
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    plan text not null,              -- plan adı düz metin, katalog tablosu yok
    status subscription_status not null default 'trialing',
    current_period_end timestamptz not null,
    created_at timestamptz not null default now()
);
```
RLS zaten var: `subscriptions_self_select` (agent kendi aboneliğini görür,
yazma policy'si yok — şu an hiç kimse INSERT/UPDATE yapamıyor, service-role
hariç). Kullanıcı tablosu adı **`agents`** (`profiles` değil — atdd.md'deki
"kullanıcı/profil tablosu" referansı düzeltildi).

Bunun anlamı: atdd.md'nin önerdiği "yeni `plans` + `subscriptions` +
`payment_events` tabloları" planı **kısmen geçersiz** — `subscriptions`
tablosu var ama (a) plan fiyatını tutan bir katalog yok (AC-S1 "fiyat
sunucuda DB'den okunur" bunu gerektiriyor), (b) `status` enum'ında
`failed`/`needs_review` değerleri yok, (c) sağlayıcı/webhook izleme için
hiçbir sütun (provider_subscription_id, payment_event log) yok.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| `supabase/migrations/0003_subscriptions_payment.sql` (yeni) | `subscriptions`'a sağlayıcı/ödeme sütunları eklemek, `subscription_status` enum'ını genişletmek, yeni `plans`+`payment_events` tabloları, yeni RLS/insert policy'leri | high (şema değişikliği + enum ALTER TYPE kilit riski) | backend |
| `web/src/app/agent/dashboard/page.tsx` | Zaten bu özelliğe referans veriyor — abonelik durumu rozetini buraya eklemek | low | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `web/src/app/pricing/page.tsx` | Plan seçim sayfası (Server Component, planları DB'den okur) | frontend |
| `web/src/app/pricing/actions.ts` | `POST /checkout` server action — iyzico checkout session açar | backend |
| `web/src/app/account/subscription/page.tsx` | Kullanıcının kendi abonelik durumunu gösterir | frontend |
| `web/src/app/api/webhooks/payment/route.ts` | iyzico webhook alıcı ucu — HMAC doğrulama, idempotent state update | backend |
| `web/src/lib/payments/iyzico.ts` | Sağlayıcı istemcisi (checkout oluşturma, imza doğrulama) — **sağlayıcı onaylanmadan yazılmamalı** | backend |
| `supabase/migrations/0003_subscriptions_payment.sql` | (yukarıda) | backend |

## Dependencies
- `web/src/lib/supabase/server.ts` / `client.ts` — mevcut Supabase client factory, aynen kullanılacak.
- `agents` tablosu (`id = auth.uid()`) — `subscriptions.agent_id` zaten buna FK.
- Mevcut RLS deseni (`agents_self_select` gibi `id = auth.uid()` kontrolleri) — yeni policy'ler bu desenle tutarlı yazılmalı.
- `listings_subscriber_select` policy'si zaten `subscriptions.status in ('active','trialing') and current_period_end > now()` kontrolüyle ilan görünürlüğünü belirliyor — yeni migration bu policy'yi KIRMAMALI (enum'a yeni değer eklemek bu policy'yi bozmaz, ama `status` semantiğini değiştirmek bozar).

## Migration Required?
**Evet.** `supabase/migrations/0003_subscriptions_payment.sql`:
- `alter type subscription_status add value 'failed'` (ve gerekirse `'needs_review'`) — Postgres'te enum'a değer eklemek transaction içinde bazı sürümlerde sorunlu olabilir, migration dosyasında ayrı adım olarak yazılmalı.
- Yeni `plans` tablosu: `id, name, price_minor_unit, currency, max_listings, created_at` — AC-S1'in "fiyat sunucuda DB'den okunur" kriterini karşılamak için ZORUNLU (yoksa fiyat manipülasyonu testi anlamsız kalır).
- `subscriptions` tablosuna eklenecek sütunlar: `plan_id` (FK → plans, mevcut `plan text` sütununun yerini alır veya yanında durur — **açık soru, bkz. altta**), `provider_subscription_id text`, `provider_customer_id text`.
- Yeni `payment_events` tablosu: `id, subscription_id, provider_event_id (unique — idempotency), event_type, raw_payload jsonb, created_at`.
- Yeni RLS policy: `subscriptions_self_insert`/`update` YOK — yazma yalnızca service-role (webhook handler) üzerinden yapılmalı, bu yüzden kullanıcıya açık bir insert/update policy EKLENMEMELİ (mevcut "policy yok = normal kullanıcı için reddedilir" deseni `raw_listings` için zaten kullanılıyor, aynı desen burada da doğru).

Bu proje önceki görevde (`supabase-proje-kurulumu`) migration'ların gerçek
Supabase projesine uygulanmasının ayrı bir doğrulama script'i
(`verify_supabase.py`) gerektirdiğini kaydetmiş — bu migration da aynı
şekilde gerçek projede uygulanıp doğrulanmalı (`verify` adımında).

## Risks
(atdd.md'den taşındı + yeni bulgular)
- Ödeme sağlayıcısı kararı (iyzico önerisi) hâlâ nihai değil.
- **YENİ:** `status` enum'ına `ALTER TYPE ... ADD VALUE` eklemek PostgreSQL'de
  aynı transaction içinde o değerin hemen kullanılmasını engeller (sürüme
  göre) — migration'ın iki ayrı adımda (önce enum genişletme commit edilir,
  sonra kullanılır) yazılması gerekebilir. `code-copilot`'a bu kısıt
  açıkça iletilmeli.
- **YENİ:** Mevcut `plan text` sütunu ile yeni `plan_id` FK'si aynı anda
  var olursa veri tutarsızlığı riski var (bkz. Open Questions).

## Open Questions
(atdd.md'nin Unknowns'ından taşınan + bu adımda keşfedilen yeni sorular —
gerçek belirsizlik, otomatik karar verilmedi)

1. **(atdd.md Unknowns'tan taşındı)** Ödeme sağlayıcısı: iyzico mi, PayTR mi,
   başka mı? Issue açıkça ekip kararı istiyor.
2. **(yeni — şema)** Mevcut `subscriptions.plan` (düz metin) sütunu ne
   olacak: yeni `plan_id` FK ile birlikte mi tutulacak (geçiş dönemi), yoksa
   `plan_id`'ye tam taşınıp `plan` sütunu migration'da mı kaldırılacak?
   Mevcut sütunu kaldırmak bir "breaking schema change" — bu projenin
   kuralı (bkz. önceki görevlerin ADR'leri) sessiz şema değişikliğine karşı
   olabilir, kullanıcı onayı gerekiyor.
3. **(yeni — şema)** `status` enum'ına `failed` (ve `needs_review`) değeri
   eklemek mi, yoksa ayrı bir `payment_status` sütunu mu açmak daha doğru?
   (`subscription_status` enum'ı şu an `listings_subscriber_select` RLS
   policy'sinde kullanılıyor — enum semantiğini bozmadan genişletmek önemli.)
4. **(yeni)** `plans` tablosundaki fiyatlar TL mi, kuruş (minor unit) mi
   tutulacak? (Ödeme sağlayıcılarıyla entegrasyonda genelde minor unit
   önerilir ama proje genelinde `listings.price numeric` kullanılıyor —
   tutarlılık kararı gerekiyor.)

Bu sorular gerçek mimari/şema kararları içerdiği ve atdd.md'nin kendi
Risks/Assumptions bölümü de "ödeme sağlayıcısı kararı nihai değil" diyerek
bunu zaten kullanıcı onayına bırakmıştı — bu yüzden otomatik alt-ajana
dispatch edilmeden kullanıcıya soruldu.

## Kararlar
Kullanıcı yetkisiyle Opus low alt-ajanı tarafından yanıtlandı:

1. **Ödeme sağlayıcısı: iyzico** — TL/yerli kart/3DS/yinelenen ödeme hazır
   destekliyor, atdd.md/plan.md zaten buna göre kurulmuş. **Not: issue #5
   açıkça ekip kararı istiyor — bu seçim bir ADR olarak kayda geçmeli ve
   ekip onayına sunulmalı, nihai sayılmamalı.**
2. **`subscriptions.plan` (düz metin) → geçiş dönemi.** Yeni `plan_id` FK
   eklenir, mevcut satırlar `plan` metnine göre `plans` tablosuyla
   eşleştirilerek doldurulur (backfill), `plan` sütunu bu migration'da
   KALDIRILMAZ (deprecated işaretlenir, kaldırma ayrı bir sonraki
   migration'a bırakılır) — onaysız breaking schema change yapılmaz.
3. **`subscription_status` enum'ına `pending`, `failed`, `needs_review`
   eklenir** — ayrı bir `payment_status` sütunu AÇILMAZ. Davranış
   sözleşmesi bu durumları doğrudan abonelik durumu olarak tanımlıyor,
   `listings_subscriber_select` sadece `active`/`trialing`'e baktığı için
   policy bozulmaz. `ALTER TYPE ... ADD VALUE` ayrı bir migration adımında
   çalıştırılır (plan.md'nin enum-kilit uyarısına göre).
4. **Plan fiyatları kuruş (minor unit) olarak tutulur** — `plans.price_minor_unit
   integer` + `currency`. Kayan nokta yuvarlama hatasını önler, sağlayıcı
   entegrasyonlarında standart. `listings.price numeric` (ilan fiyatı) ile
   aynı birim olmak zorunda değil, farklı alanlar.
