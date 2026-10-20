# Code Diff — abonelik-plani-odeme-entegrasyonu
_Reference: atdd.md, plan.md, test_diff.md_

## Durum
`npx vitest run` (web/ içinde): **6 dosya, 32/32 test geçti.** (AC-S2 eklendikten sonra güncellendi.)

## Düzeltme turu (önemli — şeffaflık için kayıtlı)
Backend implementasyonunun ilk turu testleri **yanlış sütun adlarıyla**
(`user_id`, `plans.price` TL, `plans.id` text, `payment_events.event_id`)
yazılmış halde yeşile çevirmişti — bu, gerçek DB şemasıyla (plan.md'nin
kararlaştırdığı `agent_id`, `price_minor_unit` kuruş, uuid id, provider_event_id)
çelişiyordu. Kod incelemesinde (bu adımın kendi kuralı: "alt-ajanın raporunu
asla kanıt saymadan Read ile doğrula") yakalandı, "tüm testler PASS" raporu
tek başına kabul edilmedi. Düzeltme sırası:
1. Test dosyaları doğru şemaya göre düzeltildi (3 backend + 1 frontend).
2. Migration (`0003_subscriptions_payment.sql`) doğru sütun adlarına göre düzeltildi.
3. Backend implementasyonu (`iyzico.ts`, `checkout/route.ts`, `webhooks/payment/route.ts`) düzeltildi + yeni `createServiceRoleClient()` eklendi.
4. Frontend implementasyonu (`account/subscription/page.tsx`) `agent_id` kullanacak şekilde düzeltildi.

## Oluşturulan dosyalar
| Dosya | Amaç |
|---|---|
| `supabase/migrations/0003_subscriptions_payment.sql` | `plans`, `payment_events` tabloları; `subscriptions`'a `plan_id`/`provider_subscription_id`/`provider_customer_id`; `subscription_status` enum genişletme (`pending`/`failed`/`needs_review`); `subscriptions_one_open_per_agent_idx` unique index (check-then-act yarışına karşı DB garantisi) |
| `web/src/lib/payments/iyzico.ts` | `verifyWebhookSignature`, `createCheckoutSession` |
| `web/src/app/api/subscriptions/checkout/route.ts` | `POST` — AC-1, AC-S1 (fiyat manipülasyonu reddi), AC-S4 (rate limit), 409 ALREADY_SUBSCRIBED |
| `web/src/app/api/webhooks/payment/route.ts` | `POST` — AC-S3 (imza doğrulama, DB'ye dokunmadan reddet), idempotency, kısmi başarı → `needs_review` |
| `web/src/app/pricing/page.tsx` | Plan listesi, aktif plan işaretleme |
| `web/src/app/pricing/buy-button.tsx` | Client component — checkout'u tetikler, `checkout_url`'e yönlendirir |
| `web/src/app/account/subscription/page.tsx` | Kullanıcının kendi abonelik durumu |

## Değiştirilen dosyalar
| Dosya | Değişiklik |
|---|---|
| `web/src/lib/supabase/server.ts` | `createServiceRoleClient()` eklendi (mevcut `createClient` korunarak) — yazma işlemleri RLS'i bypass eden service-role ile yapılıyor, çünkü `subscriptions`/`payment_events`'e kullanıcı yazma policy'si kasıtlı olarak yok |
| `web/src/app/agent/dashboard/page.tsx` | Mevcut metin korunarak abonelik durumu rozeti eklendi (async yapıldı) |

## Acceptance Criteria karşılığı
- AC-1 (happy path): checkout → `pending` satır, webhook → `active` + `current_period_end`.
- AC-2 (kart reddi): webhook `PAYMENT_FAILED` → `failed`, limit değişmez.
- AC-3 (duplicate webhook): `payment_events.provider_event_id` unique → 23505 yakalanır → `{duplicate:true}`, update çağrılmaz.
- AC-4 (zaten aktif): `subscriptions_one_open_per_agent_idx` ile DB garantisi + önce okuma kontrolü → 409.
- AC-5 (kısmi başarı): update hatası → `needs_review`, ham hata yalnızca sunucu logunda.
- AC-S1 (fiyat manipülasyonu): body'deki `price` hiç okunmuyor, fiyat her zaman `plans.price_minor_unit`'ten.
- AC-S3 (sahte webhook): imza `rawBody` üzerinde DB'ye dokunmadan önce doğrulanıyor.
- AC-S4 (rate limit): kullanıcı başına in-memory sayaç, 10sn/10 istek üstü 429.
- AC-S5 (bilgi sızıntısı): sağlayıcı ham hatası istemciye gitmiyor.

## AC-S2 (IDOR) — sonradan eklendi
İlk turda eksik kalmıştı, kullanıcı onayıyla test-first olarak tamamlandı:
`web/src/app/api/subscriptions/[id]/route.ts` (`GET`) hem `id` hem
`agent_id = auth.uid()` koşuluyla sorgular; başkasının kaydı ile hiç
olmayan kayıt AYNI `404 {"error":"NOT_FOUND"}` döner (bilgi sızıntısı yok).

## Kalan sınırlamalar / varsayımlar (kullanıcıya açık — otomatik karar verilmedi)
- **Rate limit bellek içi** (`Map`) — tek instance'ta çalışır, birden fazla sunucu instance'ında (ör. Vercel'de çoklu edge/serverless instance) paylaşılmaz. Küçük ölçekli faz-4 iterasyonu için kabul edilen bir sınırlama (atdd.md'nin Risks bölümünde zaten not edilmişti).
- **iyzico gerçek API şeması doğrulanmadı** — auth başlıkları/imza algoritması sandbox'a karşı test edilmedi (iyzico henüz ekip onaylı nihai karar değil, bkz. atdd.md).
- **Migration gerçek Supabase projesine henüz uygulanmadı** — `verify` adımında `supabase-check` ile canlı doğrulama gerekiyor.
- `SUPABASE_SERVICE_ROLE_KEY` env değişkeni `.env.local`'da henüz yok — runtime'da eklenmesi gerekiyor.
- `pricing/page.test.tsx` mock'ları plan id'lerini text/slug (`"plan-free"`) olarak kullanıyor; gerçek şema uuid. Bu testler DB'ye bağlanmadığı için teknik olarak sorun değil, ama tutarlılık için not edildi.

## CAVEMAN self-review
- `buy-button.tsx`: gerekli — Server Component içinde fetch/yönlendirme yapılamaz, checkout tetiklemek için client component zorunlu. Gereksiz soyutlama değil.
- `createServiceRoleClient()`: gerekli — RLS politikası kasıtlı olarak kullanıcı yazmasını engelliyor, service-role zorunlu.
- Rate limit için ayrı bir dosya/kütüphane eklenmedi, route içinde basit `Map` kullanıldı (CAVEMAN: en basit çözüm).
