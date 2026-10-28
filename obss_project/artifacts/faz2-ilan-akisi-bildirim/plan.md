# Plan — faz2-ilan-akisi-bildirim
_Reference: atdd.md (EML-85)_

Frontend-pipeline: tetiklendi (.tsx + Görsel/UI kriteri).
- Discover: canlı tarayıcı keşfi atlandı — sayfa aktif abonelikli oturum ister; statik keşif yapıldı. Render doğrulaması `verify`'da (desktop/tablet/mobile + vision-test).
- Audit: mevcut sayfa düz `max-w-2xl` liste, `zinc-*` renkleri — tasarım sistemiyle (ink/fog/terracotta) uyumsuz. Bu görevde düzeltilecek: token'lara geçiş, kart yapısı, durum mesajlarında `ui/alert`.
- Design Direction: YENİ yön yok — `musteri-sayfalari-tasarim-yenileme/design-direction.md` token sistemi aynen kullanılır (fog-50 zemin, ink-900 başlık, slate-500 meta, mist-200 kart çizgisi, terracotta-600 yalnız buton zemini, terracotta-700 link, brick-700 hata `role="alert"`). Kartlar mobilde tek sütun, ≥768px 2 sütun. Zil: header'da, rozet `aria-label="N yeni ilan"`. Yasak: ALL-CAPS eyebrow, orta-nokta meta ayracı (mevcut " · " ayracı virgülle/ayrı satırla değiştirilir), buton sonu ok.

## Files to Modify
| File | Alan | Why | Risk |
|------|------|-----|------|
| web/src/app/agent/dashboard/page.tsx | frontend | AC-1..11, AC-3/4/5, AC-13 ilk sayaç, AC-16; searchParams okuma, sorgu oluşturma lib'e devredilir | medium |
| web/src/app/agent/dashboard/page.test.tsx | frontend | mevcut testler yeni kart/durum metinlerine uyarlanır | low |

## New Files
| File | Alan | Purpose |
|------|------|---------|
| supabase/migrations/0016_listings_feed_notifications.sql | backend | `listings.source_group_name text null`; backfill `update listings l set source_group_name=r.source_group_name from raw_listings r where l.raw_listing_id=r.id and l.source_group_name is null`; `approve_raw_listing` yeniden tanımı (insert'e `source_group_name` = raw satırdan); `agents.listings_seen_at timestamptz null`; `mark_listings_seen()` RPC; indeksler `listings(created_at desc)`, `listings(source_group_name)` (AC-12, 13, 17, 18, S1, S2) |
| supabase/migrations/0016_listings_feed_notifications.down.sql | backend | rollback notu/SQL (kolonlar, indeksler, fonksiyon drop; approve_raw_listing 0002 hâline) |
| web/src/lib/listings-feed/filters.ts (+ .test.ts) | frontend | `parseFeedFilters(searchParams, options)` → `{filters, hadInvalid}`; sayı parse, 0..1e12, min>max swap, oda allowlist `['1+0','1+1','2+1','3+1','4+1','5+']`, il/ilçe/grup allowlist + ≤100 karakter, sayfa 1..1000 (AC-2, 6, 8, S4, S5) |
| web/src/lib/listings-feed/query.ts (+ .test.ts) | frontend | `fetchFeed(supabase, filters)` yalnız `.eq/.gte/.lte/.order/.range` (sabit 20); fiyat aktifse `currency='TRY'` + `price not null`; "5+" → `.in('rooms', ['5+1','5+2','6+1','6+2','7+1','8+1'])` sabit listesi (string karşılaştırma/`like` yok); `fetchFilterOptions` distinct il/ilçe/grup; 5 sn `AbortSignal.timeout`; hata → `{ok:false, code}` + `console.error('[dashboard] listings query failed',{code})` (AC-2, 4, 7, 9, S6) |
| web/src/lib/listings-feed/format.ts (+ .test.ts) | frontend | `formatPrice`(mevcut `lib/format-price.ts` yeniden kullanılır, null → "Fiyat belirtilmemiş"), `formatLocation`, `formatGroup`, `formatArrival(createdAt, now)` (<24s göreli, aksi `27 Eki 14:05` Europe/Istanbul), `formatBadge(n)` (>99 → "99+") (AC-10, 11, 13) |
| web/src/lib/listings-feed/unread.ts (+ .test.ts) | frontend | `getUnreadCount(supabase, agentId, seenAt)` `count head:true`, `created_at > coalesce(seenAt, now-7g)`, limit 100; hata → null + log (AC-13, 16) |
| web/src/app/agent/dashboard/actions.ts (+ .test.ts) | frontend | server actions: `markListingsSeen()` — argüman ALMAZ, `rpc('mark_listings_seen')`, dönen satır sayısı 0 → `{ok:false}` + `console.warn('[dashboard] seen_at update affected 0 rows')`, hata → `{ok:false}` + `console.error('[dashboard] seen_at update failed',{code})`; `refreshUnreadCount()` abonelik yoksa sorgu atmaz (AC-14, 16, 17, S1, S3) |
| web/src/app/agent/dashboard/listing-card.tsx | frontend | kart bileşeni (server) |
| web/src/app/agent/dashboard/feed-filters.tsx | frontend | GET form (`method="get"`), seçenekler props'tan; "Filtreleri temizle" linki |
| web/src/app/agent/dashboard/notification-bell.tsx (+ .test.tsx) | frontend | "use client"; ilk değer props; 60_000 ms sabit polling, `document.visibilityState==='hidden'` iken durur; hatada son değer; tıklayınca `markListingsSeen`, `ok` ise rozet 0 (AC-13, 14, 15, 16) |
| web/src/test/migrations/listings-feed.test.ts | backend | migration SQL statik kontrolleri (kolonlar nullable, RPC `where id = auth.uid()`, `security invoker`, approve insert'inde source_group_name) |

## Dependencies
- `createClient` (`@/lib/supabase/server`), mevcut abonelik gate mantığı page.tsx'te korunur — `hasAccess` false ise ilan/sayaç/seçenek sorgusu YOK (AC-3, S3).
- `approve_raw_listing` (0002, `security invoker`, admin RLS) — yeniden tanımda imza ve davranış aynı, sadece kolon eklenir.
- `agents_self_update` policy (0001) + `prevent_self_is_admin_escalation` trigger (0004/0005) — `mark_listings_seen()` `security invoker`: `update agents set listings_seen_at = now() where id = auth.uid()` ; `get diagnostics` ile satır sayısı döner (int). Mevcut self-update policy başka agent satırını zaten engeller (AC-S2), trigger is_admin/id/created_at'ı korur.
- `ui/alert`, `ui/button`, `lib/format-price.ts`.

## Migration Required?
Evet — 0016. Kural (hafıza: live-db-changes): sadece orkestratör uygular, dosya bazında `supabase db query --linked -f`, HER seferinde kullanıcı onayı; `db push` yok, alt-ajan uygulamaz. Backfill aynı dosyada, idempotent (`where source_group_name is null`).

## Risks
- Distinct seçenek sorguları: PostgREST'te distinct yok → `select('city,district,source_group_name').limit(1000)` + JS'te tekilleştirme; havuz >1000 olunca eksik seçenek (kabul, Faz 3'te RPC).
- "5+" oda eşleşmesi sabit listeye bağlı; listede olmayan "9+1" kaçar (kabul, düşük).
- Güvenlik kontrol yolları:
  - seen_at yazımı: tek yol `mark_listings_seen()` RPC; server action argüman almaz (S1); PostgREST doğrudan PATCH yolu mevcut `agents_self_update` ile sınırlı (S2) — authz-test her iki yolu dener.
  - listings okuma: page sorgusu, sayaç (page + polling action), seçenek sorgusu — üçü de `hasAccess` kontrolünden sonra ve aynı RLS'ten (S3). Polling action abonelik kontrolünü kendisi tekrar yapar (client'a güvenmez).
  - filtre girdisi: tek giriş `parseFeedFilters`; query.ts yalnız onun çıktısını kabul eder (S4/S5).

## ECC Danışman Notları
Koşul var (migration + yeni modül) ama danışman çağrılmadı: maliyet kısıtı, keşif kapsamlı ve mevcut desenler (0002 RPC, 0004 trigger) birebir izleniyor. verify/red-team bunu telafi eder.

## Open Questions
Yok. atdd Unknowns ("column grant mı SECURITY DEFINER mi") burada çözüldü: ikisi de değil — mevcut `agents_self_update` policy'sine dayanan `security invoker` RPC (yeni yetki yüzeyi açmaz).

UI dosyası var → verify gate 11 (`vision-test`) aktif.
