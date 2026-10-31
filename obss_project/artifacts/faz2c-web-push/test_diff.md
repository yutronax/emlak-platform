# Test diff — faz2c-web-push (red)
Jira: EML-102 (backend), EML-103 (frontend).

| Dosya | AC |
|---|---|
| web/src/test/migrations/push-subscriptions.test.ts | AC-S1 (RLS), rollback |
| web/src/lib/push/endpoint.test.ts | AC-S2 |
| web/src/lib/push/payload.test.ts | AC-2, AC-S4 |
| web/src/app/agent/dashboard/push-actions.test.ts | AC-1, AC-4, AC-S1, AC-S2, AC-S7 |
| web/src/app/api/cron/push/route.test.ts | AC-2, AC-7, AC-S3, sözleşme 6–12 |
| web/src/app/agent/dashboard/push-toggle.test.tsx | AC-1, AC-4, AC-5, AC-6 |
| web/src/test/push/{service-worker,manifest,vapid-secret}.test.ts | AC-S6, AC-5, AC-S5 |

Red: tümü modül/dosya yok nedeniyle düşüyor; vapid-secret 4/4 koruma olarak geçiyor.
Sözleşme: `src/lib/push/{endpoint,payload,config,targets}.ts` (targets: loadTargets/countNewListings/markNotified/removeSubscription), `push-actions.ts` hata kodları unauthorized/invalid_endpoint/invalid_keys/save_failed.
Boşluk: AC-3 erişim filtresi `loadTargets` içinde — implementasyon adımında `targets.test.ts` ile kapatılacak + verify'da canlı probe.
