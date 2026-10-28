# Test diff — faz2-ilan-akisi-bildirim (red step)
Jira: EML-86 (backend), EML-87 (frontend). Testler çalıştırılmadı (verify'ın işi).

| Dosya | Hedef AC |
|---|---|
| web/src/test/migrations/listings-feed.test.ts (yeni) | AC-12, 13, 17, 18, S1, S2 (statik SQL), rollback |
| web/src/lib/listings-feed/filters.test.ts (yeni) | AC-2, 6, 8, 9, S4, S5 |
| web/src/lib/listings-feed/query.test.ts (yeni) | AC-2, 4, 5, 7, 8, 9, S4, S6 |
| web/src/lib/listings-feed/format.test.ts (yeni) | AC-10, 11, 13 |
| web/src/lib/listings-feed/unread.test.ts (yeni) | AC-13, 16 |
| web/src/app/agent/dashboard/actions.test.ts (yeni) | AC-14, 16, 17, S1, S3 |
| web/src/app/agent/dashboard/notification-bell.test.tsx (yeni) | AC-13, 14, 15, 16 |
| web/src/app/agent/dashboard/page.test.tsx (genişletildi) | AC-1..11, 13, 16, S4, S5, S6 |

Kapsanmayan (integration/authz-test'e kalan): AC-S2 gerçek PostgREST PATCH, AC-12 admin onayının canlı kopyası — migration uygulandıktan sonra authz-test/supabase-check ile.

Alt-ajan notları (code-copilot'a): imza varsayımları test raporunda (filters alanları `grup, fiyatMin, fiyatMax, oda, il, ilce, sayfa`; `NotificationBell initialCount`; `formatPrice(2500000,'TRY')` → "2.500.000 TRY"). `count head:true` + `limit(100)` maliyeti düşürmez — kabul.
