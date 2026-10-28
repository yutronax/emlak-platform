# Code diff — faz2-ilan-akisi-bildirim (green)
Jira: EML-88 (backend), EML-89 (frontend). Orkestratör doğrulaması: vitest 520/520, tsc 0 hata, TODO/FIXME yok.

## Yeni
- supabase/migrations/0016_listings_feed_notifications.sql (+ .down.sql) — source_group_name + backfill, approve_raw_listing kopyalı, agents.listings_seen_at, mark_listings_seen() security invoker int, 2 indeks. UYGULANMADI (kullanıcı onayı bekliyor).
- web/src/lib/listings-feed/{filters,query,format,unread}.ts
- web/src/app/agent/dashboard/{actions.ts, notification-bell.tsx, listing-card.tsx, feed-filters.tsx}
## Değişen
- web/src/app/agent/dashboard/page.tsx (yeniden yazıldı, abonelik gate korundu)
- page.test.tsx — yalnız mock altyapısı (abortSignal + sorgu başına builder); assertion'lar aynı.

## Açık notlar (verify/red-team için)
- mark_listings_seen() için PUBLIC execute revoke yok; anon çağrısı auth.uid() null → 0 satır (zararsız). red-team değerlendirsin.
- getUnreadCount `_agentId` kullanılmıyor (test imzası).
- Sayfalama UI'ı yok (AC tarif etmiyor).
- Polling hatası loglanmıyor (sessiz son değer).
- Görsel doğrulama (vision-test 3 viewport) yapılmadı — verify gate 11.
