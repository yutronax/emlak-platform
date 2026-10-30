# Code diff — faz2b-plan-limitleri (green)
Jira: EML-99 (backend), EML-100 (frontend). vitest 729/729, tsc 0, build OK.

## Backend
- supabase/migrations/0020_feed_daily_limit.sql (+down) — `feed_access()` (internal, grant yok), `feed_listings(jsonb,int)`, `feed_filter_options(text)`, `feed_unread_count(timestamptz)`; hepsi security definer + search_path; revoke public/anon, grant authenticated; `drop policy listings_subscriber_select`. **UYGULANMADI.**
- web/src/lib/listings-feed/query.ts, unread.ts — RPC'ye geçiş; fallback yok; log "[dashboard] feed rpc failed".

## Frontend
- listing-card.tsx (kilitli kart), dashboard/page.tsx ("Bugün X/N ilan açık", Planı yükselt, no_subscription, Tekrar dene), pricing/page.tsx ("Günde N ilan"/"Sınırsız ilan", features listesinin üstünde ayrı satır).
- Eski from('listings') testleri RPC sözleşmesine çevrildi (page.test, actions.test).

## Açık notlar (red-team için)
- Plan kararı: past_due erişimi yok (mevcut RLS kuralı korundu) — atdd AC-6 metninden sapma.
- İstemci p_page'i 1000'e, sunucu 500'e kırpıyor; sunucu belirleyici.
- order/range artık sunucuda; istemci testinde doğrulanamıyor, canlı probe'da kontrol.
- Pencere fonksiyonu tüm listings'i tarıyor; p95 verify'da.
