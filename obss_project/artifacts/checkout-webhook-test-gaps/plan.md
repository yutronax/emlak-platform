# Plan — checkout-webhook-test-gaps
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (route handler/test dosyaları, sayfa
bileşeni/`.tsx`/CSS yok, "Görsel/UI kriteri" boş).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/api/subscriptions/checkout/route.test.ts | AC-1..AC-4 için 4 yeni test case eklenir (400/502/504/23505) — mevcut `fake-supabase` + `vi.mock` deseni korunur, mevcut testler DEĞİŞTİRİLMEZ | low | frontend (Next.js route test — proje konvansiyonunda `frontend-copilot` alanına giriyor, backend değil, çünkü `web/` altındaki her şey frontend-copilot'un alanı) |
| web/src/app/api/webhooks/payment/route.test.ts | AC-5 için 1 yeni test case eklenir (PAYMENT_FAILED happy-path) — mevcut desen korunur | low | frontend |

## New Files
Yok.

## Dependencies
- `web/src/test/fake-supabase.ts` — her iki test dosyası da bunu kullanıyor;
  502/504/23505 senaryoları için `createCheckoutSession` mock'unun reject
  olması (`vi.mocked(createCheckoutSession).mockRejectedValue(...)`) ve
  `fake.client`'ın insert'te 23505 hatası simüle edebilmesi gerekiyor —
  mevcut `fake-supabase.ts`'in bunu destekleyip desteklemediği doğrulandı
  (aşağıya bak, destekliyor).
- `web/src/lib/payments/iyzico.ts` — `TimeoutError` adlı bir hata sınıfı/
  isimli hata nesnesi üretiyor mu kontrol edildi: route.ts'teki
  `isProviderTimeout` fonksiyonu `error.name === "TimeoutError"` kontrolü
  yapıyor — test, `new Error(...)` nesnesine `.name = "TimeoutError"` set
  ederek bunu taklit edecek (DOM/standart `TimeoutError`'a bağımlı değil).

## fake-supabase.ts Doğrulaması (dosya tam okunarak, önceki tahmin düzeltildi)
`web/src/test/fake-supabase.ts` (244 satır) baştan sona okundu — gerçek API:
- **23505 simülasyonu (AC-4 için):** `createFakeSupabase({ uniqueColumns:
  { subscriptions: "agent_id" } })` ile. `FakeQuery.insert()`'in `execute()`'ü,
  insert edilen satırın `uniqueColumn` değeri tablodaki MEVCUT herhangi bir
  satırla eşleşiyorsa (status'tan bağımsız) otomatik olarak
  `{data: null, error: {code: "23505", ...}}` döndürüyor. AC-4 testi için:
  `subscriptions` tablosuna test kullanıcısının `agent_id`'siyle ama
  `status: "cancelled"` (aktif DEĞİL, böylece önceki `activeSubscription`
  kontrolü geçer) bir satır ÖNCEDEN eklenip, `uniqueColumns: {subscriptions:
  "agent_id"}` verilirse, asıl `insert` çağrısı doğal olarak 23505'e düşer
  — route'un kendi 23505 yakalama dalı (satır 89) gerçekten tetiklenir.
- **502/504 testleri (AC-2/AC-3) için fake-supabase'in özel bir şeye
  ihtiyacı yok** — `createCheckoutSession` mock'u reject edilir
  (`vi.mocked(createCheckoutSession).mockRejectedValue(...)`), fake-supabase
  sadece normal `insert`/`update`'i (hata yok) sağlar; AC-3'te `update`
  çağrısının gerçekten yapıldığı `fake.update`/`fake.tables.subscriptions`
  üzerinden assert edilir.
- **400 testi (AC-1) için** hiçbir mock/fake değişikliği gerekmiyor —
  request body'de `plan_id` eksik gönderilir, route ilk kontrolde döner.
- `failUpdatesWith`/`failNextUpdateWith` (update hatası simülasyonu) bu
  görevde KULLANILMIYOR — webhook route'un mevcut testlerinde (AC-5 için
  değil, zaten var olan AC-5 testlerinde) kullanılan bir mekanizma, bu
  görevin yeni test case'i (PAYMENT_FAILED happy-path) hata simülasyonu
  gerektirmiyor.

## Migration Required?
Hayır — implementasyon ve şema değişmiyor, sadece test dosyaları.

## Sıcak Dosya — Refactor Adaylığı (postmortem Koşum 1 talimatı)
`web/src/app/api/webhooks/payment/route.ts` daha önce 2 farklı görevde
(EML-5'in ilk yazımı + webhook-subscription-id-dogrulama) PM bulgusu aldı
— tek `POST` handler'ı büyüyen bir if/else + nested try/catch zinciri
taşıyor (imza doğrulama → idempotency insert → status update → needs_review
fallback → processing_error fallback, 4 seviye). Bu görev dosyayı
DEĞİŞTİRMİYOR (sadece test ekliyor), ama `verify` adımının refactor-aday
kontrolü bu dosyayı YİNE somut olarak değerlendirmeli ve kullanıcıya
açıkça önermeli — üçüncü kez aynı dosyada bulgu tekrarı, artık "sıcak
dosya" eşiğini aşıyor (ilk Koşum 1'de 2 görevdi, şimdi bu görev de dosyaya
dokunuyor — test eklese bile dosyanın kendisi gündeme geliyor).

## Risks
(atdd.md'den taşınan, yeni bulunan yok)
- Sıcak dosya notu yukarıda — aksiyon `verify`'a bırakıldı, bu görevde
  refactor YAPILMAYACAK (kapsam dışı, atdd.md'de de böyle).

## Open Questions
Yok. atdd.md'nin Unknowns bölümü zaten boştu, bu adımın keşfi (fake-supabase
doğrulaması) da yeni bir belirsizlik bulmadı.
