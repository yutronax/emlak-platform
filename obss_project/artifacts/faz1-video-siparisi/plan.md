# Plan — faz1-video-siparisi (bu tur: **1a**)
_Reference: atdd.md_

Frontend-pipeline: tetikleyici var (yeni sayfalar). Discover/Design Direction yeniden yapılmadı — mevcut token sistemi (`musteri-sayfalari-tasarim-yenileme/design-direction.md`) ve `(marketing)` bileşenleri (`components/ui/button`, `alert`) kullanılır.

## Kararlar
- Dosya sınırı şimdilik **50 MB** (kullanıcı kararı 2026-10-28). Tek kaynak: `web/src/lib/video-orders/limits.ts`. Bucket `file_size_limit` = 52428800.
- 50 MB'a kadar TUS gerekmez: imzalı yükleme URL'si (`storage.createSignedUploadUrl`) + tarayıcıdan **XMLHttpRequest PUT** (ilerleme olayı için; `uploadToSignedUrl` ilerleme vermiyor).
- Migration'lar bu projede elle SQL Editor'den uygulanıyor (uzak migration geçmişi sadece 0001-0002'yi biliyor) → `supabase db push` KULLANILMAZ. Migration + rollback yazılır, uygulama kullanıcı onayıyla.
- Tüm durum değişiklikleri **sunucu tarafında** (Server Action / route). Emlakçının tablolara doğrudan yazma yetkisi yok: RLS'te agent için sadece SELECT; insert/update service-role ile, sahiplik kontrolü kodda yapılır. (AC-S4'ü RLS yerine tek bir sunucu katmanında zorlamak daha az hata yüzeyi.)
- Video siparişi abonelik gerektirmez, giriş yeterli.

## Files — 1a

### backend
| File | Why |
|---|---|
| `supabase/migrations/0013_video_orders.sql` (yeni) | AC-1: tablolar, seed, bucket, RLS, storage policy |
| `supabase/rollback/0013_video_orders_rollback.sql` (yeni) | Rollback |
| `web/src/lib/video-orders/limits.ts` (yeni) | Sınırlar, izinli MIME/uzantı, `DELIVERY_BUSINESS_DAYS = 2`, `addBusinessDays()` |
| `web/src/lib/video-orders/status.ts` (yeni) | Durum tipi, Türkçe etiketler, `canTransition(from, to, actor)` |
| `web/src/app/agent/videos/actions.ts` (yeni) | Server Actions (sözleşme aşağıda) |
| testler: `limits.test.ts`, `status.test.ts`, `actions.test.ts` | |

### frontend
| File | Why |
|---|---|
| `web/src/app/agent/videos/page.tsx` | AC-2 liste |
| `web/src/app/agent/videos/new/page.tsx` + `new/order-wizard.tsx` (client) | AC-3/AC-4 |
| `web/src/app/agent/videos/new/upload-field.tsx` (client) | XHR PUT + ilerleme + tekrar dene |
| `web/src/app/agent/videos/[id]/page.tsx` | AC-5 |
| `web/src/app/agent/dashboard/page.tsx` | AC-6 link (tek satır) |
| testler | |

## Şema (0013)
```
video_services(code text pk check in ('photos','raw_video','onsite'), name text, price_minor_unit int null, currency text default 'TRY', sort_order int)
  seed: photos 'Fotoğraflardan video' 75000; raw_video 'Kendi videonuzdan' 75000; onsite 'Yerinde çekim' null
video_orders(id uuid pk, agent_id uuid fk agents on delete cascade, property_id uuid fk properties on delete restrict,
  service_code text fk video_services, status text check in ('draft','quote_pending','awaiting_payment','payment_failed','in_progress','delivered','canceled'),
  price_minor_unit int null, currency text default 'TRY', onsite_preferred_time text null, rejection_reason text null,
  paid_at, due_at, delivered_at timestamptz null, created_at, updated_at default now())
  index (agent_id, created_at desc), index (status, due_at)
video_order_assets(id uuid pk, order_id fk video_orders on delete cascade, kind text check in ('photo','raw_video'),
  storage_path text unique, size_bytes bigint, created_at)
alter property_videos add order_id uuid null references video_orders(id)
alter payment_events add video_order_id uuid null references video_orders(id);
  check (num_nonnulls(subscription_id, video_order_id) = 1) — NOT VALID + ayrı validate (mevcut satırlar subscription_id dolu, geçer)
bucket video-order-assets: private, 52428800, mime: image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm
RLS: video_services: authenticated select. video_orders / assets: owner select (agent_id = auth.uid()), admin select+update. Yazma policy'si agent için YOK.
storage.objects: video-order-assets — owner insert/select where (storage.foldername(name))[1] = auth.uid()::text; admin select.
```
(`properties` mülk kaydı sipariş oluştururken service-role ile `agent_id` = kullanıcı olarak yaratılır.)

## Server Action sözleşmesi (`web/src/app/agent/videos/actions.ts`)
Hepsi: oturum yoksa `redirect('/login')`; sahiplik yoksa `{ ok:false, error:'NOT_FOUND' }`.
| Action | Girdi | Çıktı | Kural |
|---|---|---|---|
| `createVideoOrder(input)` | `{ serviceCode, title, address, onsitePreferredTime? }` | `{ ok:true, orderId, status }` | property + order yaratır. photos/raw_video → `draft`, `price_minor_unit` = video_services'tan. onsite → `quote_pending`, price null. title 3-120, address 5-300 karakter. |
| `requestUploadUrl(orderId, file)` | `{ name, type, size }` | `{ ok:true, assetId, path, signedUrl, token }` | sadece `draft`; kind servisten türetilir (photos→photo, raw_video→raw_video); MIME+uzantı izinli; size ≤ limit; mevcut asset sayısı < limit (photo 30, raw_video 5). Yol `${agentId}/${orderId}/${uuid}.${ext}` sunucuda. asset satırı **upload başarılı olunca değil**, burada `pending` olmadan yazılır mı? → HAYIR: asset satırı `confirmUpload`'da yazılır. |
| `confirmUpload(orderId, path, size)` | | `{ ok:true, assetId }` | path bu siparişin prefix'iyle başlamalı ve Storage'da var olmalı (`list` ile kontrol); asset satırı yazar; sayı sınırı tekrar kontrol. |
| `removeAsset(orderId, assetId)` | | `{ ok:true }` | sadece `draft`; Storage + satır silinir. |
| `submitVideoOrder(orderId)` | | `{ ok:true, status:'awaiting_payment' }` | sadece `draft`, en az 1 asset (photos için en az 3 fotoğraf). |
| `getDeliveredVideoUrl(orderId)` | | `{ ok:true, url }` | sadece `delivered` + sahip; property_videos(order_id) storage_path → `property-videos` bucket'tan 600 sn imzalı URL (service-role). |
Hata kodları: `INVALID_INPUT`, `NOT_FOUND`, `INVALID_STATE`, `LIMIT_REACHED`, `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`, `INTERNAL_ERROR` + Türkçe `message`.

## Migration Required?
Evet — 0013. Kullanıcı onayıyla SQL Editor'den (veya `supabase db query`) uygulanır; supabase-check ile doğrulanır.

## Risks
- Uzak migration geçmişi tutarsız (0003-0012 elle uygulanmış, kayıt yok) — `db push` felaket olur.
- `confirmUpload`'ı atlayan istemci → Storage'da yetim dosya; zararsız (sadece kendi klasörü), ileride temizlik cron'u.
- payment_events check constraint: canlıda `subscription_id` null satır varsa validate başarısız → NOT VALID ile ekle, ayrıca validate.

## Open Questions
Yok (atdd Unknowns: 50 MB kararıyla kapandı).

---

# Plan — 1b (admin kuyruğu + teslim)

## Kararlar
- Admin = editör (ayrı rol yok). Tüm admin aksiyonları `requireAdmin()` ile başlar; yazmalar service-role ile, durum geçişleri **koşullu UPDATE** (`.eq('status', <beklenen>)`) ile atomik — 0 satır etkilenirse `INVALID_STATE`.
- Teslim videosu mevcut `property-videos` bucket'ına (private, 50 MB) gider; yol `${property_id}/${order_id}/${uuid}.${ext}` sunucuda üretilir; tarayıcıdan imzalı URL'ye XHR PUT (1a'daki desen).
- Sipariş başına tek teslim videosu: **0015** `create unique index if not exists property_videos_order_id_unique on property_videos(order_id) where order_id is not null` (+ rollback). Canlıya orkestratör, kullanıcı onayıyla uygular.
- Eski "mülk seç → video yükle → yayınla" ekranı ve `uploadVideo`/`publishVideo`/`buildVideoStoragePath` kaldırılır (sipariş akışı yerini alır; public galeri yok).
- 1c gelene kadar hiçbir sipariş `in_progress`'e ödeme ile geçmez; "Hazırlanacak" sekmesi boş olabilir — bu beklenen.

## Files — 1b
### backend
| File | Why |
|---|---|
| `supabase/migrations/0015_property_videos_order_unique.sql` + rollback | tek teslim videosu |
| `web/src/app/admin/videos/actions.ts` (yeniden yazılır) | aşağıdaki sözleşme |
| `web/src/app/admin/videos/actions.test.ts` (yeniden yazılır) | |
### frontend
| File | Why |
|---|---|
| `web/src/app/admin/videos/page.tsx` (yeniden yazılır) | AC-7 kuyruk |
| `web/src/app/admin/videos/[id]/page.tsx` (yeni) | AC-8 detay |
| `web/src/app/admin/videos/[id]/quote-form.tsx`, `reject-form.tsx`, `delivery-upload.tsx` (yeni, client) | aksiyon formları |
| testler (`page.test.tsx` yeniden yazılır, `[id]/*.test.tsx`) | |

## Admin Server Action sözleşmesi (`web/src/app/admin/videos/actions.ts`)
Ortak: `requireAdmin()`; no-session → `redirect('/login')`, not-admin → `{ok:false,error:'NOT_FOUND'}`. Dönüş tipi 1a ile aynı `ActionResult` deseni (yerelde tanımla, agent/actions'tan import etme).
| Action | Girdi | Çıktı | Kural |
|---|---|---|---|
| `setQuote(orderId, priceTl)` | `priceTl: string` ("1500" / "1.500,50") | `{ok:true}` | sadece onsite + `quote_pending`; 1–100000 TL arası; kuruşa çevrilir; `update price_minor_unit, status='awaiting_payment' where id and status='quote_pending'` |
| `rejectOrder(orderId, reason)` | reason 5–500 karakter | `{ok:true}` | sadece `quote_pending` → `canceled`, `rejection_reason` |
| `getAssetDownloadUrl(orderId, assetId)` | | `{ok:true,url}` | asset o siparişe ait olmalı; `video-order-assets`'tan 600 sn imzalı URL, `download` seçeneğiyle |
| `requestDeliveryUploadUrl(orderId, file:{name,type,size})` | | `{ok:true,path,signedUrl,token}` | sadece `in_progress`; mp4/mov/webm, ≤ MAX_FILE_BYTES; yol sunucuda |
| `confirmDelivery(orderId, path)` | | `{ok:true}` | sadece `in_progress`; path `${property_id}/${order_id}/` prefix'li + Storage'da var; `property_videos` insert (`order_id`, `status='published'`, `published_at=now`); sonra `update status='delivered', delivered_at=now where status='in_progress'` — 0 satırsa eklenen property_videos satırını sil, `INVALID_STATE`; unique ihlali (23505) → `INVALID_STATE` |
Hata kodları: `INVALID_INPUT`, `NOT_FOUND`, `INVALID_STATE`, `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`, `INTERNAL_ERROR` + Türkçe `message`. Her başarılı aksiyondan sonra `revalidatePath('/admin/videos')` ve detay yolu.

## Kuyruk sorgusu (frontend, kullanıcı client'ı — admin RLS select'i var)
`video_orders` select `id, status, service_code, price_minor_unit, onsite_preferred_time, rejection_reason, created_at, paid_at, due_at, delivered_at, agent_id, properties(title, address), agents(company_name, phone)`. Sekme `?tab=quote|todo|done|canceled` (varsayılan `todo`): quote=`quote_pending`; todo=`in_progress` (due_at asc, `due_at < now` → "Gecikti" vurgusu brick-700); done=`delivered` (delivered_at desc); canceled=`canceled`. Her sekmede sayı rozeti. `draft`/`awaiting_payment`/`payment_failed` siparişler "Ödeme bekleyen" bilgi satırında sadece sayı olarak.

---

# Plan — 1c (ödeme)

## Kararlar
- Migration YOK: `payment_events.video_order_id` + tek-sahip kısıtı 0013'te canlıda.
- `createCheckoutSession` plan'a bağımlılıktan çıkarılır: `createCheckoutSession({ amountMinor, currency, basketId, conversationId, paymentGroup })`. Fiyatı ÇAĞIRAN (route) DB'den okur ve geçirir; iyzico.ts artık Supabase okumaz. Abonelik route'u planı zaten okuyor → aynı değerleri geçirir; abonelik davranışı ve HTTP sözleşmesi DEĞİŞMEZ.
- Video siparişi: `basketId = order.id`, `conversationId = agent_id`, `paymentGroup = "PRODUCT"`.
- Webhook gövde sözleşmesi (projeye özel, mevcut): `{ event_id, event_type, subscription_id? , video_order_id? }` — tam olarak biri dolu, yoksa 400 `INVALID_INPUT`. İmza doğrulama ve `payment_events` idempotency aynen; `payment_events` satırına ilgili sütun yazılır.
- Video geçişleri (koşullu UPDATE, `system` aktörü):
  - `PAYMENT_SUCCESS`: `status in (awaiting_payment, payment_failed)` → `in_progress`, `paid_at = now`, `due_at = addBusinessDays(now, DELIVERY_BUSINESS_DAYS)`.
  - `PAYMENT_FAILED`: `awaiting_payment` → `payment_failed`.
  - 0 satır: sipariş yoksa log + 200; zaten hedefteyse no-op 200; başka durumdaysa (ör. delivered/canceled) log + 200, state DEĞİŞMEZ (abonelikteki needs_review karşılığı yok — video siparişinde ikinci başarılı ödeme manuel iade konusu, kapsam dışı; `payment_events` kaydı iz olarak kalır).
- Checkout `payment_failed` durumunda da açılır (tekrar deneme); durum değiştirmez.

## Files — 1c
### backend
| File | Why |
|---|---|
| `web/src/lib/payments/iyzico.ts` (+test) | generic checkout |
| `web/src/app/api/subscriptions/checkout/route.ts` (+test) | yeni imzaya çağrı; davranış aynı |
| `web/src/app/api/video-orders/[id]/checkout/route.ts` (yeni, +test) | AC-10 |
| `web/src/app/api/webhooks/payment/route.ts` (+test) | AC-11 |
### frontend
| File | Why |
|---|---|
| `web/src/app/agent/videos/[id]/pay-button.tsx` (yeni, client, +test) | AC-12 |
| `web/src/app/agent/videos/[id]/page.tsx` (+test) | "Ödeme adımı yakında" yerine PayButton |

## Video checkout route sözleşmesi — `POST /api/video-orders/[id]/checkout`
Gövde yok (yok sayılır). Sıra: auth (401 `UNAUTHORIZED`) → rate limit (429, abonelikle aynı pencere) → id UUID değilse 404 → sipariş kullanıcı client'ı ile `agent_id = user` (yoksa 404 `NOT_FOUND`) → `quote_pending` ise 409 `QUOTE_PENDING` → `awaiting_payment|payment_failed` değilse 409 `INVALID_STATE` → `price_minor_unit` null/≤0 ise 409 `INVALID_STATE` → `createCheckoutSession` → 201 `{ order_id, checkout_url, expires_at }`. Sağlayıcı zaman aşımı → 504 `PAYMENT_TIMEOUT` (durum değişmez); diğer sağlayıcı hatası → 502 `PAYMENT_PROVIDER_ERROR`, `retryable: true` (durum değişmez — abonelikteki gibi `failed`'a çekilmez, emlakçı tekrar deneyebilsin).
