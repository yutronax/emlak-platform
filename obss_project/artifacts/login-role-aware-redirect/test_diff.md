# Test Diff — login-role-aware-redirect

## Genişletilen dosya
- `web/src/app/login/actions.test.ts` (mevcut 5 test, 2'si güncellendi +
  4 yeni test eklendi = 9 test)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| AC-1 | "AC-1: agents.is_admin=true ise /admin/listings'e yönlendirilir" |
| AC-2a | "AC-2a: agents.is_admin=false ise /agent/dashboard'a yönlendirilir" |
| AC-2b | "AC-2b: agents satırı yoksa (data:null) /agent/dashboard'a yönlendirilir" |
| AC-3 | "AC-3: agents sorgusu hata dönerse pessimist /agent/dashboard'a..." |
| AC-4 (güncellendi) | "AC-4: giriş başarılı ve company_name doluysa... (pessimist) /agent/dashboard'a..." |
| AC-4 negatif (güncellendi) | `it.each` — company_name yok/boş |
| Regresyon | "giriş başarısız olursa..." (değişmedi) |

## Red step doğrulandı
`npx vitest run src/app/login/actions.test.ts`: **7/9 FAIL** (AC-1, AC-2a,
AC-2b, AC-3, ve güncellenen 2 eski test — implementasyon henüz değişmedi,
hâlâ koşulsuz `/admin/listings`'e yönlendiriyor), 2/9 PASS (regresyon
testi + bir alt-durum). Beklenen red-step durumu bu.

## Change-log
Yok.
