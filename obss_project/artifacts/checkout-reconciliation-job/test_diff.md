# Test Diff — checkout-reconciliation-job

## Oluşturulan dosya
- `web/src/app/api/cron/reconcile-subscriptions/route.test.ts` (7 test — `it.each` dahil)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| AC-S1 | `it.each` — header yok/yanlış/Bearer öneki yok (3 senaryo) |
| AC-S2 | "CRON_SECRET env set edilmemişse 500 döner..." |
| AC-3 | "geçerli secret ile eşiği aşan 2 kayıt güncellenirse..." |
| AC-5/AC-6 (eşik parametresi) | Aynı test içinde `lt` çağrısının ~1 saat öncesini doğrulaması |
| AC-S3/AC-7 | "eşiği aşan kayıt yoksa 200 + {updated: 0} döner..." |
| (gerçek DB hatası) | "gerçek bir DB hatası dönerse 500 döner..." |

## Red step doğrulandı
Dosya import hatasıyla (`route.ts` henüz yok) FAIL — beklenen red-step
durumu bu.

## Change-log
Yok.
