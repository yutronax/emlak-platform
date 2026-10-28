# Verify — faz1-video-siparisi / 1c (2026-10-28)

| Gate | Sonuç | Kanıt |
|---|---|---|
| Unit | PASS | vitest 39 dosya / 365 test (payments + api 77, pay-button, format-price dahil) |
| Type / Lint | PASS | tsc --noEmit; eslint 0 hata (2 uyarı önceden var: api/cron/reconcile-subscriptions/route.test.ts) |
| Build | PASS | /api/video-orders/[id]/checkout derlendi |
| Abonelik regresyonu | PASS | subscriptions/checkout ve webhook abonelik testleri aynen geçiyor; tek değişiklik createCheckoutSession çağrı biçimi |
| Migration | YOK | payment_events.video_order_id + tek-sahip kısıtı 0013'te canlıda |
| Webhook uçtan uca (yerel sunucu :3100 + canlı DB, geçici sır) | PASS 10/10 + düzeltme sonrası 3/3 | yanlış imza 401 ve sipariş değişmez; iki sahip 400; SUCCESS → in_progress, paid_at, due_at (+2 iş günü); payment_events video_order_id ile bağlı; aynı olay no-op; FAILED → payment_failed; tekrar SUCCESS → in_progress; iptal edilmiş siparişe ödeme durumu değiştirmez; oturumsuz checkout 401; temizlik tamam |
| Tarayıcı | KISMİ | Ödeme butonu/iyzico yönlendirmesi giriş gerektirdiği ve gerçek iyzico anahtarı olmadığı için denenmedi |

## Verify'da bulunan ve düzeltilen hata
Var olmayan abonelik/siparişe gelen imzalı bildirim **500** dönüyordu (payment_events FK ihlali 23503 genel hata sayılıyordu) → sağlayıcı sonsuza dek tekrar denerdi. Abonelik yolunda da önceden vardı; birim testleri sahte DB FK uygulamadığı için görmemişti. Düzeltme: 23503 → log + 200 `{received:true}`, kayıt yazılmaz. Yeni birim testi + canlıda video ve abonelik için 200 doğrulandı.

## Ek değişiklik
Fiyatlar tarayıcı para birimi biçimiyle "₺750,00" görünüyordu; fiyat sayfasıyla tutarlı "750,00 ₺" için `web/src/lib/format-price.ts` eklendi, 4 sayfa buna geçti.

## Bilinen risk (değişmedi)
iyzico isteğinde `callbackUrl` yok ve webhook gövdesi projeye özel; gerçek iyzico hesabına bağlanırken uyarlanmalı (abonelik için de geçerli).

## Red-team sonrası (red_team_1c.json)
- SF-1 çift tahsilat: ödenmiş/kapanmış siparişe ikinci SUCCESS → durum değişmez, `payment_events.processing_error=true` (iade için sorgulanabilir: `select * from payment_events where processing_error`).
- SF-3: uuid olmayan `video_order_id` → 400; insert'te 22P02 → 200 (sonsuz tekrar yok).
- SF-4: ödeme butonu sadece `https://` adrese yönlendirir.
- SF-2 (rate-limit Map temizliği, kod tekrarı) ertelendi.
- vitest 39 dosya / 368 test PASS; tsc PASS; eslint 0 hata.
