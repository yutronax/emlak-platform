# Test Diff — pricing-plans-sort-order-fix

## Oluşturulan/genişletilen dosyalar
- `web/src/app/pricing/page.test.tsx` (genişletildi) — Supabase client'ı
  doğrudan mock'layan bir test seti (`fake-supabase.ts` KULLANMIYOR, kendi
  `makeQuery` helper'ı var — order/returns zincirini destekliyor).
- `web/src/test/migrations/plans-sort-order.test.ts` (yeni) — dosya
  sistemi üzerinden migration varlığını doğrulayan test.

## AC → Test eşlemesi
| AC | Test | Durum |
|---|---|---|
| AC-1 | `page.test.tsx`: "AC-1 / Davranış Sözleşmesi #1 — DB'den sort_order artan sırada gelen planlar aynı sırayla render edilir" | PASS (page.tsx zaten doğru, bug DB şemasında) |
| AC-2 | `plans-sort-order.test.ts`: iki test (migration var mı, kolon integer/not null/default 0 mı) | **RED (beklenen)** — migration henüz yok |
| AC-3 | `page.test.tsx`: "AC-3 / Davranış Sözleşmesi #2 — plans tablosu boşsa..." | PASS |
| AC-4 | `page.test.tsx`: "AC-4 / Davranış Sözleşmesi #3 — sort_order kolonu eksikse (PostgREST 42703)..." — tam kod eşleşmesi (`code: "42703"`) kullanılmıyor doğrudan ama hata mesajı + buton yokluğu kontrol ediliyor | PASS |
| AC-5 | Kapsanmadı — backfill sıralamasının doğruluğu bu unit testlerde test edilemez (gerçek DB gerektirir); `verify`/`supabase-check` adımında gerçek projede doğrulanmalı. | Not: Open item |

## Not
`page.test.tsx` testleri implementasyon öncesi zaten YEŞİL — bunun nedeni
atdd.md'nin de belirttiği gibi page.tsx kodunun doğru olması, bug'ın
sadece eksik DB kolonunda olması. Asıl "red" sinyali migration testinden
geliyor. Bu, test-first/red-green kuralını ihlal etmiyor: page.tsx için
zaten var olan doğru davranışın regresyon testi yeşil kalması beklenir,
migration için red step doğru şekilde kırmızı.

## Kapsanmayan (code-copilot'a not)
- AC-5 (backfill sıralaması) gerçek DB'de doğrulanacak — migration
  yazıldıktan sonra `supabase-check`/`verify` adımında kontrol edilmeli.
