# Code Diff — account-subscription-coklu-kayit-secimi

## Değiştirilen dosyalar
- `web/src/app/account/subscription/page.tsx` — `.maybeSingle()` kaldırıldı,
  `.order("created_at",{ascending:false})` ile tüm satırlar çekiliyor;
  `pickSubscription(rows)` saf fonksiyonu (öncelik: active>trialing>
  past_due>pending>needs_review>failed>canceled) eklendi; `STATUS_LABELS`'a
  `trialing` eklendi; past_due uyarısı `role="alert"` + `/pricing` linki.
- `web/src/app/account/subscription/page.test.tsx` — 8 yeni test eklendi
  (AC-1..AC-8), eski 2 test (`data` tekil obje → dizi) düzeltildi.

## Düzeltme turu (şeffaflık için kayıtlı)
İlk implementasyon turu, eski testlerin (artık gerçeği yansıtmayan)
tekil-obje mock şekliyle "uyumlu" kalmak için `Array.isArray(data) ?
data : [data]` savunma dalı eklemişti — bu, gerçek Supabase davranışında
(`.single()`/`.maybeSingle()` olmadan hep dizi döner) HİÇ ÇALIŞMAYAN ölü
kod anlamına geliyordu (CAVEMAN ihlali, postmortem koşum 1'in test-gap
bulgusuyla aynı kökten — test/implementasyon uyumsuzluğu implementasyonda
"çözülmüş"). Kod incelemesinde yakalandı, düzeltme sırası:
1. Eski 2 testin `data` şekli diziye çevrildi (gerçek davranışı doğru
   simüle etsin).
2. Implementasyondaki ölü `Array.isArray` dalı kaldırıldı,
   `(data as unknown as SubscriptionRow[] | null) ?? []` ile sadeleştirildi.

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-1 (çoklu satır, hata yok) | ✅ |
| AC-2/3 (öncelik + tie-break) | ✅ `pickSubscription` + created_at desc sıralama |
| AC-4 (boş dizi, mevcut davranış) | ✅ |
| AC-5 (past_due role=alert + link) | ✅ |
| AC-6 (plan izolasyonu) | ✅ sadece seçilen satırın plan'ı |
| AC-7 (trialing etiketi) | ✅ |
| AC-8 (agent_id regresyonu) | ✅ değişmedi |

## Kalan sınırlamalar / Varsayımlar
- `plan:plans(name)` join'inin TypeScript tipi (`as unknown as` cast'i
  gerektirdi) Supabase client'ının generic tiplemesinde dizi/tekil obje
  belirsizliği taşıyor — runtime davranışını etkilemiyor (test edilen
  gerçek davranış doğru), ama tip güvenliği tam değil. Ayrı bir görev
  olarak (Supabase tip üretimi/generated types) ele alınabilir.

## CAVEMAN self-review
`pickSubscription` tek yeni fonksiyon, plan.md'de öngörülmüştü. Ölü kod
dalı kaldırıldı (düzeltme turunda).
