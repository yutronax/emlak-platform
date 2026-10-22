# Code Diff — checkout-reconciliation-job

## Oluşturulan dosyalar
- `web/src/app/api/cron/reconcile-subscriptions/route.ts` — CRON_SECRET
  doğrulama (`timingSafeEqual`, fail-closed), koşullu UPDATE
  (`status=pending AND created_at < 1 saat önce`), idempotent.
- `web/vercel.json` — saatlik cron yapılandırması.

## Düzeltme turu
İlk implementasyon doğruydu (7/7 test PASS), ama `route.test.ts`'in
kendi içinde bir type-check hatası vardı (`lt` mock'u tiplenmemişti,
`.mock.calls[0]` tuple cast'i TS2352 veriyordu). SADECE TEST düzeltmesi
ile (`lt` mock'una açık parametre tipi eklendi) giderildi, `route.ts`'e
dokunulmadı.

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-S1 (secret eksik/yanlış → 401) | ✅ |
| AC-S2 (env yok → 500, fail-closed) | ✅ |
| AC-3 (eşiği aşan pending → needs_review) | ✅ |
| AC-S3 (idempotent) | ✅ koşullu UPDATE, 0 satır normal |
| AC-5/AC-6 (SQL koşulu) | ✅ `.eq("status","pending").lt("created_at",...)` |
| AC-7 (yapacak iş yok) | ✅ `{updated:0}` |

## Kalan sınırlamalar / Varsayımlar
- Gerçek iyzico entegrasyonu yok (bilinçli, atdd.md'de kapsam dışı) —
  bu job sadece görünürlük sağlıyor, otomatik düzeltme yapmıyor.
- `vercel.json` henüz Vercel'e deploy edilip cron'un gerçekten
  tetiklendiği canlı doğrulanmadı — bu `verify` adımında not edilecek
  (Vercel platformu dışında test edilemez).

## CAVEMAN self-review
Yeni soyutlama yok — Opus alt-ajanının önerdiği `PaymentStatusProvider`
arayüzü BİLİNÇLİ OLARAK eklenmedi (atdd.md'nin Assumptions bölümünde
gerekçeli: hiçbir sağlayıcı çağrısı olmadan bu, kullanılmayan bir
soyutlama olurdu).
