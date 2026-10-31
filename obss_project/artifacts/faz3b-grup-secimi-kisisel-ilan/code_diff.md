# code_diff — faz3b-grup-secimi-kisisel-ilan (green)

## Backend — DB (EML-108)
- Yeni: supabase/migrations/0024_wa_groups_personal_listings.sql (+ .down.sql)
  - wa_groups, wa_group_selection, app_settings (eşik 0.70, CHECK 0-1); RLS açık/policy yok/grant revoke.
  - raw_listings/listings.owner_agent_id + değiştirilemezlik trigger'ı (AC-S6).
  - Dedup index owner başına (AC-11).
  - feed_listings/feed_filter_options/feed_unread_count owner filtreli; günlük limit yalnız ortak; scope='mine'; kartta `personal` + `owner_agent_id`.
  - approve_raw_listing owner taşır; RPC'ler: get_my_wa_groups, set_my_wa_group_selection, admin_set_threshold, ingest_personal_listing (service_role, eşik DB'de uygulanır), delete_my_wa_data (AC-12).
  - Down: kişisel satır varsa iptal eder.
- Değişen: web/src/app/api/cron/push/route.ts — kişisel ilan yalnız sahibine sayılır.

## Backend — scraper (EML-108)
- Yeni: scraper/sidecar/sessions/groups.js.
- Değişen: sessions/manager.js (grup senkronu, seçim önbelleği 60 sn, messages.upsert yalnız seçim varsa, agentId'li webhook, sayaçlar → heartbeat), sessions/index.js (SessionsRest), orchestrator.py (kişisel yol, `personal_outcome=` içeriksiz log satırı, parse/yazma hatası ayrı), supabase_client.py (get_threshold, ingest_personal_listing, fingerprint_exists ortak havuza daraltıldı).

## Frontend (EML-109)
- Yeni: agent/whatsapp/group-picker.tsx, lib/whatsapp/groups.ts, admin/listings/threshold-form.tsx.
- Değişen: wa-panel.tsx, whatsapp/actions.ts, whatsapp/page.tsx, dashboard/feed-filters.tsx, listing-card.tsx, dashboard/page.tsx, lib/listings-feed/filters.ts, query.ts, admin/listings/actions.ts, page.tsx.

## Bilinen açık noktalar (verify/red-team)
- `listings_subscriber_select` geri açılmadı (0020 bilerek kaldırmıştı) → doğrudan REST okuması zaten kapalı (plan sapması, daha güvenli).
- Python `personal_*` sayaçları heartbeat'e değil yalnız log satırına gidiyor (operatör görünürlüğü: log).
- Eşik kararını DB veriyor; Python'un `status` alanı bilgi amaçlı.
- `manager.test.js` 3a testi ("messages.upsert dinleyicisi yok") adı artık yanıltıcı; seçim yoksa hâlâ doğru.
- `api/cron/push/route.test.ts` içindeki `countNewListings` mock'ları artık etkisiz → verify'da kırılabilir.
- Deploy sırası: migration 0024 önce, sonra scraper/web.
- Migration canlıya uygulanmadı (kullanıcı onayı gerekir).
- Sidecar testleri alt-ajanın yerel koşusunda 123/124 geçti; diğerleri henüz koşulmadı.
- UI dosyaları değişti → verify'da vision-test (gate 11) aktif.
