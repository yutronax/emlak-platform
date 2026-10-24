# Test Diff — webhook-subscription-id-dogrulama

## Oluşturulan/genişletilen dosyalar
- `web/src/app/api/webhooks/payment/route.test.ts` (genişletildi, mevcut 4
  test korunarak 6 yeni test eklendi)
- `web/src/test/fake-supabase.ts` (genişletildi — `failNextUpdateWith`
  tek-seferlik hata enjeksiyonu, mevcut `failUpdatesWith` değişmedi)

## AC → Test eşlemesi
| AC | Test | Mevcut durum (implementasyon öncesi) |
|---|---|---|
| AC-S1 (zaten active → no-op) | "AC-S1: abonelik zaten active ise koşullu update 0 satır etkiler, hiçbir alan değişmez" | RED (beklenen) |
| AC-3 (failed → needs_review) | "AC-3: abonelik failed iken success event'i gelirse needs_review'a çekilir" | RED (beklenen) |
| AC-S2 (var olmayan id → no-op) | "AC-S2: subscription_id DB'de hiç yoksa 200 received:true döner, hiçbir satır etkilenmez" | PASS (mevcut davranış zaten uyuyor) |
| AC-5 (ilk update hata, needs_review başarılı) | "AC-5: ilk update hata verir ama needs_review update'i başarılı olursa..." | RED (beklenen — DB'de kalıcılık kontrolü yeni) |
| AC-5 (ikisi de başarısız → processing_error+500) | "AC-5: hem ilk update hem needs_review update'i başarısız olursa 500 döner..." | RED (beklenen — processing_error kolonu/mantığı yok) |
| AC-6 (bilinmeyen event_type) | "AC-6: bilinmeyen event_type için hiçbir update çağrılmaz..." | PASS (mevcut davranış zaten uyuyor) |

## Red step doğrulandı
Backend-copilot session'ının raporu: mevcut 4 test + AC-S2 + AC-6 PASS
(toplam 6), AC-S1/AC-3/AC-5×2 (4 test) implementasyon henüz yapılmadığı
için RED. Bu beklenen durum — plan.md'nin öngördüğü koşullu update zinciri
ve `processing_error` kolonu henüz yok.

## fake-supabase.ts genişletmesi
`failNextUpdateWith(error)` eklendi — SADECE bir sonraki `.update()`
çağrısını başarısız kılar, sonrasında normal davranışa döner (mevcut
`failUpdatesWith`'in kalıcı/her-zaman-başarısız davranışından ayrı,
onu değiştirmeden).

## Değiştirilmeyen (implementasyon bekleyen)
- `supabase/migrations/0008_payment_events_processing_error.sql` henüz
  yok — code-copilot bunu oluşturacak (plan.md'de belirtildi).
- `web/src/app/api/webhooks/payment/route.ts` henüz değişmedi.

## Change-log
Yok.
