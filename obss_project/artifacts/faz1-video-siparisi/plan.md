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
