# Test Diff — signup-agents-kaydi-olusturma

## Oluşturulan dosyalar
- `web/src/lib/auth/ensureAgentRow.test.ts` (4 test)
- `web/src/app/signup/actions.test.ts` (5 test — `it.each` dahil)
- `web/src/app/signup/page.test.tsx` (5 test, component smoke)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| ensureAgentRow payload (is_admin yok) | "başarılı insert: agents.insert sadece {id, company_name}..." |
| AC-5/AC-S4 (23505 idempotent) | "AC-5/AC-S4: 23505 (duplicate) hatası sessizce yutulur..." |
| (gerçek hata throw) | "başka bir hata (23505 dışında) THROW EDİLİR..." + network hata testi |
| AC-6 (company_name boş) | `it.each` — boş/sadece boşluk |
| AC-1/AC-2 (session var) | "signUp başarılı ve session dolu ise ensureAgentRow çağrılır..." |
| AC-3 (session yok) | "signUp başarılı ama session yoksa ensureAgentRow ÇAĞRILMAZ..." |
| AC-7/AC-S3 (enumeration) | "signUp() hata dönerse AC-3 ile TAM AYNI genel mesaj döner..." |
| signup/page.tsx yapısı | 5 component smoke testi (input/buton varlığı) |

## Red step doğrulandı
`npx vitest run` çalıştırıldı: 3 dosya da import hatasıyla FAIL
(`ensureAgentRow.ts`, `signup/actions.ts`, `signup/page.tsx` henüz yok).
Beklenen red-step durumu bu.

## Ek tur — test-gap kapatıldı (verify adımında bulundu)
`login/actions.ts`'e eklenen `ensureAgentRow()` çağrısı (AC-4) için
başlangıçta hiç test yoktu — kod incelemesinde bulundu, `web/src/app/login/actions.test.ts`
(5 test) eklendi: company_name dolu → ensureAgentRow çağrılır;
company_name yok/boş (3 alt-durum) → çağrılmaz; giriş başarısız →
çağrılmaz. Bu testler red-step DEĞİL (implementasyon zaten vardı),
geriye dönük doğrulama.

## Change-log
Yok.
