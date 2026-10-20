# Test Diff — account-subscription-coklu-kayit-secimi

## Genişletilen dosya
- `web/src/app/account/subscription/page.test.tsx` (mevcut 4 test korunarak 8 yeni test eklendi)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| AC-1 | "birden fazla subscription satırı varsa hata vermez ve aktif satırı gösterir" |
| AC-2 | "öncelik sırasına göre 'active' satırı..." |
| AC-3 | "aynı öncelikteki birden fazla satırda ... ilk (en yeni) satırı seçer" |
| AC-4 | "boş dizi (data: []) için mevcut 'aboneliğiniz yok' davranışını korur" |
| AC-5 | "seçilen satır past_due ise uyarı role='alert' ile vurgulanır ve /pricing linki gösterilir" |
| AC-6 | "yalnızca seçilen satırın plan adını gösterir..." |
| AC-7 | "seçilen satır trialing ise 'Deneme sürümü' etiketini gösterir" |
| AC-8 | "çoklu satır senaryosunda sorgu hâlâ agent_id = auth.user.id filtresini kullanır" |

## Red step doğrulandı
`npx vitest run` çalıştırıldı: **7/12 FAIL** (AC-1,2,3,5,6,7 ve bir diğeri —
mevcut `.maybeSingle()` mock'ta rows[0]'ı seçiyor, öncelik mantığı yok),
**5/12 PASS** (mevcut 4 test + AC-8 regresyonu, zaten mevcut `eq` çağrısı
değişmediği için baştan geçiyor). Beklenen red-step durumu bu.

## Change-log
Yok.
