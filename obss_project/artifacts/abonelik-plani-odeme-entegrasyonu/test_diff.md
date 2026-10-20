# Test Diff — abonelik-plani-odeme-entegrasyonu
_Reference: atdd.md, plan.md_

## Altyapı
- `web/package.json`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` devDependency olarak eklendi; `"test": "vitest run"` script'i eklendi.
- `web/vitest.config.ts` (yeni): Node ortamı, `include: ["src/**/*.test.{ts,tsx}"]`, `@` → `src` alias.
- `web/src/test/fake-supabase.ts` (yeni yardımcı): bellek içi Supabase sahtesi, insert/update çağrıları spy ile izleniyor.

## Oluşturulan test dosyaları
| Dosya | AC eşlemesi |
|---|---|
| `web/src/app/api/subscriptions/checkout/route.test.ts` | AC-1 (happy path 201), AC-1 (400 INVALID_INPUT), AC-1 (404 PLAN_NOT_FOUND), AC-S2 ile ilişkili 401 UNAUTHORIZED, AC-4 (409 ALREADY_SUBSCRIBED), **AC-S1** (fiyat manipülasyonu — body'deki `price` yok sayılır, DB fiyatı kullanılır), **AC-S4** (rate limit, 11. istek 429) |
| `web/src/app/api/webhooks/payment/route.test.ts` | AC-1 (happy path, abonelik `active` olur), **AC-S3** (geçersiz/eksik HMAC imzası → 401, DB update hiç çağrılmaz), AC-3 (duplicate event_id → idempotent, update 1 kez), AC-5/satır-7 kısmi başarı (update hatası → `needs_review`) |
| `web/src/lib/payments/iyzico.test.ts` | AC-S3'ün temeli: `verifyWebhookSignature` doğru/yanlış/eksik imza; `createCheckoutSession` DB fiyatıyla sağlayıcı çağrısı |
| `web/src/app/pricing/page.test.tsx` | AC-1 (plan listesi DB'den okunur ve gösterilir), Davranış Sözleşmesi satır-3 (DB hatası → kırmızı hata mesajı, çökme yok), aktif plan için "Satın Al" butonu gizlenir |
| `web/src/app/account/subscription/page.test.tsx` | AC-1 (aktif abonelik gösterimi), boş sonuç ↔ hata ayrımı (abonelik yok ≠ sorgu hatası, farklı mesajlar), AC-5 (past_due uyarı mesajı) |

## Durum
`npx vitest run` (web/ içinde): **5 dosya, hepsi kırmızı** — "modül bulunamadı" hatasıyla (henüz `route.ts`/`iyzico.ts`/`page.tsx` yok). Bu beklenen red-step durumu. Altyapı hataları (jsdom eksik, .tsx toplanmıyor) giderildi; kalan kırmızılar sadece eksik implementasyondan.

## Varsayımlar (code-copilot'un uyması gereken noktalar — test dosyalarından)
- Env değişkenleri: `IYZICO_WEBHOOK_SECRET`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`.
- HMAC-SHA256, raw body üzerinde, hex digest, `x-iyzico-signature` header'ında.
- Webhook payload: `{event_id, event_type, subscription_id}`, idempotency `payment_events.event_id` unique üzerinden.
- `createCheckoutSession(planId, agentId)` → `{checkout_url, expires_at}` döndürür.
- `verifyWebhookSignature(rawBody, signatureHeader)` → boolean.
- Route'lar Supabase'i `createClient()` (server.ts) ile `auth.getUser()` + `from(table)` zinciriyle kullanır.
- `plans` tablosu: `id`, `name`, `price_minor_unit`, `sort_order`.
- `subscriptions` sorgusu `eq("user_id"...)` ile filtrelenir (not: migration'da FK sütunu `agent_id` — code-copilot gerçek sütun adını `agent_id` olarak kullanmalı, test mock'u sütun adına bakmıyor sadece çağrıyı spy'lıyor, bu bir tutarsızlık riski değil).
- Subscription sayfası boş durum metni `/aboneliğiniz yok/i`, hata metni `/yüklenemedi/i`, past_due uyarı metni `/ödeme.*(gecik|başarısız)/i` regex'ine uymalı.
