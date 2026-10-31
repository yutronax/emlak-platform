# Test diff — faz3a-whatsapp-baglama (red)
Jira: EML-105 (backend + sidecar), EML-106 (frontend).

| Dosya | AC |
|---|---|
| web/src/test/migrations/wa-connections.test.ts | AC-1, AC-9, AC-S1, AC-S2, AC-S4, AC-S7, rollback |
| scraper/sidecar/sessions/crypto-auth-state.test.js | AC-S3 |
| scraper/sidecar/sessions/paths.test.js | AC-S3 (traversal, 0700) |
| scraper/sidecar/sessions/mask.test.js | AC-S5 |
| scraper/sidecar/sessions/manager.test.js | AC-2..6, AC-8 (backoff/replaced), AC-10, AC-11, AC-S3 kısmi, AC-S5, AC-S6 |
| web/src/lib/whatsapp/status.test.ts | AC-2, AC-S1, AC-S7 |
| web/src/app/agent/whatsapp/wa-panel.test.tsx | AC-1, 2, 3, 5, 6, 7, 9, hata mesajları |
| web/src/app/agent/whatsapp/page.test.tsx | AC-11, oturum |

Red: tümü modül/dosya yok nedeniyle FAIL.
Boşluklar (implementasyon adımında test eklenecek): sidecar açılışta connected oturumları yeniden açma (AC-8), 10 dk abonelik kontrolü (AC-9), 45 sn no_qr_generated, heartbeat.
Sözleşme: manager `tick()`; rest metotları fetchPendingRequests/update/insertEvent/deleteConnection/heartbeat/isSubscriptionActive/listConnectedAgents; DisconnectReason 401/440; web `getMyWaStatus` → `{ok:true,...payload}`.
