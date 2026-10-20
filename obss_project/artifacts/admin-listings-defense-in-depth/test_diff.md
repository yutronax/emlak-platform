# Test Diff — admin-listings-defense-in-depth

## Oluşturulan dosyalar
- `web/src/lib/auth/requireAdmin.test.ts` (4 test)
- `web/src/app/admin/listings/actions.test.ts` (8 test — `describe.each` ile approveListing/rejectListing × 4 senaryo)
- `web/src/app/admin/listings/page.test.tsx` (5 test)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| requireAdmin saf mantık (3+1 dal) | `requireAdmin.test.ts` tamamı |
| AC-S1 (admin değil → rpc çağrılmaz) | actions.test.ts "requireAdmin not-admin dönerse rpc ÇAĞRILMAZ..." |
| AC-S1/S2 (oturum yok, action) | actions.test.ts "requireAdmin no-session dönerse redirect..." |
| AC-4 (admin happy path, action) | actions.test.ts "admin ise rpc ÇAĞRILIR..." |
| AC-S3 (action, hata sızıntısı) | actions.test.ts "rpc hata dönerse hata mesajı DB detayını İÇERMEZ..." |
| AC-S2 (page, oturum yok) | page.test.tsx "oturum yoksa (no-session) redirect('/login')..." |
| AC-S2 (page, admin değil) | page.test.tsx "oturum var ama admin değilse (not-admin) redirect('/agent/dashboard')..." |
| AC-5 (admin happy path, page) | page.test.tsx "admin ise sayfa başlığını ve bekleyen ilan listesini render eder" + boş-liste testi |
| AC-S3 (page, hata sızıntısı) | page.test.tsx "raw_listings sorgusu hata dönerse DB hata detayını göstermez..." |

## Red step
Implementasyon henüz yok (`requireAdmin.ts` yok, `actions.ts`/`page.tsx`
değişmedi) — testlerin kırmızı olması beklenir, `code-copilot` ile
doğrulanacak.

## Change-log
Yok.
