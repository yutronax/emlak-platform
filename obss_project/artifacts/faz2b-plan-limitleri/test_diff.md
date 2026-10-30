# Test diff — faz2b-plan-limitleri (red)
Jira: EML-99 (backend), EML-100 (frontend).

| Dosya | AC |
|---|---|
| web/src/test/migrations/feed-daily-limit.test.ts (yeni, statik SQL) | AC-1, AC-S1..S4, S6, rollback |
| web/src/lib/listings-feed/query.test.ts (yeniden yazıldı) | AC-2, AC-7, AC-9, AC-S3 (istemci kimlik göndermez) |
| web/src/lib/listings-feed/unread.test.ts (yeniden yazıldı) | AC-7 |
| web/src/app/agent/dashboard/listing-card.test.tsx (yeni) | AC-4 |
| web/src/app/agent/dashboard/page.test.tsx (+describe) | AC-5, AC-9 |
| web/src/app/(marketing)/pricing/page.test.tsx (+describe) | AC-8 |

Red: backend 65 fail / 7 negatif guard geçiyor; frontend 9 fail. Mevcut testler bozulmadı.
Sözleşme: rpc("feed_listings",{p_filters,p_page}) / rpc("feed_filter_options",{p_il}) / rpc("feed_unread_count",{p_since}), hepsi abortSignal; FeedResult {ok:true, items, lockedCount, limit, openToday, reason?} | {ok:false, code}; log "[dashboard] feed rpc failed".
Canlı kanıt (verify): AC-1/2/10 SQL davranışı, AC-S1/S4/S5 REST probe.
