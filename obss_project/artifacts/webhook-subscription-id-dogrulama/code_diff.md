# Code Diff — webhook-subscription-id-dogrulama

## Oluşturulan dosyalar
- `supabase/migrations/0004_payment_events_processing_error.sql` —
  `payment_events`e `processing_error boolean not null default false`
  kolonu.

## Değiştirilen dosyalar
- `web/src/app/api/webhooks/payment/route.ts` — `payment_events` insert'ine
  `.select("id")` eklendi (id yakalanıyor). Koşullu update
  (`.eq("id",...).eq("status","pending")`) 0 satır etkilediğinde ayrı bir
  `.select("status")` ile gerçek durum okunuyor: kayıt yoksa (AC-S2) veya
  zaten hedef durumdaysa (AC-S1) sadece log, aksi halde (AC-3, anomali)
  `needs_review`'a ayrı bir update ile çekiliyor. Gerçek DB hatasında
  (catch bloğu) önce needs_review update'i deneniyor; o da başarısız
  olursa `payment_events.processing_error=true` yazılıp 500 dönülüyor
  (AC-5).
- `web/src/app/api/webhooks/payment/route.test.ts` — test-copilot
  tarafından yazıldı (bkz. test_diff.md), düzeltme turunda iki küçük
  hata giderildi (bkz. Düzeltme Turu).
- `web/src/test/fake-supabase.ts` — `failNextUpdateWith` tek-seferlikten
  kuyruğa (`failNextUpdateErrors: Error[]`) çevrildi, art arda çağrılarak
  birden fazla ardışık update çağrısını ayrı ayrı başarısız kılabiliyor.

## Düzeltme Turu (şeffaflık için kayıtlı)
İlk implementasyon turu doğruydu (plan.md'nin tasarımına birebir uydu),
ama iki test hatası ortaya çıktı — kod incelemesiyle (bu adımın kuralı:
alt-ajanın "PASS" raporu kanıt sayılmaz) yakalandı:
1. Eski bir test (`toHaveBeenCalledTimes(1)`) yeni tasarımda artık 2
   update çağrısı olduğu için yanlıştı — `(2)`'ye düzeltildi.
2. Yeni "ikisi de başarısız" testi `fake.failUpdatesWith` (kalıcı, TÜM
   tablolardaki update'leri bloklayan) kullanıyordu — bu, hatayı
   KAYDETMEK için gereken `payment_events.processing_error` write'ını da
   bloke ediyordu, test kendi kendini imkansız kılıyordu. `fake-supabase.ts`
   kuyruk desteğiyle genişletildi, test iki ardışık `failNextUpdateWith`
   çağrısına geçirildi (ilk iki update başarısız, üçüncüsü — processing_error
   yazması — normal/başarılı).

## Acceptance Criteria karşılığı
- AC-1, AC-S3, AC-9 (duplicate): değişmedi, mevcut davranış korunuyor.
- AC-S1 (zaten active): koşullu update 0 satır, current status==target → no-op + log.
- AC-3 (failed→success anomali): koşullu update 0 satır, current status≠target → needs_review update.
- AC-S2 (var olmayan id): koşullu update 0 satır, current=null → sadece log, hiç yazma.
- AC-5 (DB hatası, needs_review başarılı): catch → needs_review update başarılı → 200 + needs_review.
- AC-5 (ikisi de başarısız): catch → needs_review update başarısız → payment_events.processing_error=true → 500.
- AC-6 (bilinmeyen event_type): değişmedi.

## Kalan sınırlamalar / Varsayımlar
- AC-3'teki `needs_review` update'inin kendisi başarısız olursa (ikinci
  katman hata) şu an sessizce yutulur (sadece `console.warn`/`console.error`,
  response hâlâ `{received:true}`) — bu durumda ayrıca bir `processing_error`
  izi YOK. Bu, atdd.md'nin AC-3'ü sadece "needs_review'a çekilir" diyor,
  "bu da başarısız olursa ne olur" demiyor — bilinçli olarak dar tutuldu
  (AC-5'in processing_error mekanizması sadece ana catch bloğu için, AC-3
  için tekrarlanmadı — CAVEMAN, atdd.md'nin istemediği bir genelleme
  eklenmedi). Küçük bir risk, sonraki bir görevde ele alınabilir.
- 500 yanıtının body şekli (`{error:"INTERNAL_ERROR"}`) atdd.md'de
  sabitlenmemişti, test de sadece status kodunu kontrol ediyor — minimal
  bir body seçildi, projenin diğer route'larındaki (`checkout/route.ts`)
  `INTERNAL_ERROR` konvansiyonuyla tutarlı.

## CAVEMAN self-review
Yeni soyutlama/yardımcı fonksiyon yok — tüm mantık mevcut `POST` handler'ı
içinde, mevcut try/catch yapısına ek bir iç try/catch katmanı olarak
eklendi (CAVEMAN: en küçük değişiklik). `fake-supabase.ts`'in kuyruk
genişletmesi test altyapısı, implementasyon değil.
