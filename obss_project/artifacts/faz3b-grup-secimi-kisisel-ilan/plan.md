# Plan — faz3b-grup-secimi-kisisel-ilan
_Reference: atdd.md (EML-107)_

Frontend-pipeline: tetiklendi. Discover statik yapıldı (sayfalar oturum ister, test hesabı yok): mevcut `wa-panel.tsx`, `feed-filters.tsx`, `listing-card.tsx`, `admin/listings/page.tsx` desenleri izlenecek. Audit: mevcut sayfalara küçük ek bölüm, yeniden tasarım yok → atlandı. Design Direction: yeni UI/reshape değil → atlandı. Validate: verify'da 3 viewport + vision-test (gate 11 aktif).

## Mevcut akış (keşif)
- Ortak havuz: `bridge.js` (tek oturum) → `POST /baileys-webhook` → `orchestrator.handle_message` → `raw_listings` (pending) → admin `approve_raw_listing` → `listings`.
- Kişisel oturumlar: `sidecar/sessions/manager.js` (3a) — `messages.upsert` dinleyicisi **bağlanmıyor** (AC-4 3a).
- Akış: `feed_listings`/`feed_filter_options`/`feed_unread_count` (0020) + `listings_subscriber_select` policy (0020'de yeniden tanımlı); push: `web/src/app/api/cron/push`.
- Dedup: `fingerprint_exists()` (Python, global) + 0007 global partial unique index.

## Files to Modify
| File | Why | Alan | Risk |
|---|---|---|---|
| supabase/migrations/0024_wa_groups_personal_listings.sql (+ .down.sql) | wa_groups, wa_group_selection, app_settings, owner_agent_id kolonları, dedup index, RPC'ler, feed/policy owner filtresi | backend | high |
| scraper/sidecar/sessions/manager.js | groups senkronu (bağlantı + 6s + groups.update), messages.upsert yalnız seçili gruplar → webhook'a `agentId` ile, sayaçlar | backend | high |
| scraper/sidecar/sessions/index.js | seçim önbelleği yenileme döngüsü (60 sn), heartbeat counters birleşimi | backend | medium |
| scraper/orchestrator.py | `agentId` varsa kişisel yol: `ingest_personal_listing` RPC'si, eşik yönlendirme | backend | high |
| scraper/supabase_client.py | `ingest_personal_listing`, `get_threshold` yardımcıları; `fingerprint_exists` owner kapsamlı | backend | medium |
| web/src/app/agent/whatsapp/wa-panel.tsx, actions.ts, page.tsx | grup seçimi bölümü (checkbox listesi, sayaç N/20, salt-okunur durum) | frontend | medium |
| web/src/lib/whatsapp/status.ts | get_my_wa_groups yanıt tipleri (name null → "(adsız grup)") | frontend | low |
| web/src/app/agent/dashboard/feed-filters.tsx, listing-card.tsx, actions.ts, page.tsx | "Kendi gruplarım" filtresi (`p_filters.scope='mine'`), "Kendi grubun" rozeti | frontend | medium |
| web/src/app/admin/listings/page.tsx, actions.ts | "Kişisel — <emlakçı>" etiketi; eşik ayar formu | frontend | medium |
| web/src/app/api/cron/push/route.ts | kişisel ilan yalnız sahibine bildirilir | backend | high |

## New Files
| File | Purpose | Alan |
|---|---|---|
| web/src/app/agent/whatsapp/group-picker.tsx (+ test) | seçim bileşeni | frontend |
| web/src/app/admin/listings/threshold-form.tsx (+ test) | eşik formu | frontend |
| scraper/sidecar/sessions/groups.js (+ test) | grup senkron/seçim filtre/sayaç saf fonksiyonları | backend |
| scraper/tests/test_personal_ingest.py | orchestrator kişisel yol | backend |
| supabase/tests/faz3b_authz.sql veya scraper/scripts/verify_faz3b.py | iki emlakçılı izolasyon (AC-S1/S2/S6) | backend |

## Migration (0024) içeriği
- `wa_groups(agent_id fk cascade, group_jid text check len≤200, name text null, updated_at, pk(agent_id, group_jid))`; `wa_group_selection(agent_id, group_jid, created_at, pk, fk→wa_groups on delete cascade)`; ikisi de RLS açık + policy yok + grant revoke (0023 deseni).
- `app_settings(key text pk, value jsonb, updated_by uuid, updated_at)`; satır `personal_auto_approve_threshold = 0.70`; RLS, grant yok.
- `raw_listings.owner_agent_id`, `listings.owner_agent_id` (fk agents on delete cascade, null = ortak).
- 0007 index → `unique (coalesce(owner_agent_id,'00000000-…'::uuid), fingerprint) where status <> 'rejected'`.
- RPC'ler (security definer, auth.uid()): `get_my_wa_groups()`, `set_my_wa_group_selection(text[])`, `admin_set_threshold(numeric)` (admin kontrolü mevcut admin deseninden).
- Service-role RPC: `ingest_personal_listing(p_agent_id, p_record jsonb)` — tek transaction: raw insert + eşik ≥ ise approved + listings insert (kısmi başarı yok: hata → tümü rollback, sayaç). `revoke execute from anon, authenticated`.
- `feed_listings`/`feed_filter_options`/`feed_unread_count`: `owner_agent_id is null or owner_agent_id = auth.uid()`; günlük limit sayımı yalnız `owner_agent_id is null`; `scope='mine'` filtresi. `listings_subscriber_select` policy'si aynı koşulla yeniden.
- `approve_raw_listing`: owner_agent_id'yi listings'e taşır.
- 3a `delete_my_wa_data` (veya eşdeğeri) kişisel raw/listings/wa_groups'u siler (FK cascade agents silinmediği için açık delete).
- Uygulama: orkestratör, `db query --linked -f`, kullanıcı onayıyla (hafıza kuralı).

## Risks / Güvenlik kontrol yolları
- Owner filtresi şu yolların HEPSİNDE: `feed_listings`, `feed_filter_options`, `feed_unread_count`, `listings_subscriber_select` (doğrudan REST), push cron, `mark_listings_seen`, admin olmayan her listings okuması. (AC-S1)
- owner_agent_id kaynağı: manager.js oturum nesnesinin `agentId`'si → webhook payload → orchestrator; webhook localhost'ta; payload'daki agentId yalnız sidecar'dan gelir (orchestrator dış ağa kapalı varsayımı — verify'da kontrol). (AC-S3)
- Seçilmemiş/DM mesajlar manager.js'te webhook'a gitmeden düşer; içerik log'lanmaz. (AC-S4)
- Python `fingerprint_exists` global → owner kapsamlı yapılmazsa AC-11 bozulur.

## ECC Danışman Notları
Koşul var (migration + çok alan) ancak çağrılmadı — maliyet; red-team incelemesi kapsar. (Bilinçli atlama.)

## Open Questions
Yok. atdd Unknowns: `app_settings` yok → 0024'te açılıyor (çözüldü).
