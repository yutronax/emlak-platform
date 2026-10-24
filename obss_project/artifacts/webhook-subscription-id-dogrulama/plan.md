# Plan — webhook-subscription-id-dogrulama
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — sadece bir API
route handler'ı ve migration, hiçbir .tsx/.jsx/sayfa bileşeni yok, Görsel/UI
kriteri atdd.md'de boş).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/api/webhooks/payment/route.ts | Koşullu update (AC-1/AC-S1/AC-3), var-olmayan-id no-op (AC-S2), needs_review kalıcılığı + processing_error (AC-5) | medium | backend |
| web/src/app/api/webhooks/payment/route.test.ts | Mevcut 4 testi (AC-1, AC-S3 x2, duplicate, needs_review) koru, AC-S1/AC-3/AC-S2/AC-5/AC-6 için yeni testler ekle | low | backend |
| web/src/test/fake-supabase.ts | `failUpdatesWith` şu an TÜM sonraki update çağrılarını (hem ilk patch hem needs_review denemesi) aynı hatayla başarısız kılıyor — AC-5'in "ilk update hata, needs_review update'i BAŞARILI" senaryosunu test edebilmek için tek-seferlik hata (örn. `failNextUpdateWith` veya bir sayaç) desteği eklenmeli | medium | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| supabase/migrations/0008_payment_events_processing_error.sql | `payment_events`e `processing_error boolean not null default false` kolonu (AC-5'in "ikinci update de başarısız" dalının kalıcı izi) | backend |

## Dependencies
- **Mevcut `do_POST` akışı** (değişmeyecek kısımlar): path kontrolü → imza
  doğrulama (401) → JSON parse (400) → zorunlu alan kontrolü (400) →
  `payment_events` idempotency insert (23505 → duplicate) — bu adımlar
  AYNEN kalır, sadece idempotency insert'e `.select("id")` eklenmeli ki
  dönen satırın id'si AC-5'in processing_error update'inde kullanılabilsin.
- **Koşullu update zinciri (AC-1/AC-S1/AC-3/AC-S2 — hepsi aynı kod yolu):**
  1. `.update(patch).eq("id", subscription_id).eq("status", "pending").select("id")`
     dene. `data.length > 0` ise AC-1 (başarılı geçiş), bitir.
  2. 0 satır etkilendiyse (`!error && data.length === 0`), AYRI bir
     `.select("status").eq("id", subscription_id).maybeSingle()` ile
     GERÇEK durumu oku:
     - Kayıt yok (`data === null`) → AC-S2: `console.warn`, hiçbir yazma
       yapma, `{received:true}` dön.
     - Kayıt var, `status === "active"` (veya hedef durumla aynı) → AC-S1:
       idempotent no-op, `console.info`/`console.warn` ile logla,
       `{received:true}` dön.
     - Kayıt var, `status` başka bir şey (örn. `"failed"`, beklenmeyen
       anomali) → AC-3: AYRI bir `.update({status:"needs_review"}).eq("id",
       subscription_id)` dene, `payment_events` satırına (adım 1'den gelen
       id ile) bir not düş (örn. `anomaly: true` alanı — ŞU AN
       `payment_events`'te böyle bir kolon yok, migration'a eklenmeli MİY
       yoksa sadece log mu yeterli — bu küçük bir açık karar, code-copilot
       en basit çözümü seçsin: sadece `console.warn` + `needs_review`
       update'i yeterli, `payment_events`'e ek alan EKLEME, CAVEMAN'a
       uygun en küçük çözüm).
  3. `error` varsa (GERÇEK DB hatası, adım 1'in kendisi exception
     fırlatırsa) → mevcut `catch` bloğuna düşer → AC-5: AYRI bir minimal
     `status="needs_review"` update'i BİR KEZ dene (bu da aynı `.eq("id",
     ...)`, koşulsuz — zaten hata yolunda, idempotency garantisi
     gerekmiyor). O da başarısız olursa `payment_events` satırını (adım
     1'deki id ile) `processing_error: true` ile güncelle (yeni migration,
     bkz. New Files), `console.error` logla, HTTP 500 dön. needs_review
     update'i BAŞARILI olursa mevcut davranış gibi `{received:true,
     subscription_id, status:"needs_review"}` 200 dön.
- **`fake-supabase.ts` sınırlaması:** `failUpdatesWith(error)` şu an
  `ctx.updateError`'ı set edip HER sonraki `.update()` çağrısını (çağrı
  sayısından bağımsız) aynı hatayla fırlatıyor. AC-5'in "ilk update hata,
  needs_review update'i başarılı" senaryosunu test etmek için bu fake'e
  tek-seferlik bir mod (örn. `failNextUpdateWith(error)` — sadece bir
  sonraki çağrıyı başarısız kılıp `ctx.updateError`'ı otomatik `null`'a
  döndürsün) eklenmesi gerekiyor. Bu, test-copilot'un dispatch'ine dahil
  edilmeli (mevcut `failUpdatesWith`'i KIRMADAN, yanına eklenecek).

## Migration Required?
**Yes** — `supabase/migrations/0008_payment_events_processing_error.sql`:
```sql
alter table payment_events
    add column processing_error boolean not null default false;
```
Gerekçe: AC-5'in "ikinci (needs_review) update de başarısız olursa"
dalının kalıcı bir izi olması gerekiyor — şu an `payment_events`'te bunu
tutacak bir alan yok. Projede ad-hoc migration'ları yasaklayan bir ADR
bulunamadı (EML-5/EML-20 de benzer şekilde migration dosyası ekledi) —
bu desenle tutarlı.

## Risks
(atdd.md'den taşındı, bu adımda bir yeni risk bulundu)
- `subscription_id`'nin iyzico'ya hiç gönderilmemiş olması (ayrı ön koşul
  görevi) — atdd.md'de zaten not edilmişti.
- **Yeni bulunan risk:** AC-3 ("failed'den success denemesi") senaryosu
  gerçek hayatta OLUŞMAMALI (iyzico aynı subscription için failed sonrası
  success göndermemeli) — ama kod savunmacı olarak bunu ele alıyor. Eğer
  bu hiç gerçekleşmezse AC-3'ün testi "teorik" kalır; bu bilinçli bir
  savunma katmanı, gereksiz kod değil (atdd.md'nin kendi AC-3'ü zaten bunu
  istiyor).

## Open Questions
Yok. atdd.md'nin kendi Unknowns bölümü zaten boş ("Önceki Unknowns Opus
alt-ajanı tarafından çözüldü ya da Risks/Kapsam Dışı'na taşındı" diyor).
Bu `plan` adımının kendi keşfi (fake-supabase.ts sınırlaması, migration
ihtiyacı, AC-3'ün `payment_events`'e ek alan eklemeden en basit çözümü)
yukarıdaki Dependencies/Migration bölümlerinde zaten somut kararlara
bağlandı — code-copilot'un kendi muhakemesine bırakılan tek şey yok.
