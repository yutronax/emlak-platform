# Plan — faz2b-plan-limitleri
_Reference: atdd.md (EML-98)_

## Keşif bulguları
- `listings_subscriber_select` (0001): erişim = `status in ('active','trialing') and current_period_end > now()`. **past_due bugün de akışa erişemiyor.** → AC-6'daki "past_due kendi planı" ifadesi mevcut erişim kuralıyla çelişiyor; plan kararı: erişim kuralı aynen korunur (past_due → `no_subscription`). atdd AC-6 buna göre okunur.
- Abonelerin `listings`'i okuyan 3 yeri var: `query.ts::fetchFeed`, `query.ts::fetchFilterOptions`, `unread.ts::getUnreadCount`. Üçü de RPC'ye taşınır.
- Admin `listings_admin_select` ayrı policy — dokunulmaz.
- Son migration 0019 → yeni `0020_feed_daily_limit.sql`.

## Kararlar
**Migration 0020** (security definer, `set search_path = public`, `revoke all from public; revoke execute from anon; grant execute to authenticated`):
- `drop policy listings_subscriber_select on listings;`
- Yardımcı (internal, grant yok): `feed_access()` → `(has_access boolean, lim integer)` — aynı abonelik koşulu; plan join; `max_listings` null → null (sınırsız); plan yok → 10 + `raise log 'feed_plan_missing'`; ≤0 → 0 + `raise log 'feed_limit_clamped'`. `revoke all from public, anon, authenticated` (yalnız diğer definer fonksiyonlar çağırır).
- `feed_listings(p_filters jsonb default '{}', p_page int default 1) returns jsonb`:
  - erişim yoksa `{"items":[],"locked_count":0,"limit":0,"reason":"no_subscription"}`.
  - CTE `ranked`: tüm listings + `row_number() over (partition by (created_at at time zone 'Europe/Istanbul')::date order by created_at desc, id desc) as rn`; `is_open = lim is null or rn <= lim`.
  - filtreler `p_filters`'tan yalnız bilinen anahtarlar: il, ilce, grup, fiyatMin, fiyatMax, oda (`5+` listesi), fiyat filtresi varsa `currency='TRY' and price not null` (mevcut fetchFeed ile birebir).
  - sayfa: `greatest(1, least(coalesce(p_page,1), 500))`, sabit 20, `order by created_at desc, id desc`.
  - açık satır: tüm alanlar + `locked:false`; kilitli satır: `jsonb_build_object('id','city','district','created_at','locked',true)` — başka anahtar YOK (AC-S2).
  - `locked_count` = filtreli kümedeki kilitli sayısı; `open_today` = bugün (İstanbul) `is_open` satır sayısı (filtresiz); `limit` = lim.
- `feed_filter_options(p_il text default null) returns jsonb` → `{"cities":[],"districts":[],"groups":[]}` distinct, erişim yoksa boş (AC-S7).
- `feed_unread_count(p_since timestamptz) returns integer` → erişim yoksa 0; yoksa `count(*) where created_at > p_since` limit 100'e kırpılmış (mevcut COUNT_LIMIT davranışı).
- `.down.sql`: üç fonksiyon + yardımcı drop, policy 0001'deki tanımla geri.

**Frontend**
- `query.ts`: `fetchFeed` → `supabase.rpc('feed_listings', {p_filters, p_page})` + timeout; dönüş tipi `FeedResult = {ok:true, items: FeedItem[], lockedCount, limit, openToday, reason?} | {ok:false, code}`. `FeedItem = OpenRow & {locked:false} | LockedRow`. Fallback yok (AC-9).
- `fetchFilterOptions` → `rpc('feed_filter_options', {p_il})`.
- `unread.ts` → `rpc('feed_unread_count', {p_since})`.
- `listing-card.tsx`: `locked` dalı → `LockedListingCard` (il/ilçe, `formatArrival`, bulanık yer tutucu blok, "Planı yükselt" → /pricing).
- `dashboard/page.tsx`: limit != null ise gösterge "Bugün X/N ilan açık" + bugün kilit varsa "Planı yükselt"; reason `no_subscription` → mevcut abonelik ekranı.
- `pricing/page.tsx`: select'e `max_listings`; plan kartında "Günde N ilan" / "Sınırsız ilan".

## Files
| File | Alan | Risk |
|---|---|---|
| supabase/migrations/0020_feed_daily_limit.sql (+down) | backend | high |
| web/src/test/migrations/feed-daily-limit.test.ts (yeni, statik SQL) | backend | low |
| web/src/lib/listings-feed/query.ts, unread.ts (+testler) | backend | medium |
| web/src/app/agent/dashboard/page.tsx, listing-card.tsx (+testler) | frontend | medium |
| web/src/app/(marketing)/pricing/page.tsx (+test) | frontend | low |

## Migration Required?
Evet — 0020. Yalnız orkestratör, `db query --linked -f`, kullanıcı onayıyla. Frontend ile aynı anda yayına girmeli.

## Risks
atdd Risks + pencere fonksiyonu tüm tabloyu tarar (bugün küçük); p95 verify'da `explain analyze` ile.

## Open Questions
Yok (past_due kararı yukarıda, mevcut kural korunur).
