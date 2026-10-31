# Plan — faz3a-whatsapp-baglama
_Reference: atdd.md (EML-104)_

## Keşif bulguları
- Sidecar: `scraper/sidecar/bridge.js` (CommonJS, Baileys 7 rc, `useMultiFileAuthState`, tek ortak oturum, reconnect/loggedOut/connectionReplaced mantığı). Testler `node --test` (bridge.*.test.js), Node 25. `package.json`'da `test` script yok → eklenir (`node --test`).
- Sidecar'da Supabase istemcisi yok; Python tarafı `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` kullanıyor → sidecar aynı env'lerle **global `fetch` ile PostgREST** çağırır (yeni bağımlılık yok).
- Web: `qrcode@1.5.4` + `@types/qrcode@1.5.5` eklendi (kullanıcı onayı); `npm audit --omit=dev` 0.
- Panel: `web/src/app/agent/{dashboard,videos}` → yeni `web/src/app/agent/whatsapp/`.
- Son migration 0022 → **0023_wa_connections.sql**.

## Kararlar
**Migration 0023**
- `agents.wa_consent_accepted_at timestamptz`, `agents.wa_consent_version text`.
- `wa_connections(agent_id uuid pk references agents on delete cascade, status text check in ('pending','qr','connected','disconnected','logged_out','error'), qr text, qr_expires_at timestamptz, qr_count int default 0, phone_masked text, error_code text, requested_action text check in ('connect','disconnect') null, requested_at timestamptz, attempt_id uuid, last_seen_at timestamptz, updated_at timestamptz default now())`.
- `wa_connection_events(id bigserial, agent_id, attempt_id, from_status, to_status, error_code, created_at)`; `wa_connect_requests(agent_id, created_at)` hız sınırı için (ya da events'ten sayım).
- `sidecar_heartbeat(id int pk check id=1, last_beat_at, sessions_open int, misconfigured bool, counters jsonb)`.
- RLS: `wa_connections` ve `wa_connection_events` enable, policy yok (doğrudan erişim kapalı); okuma yalnız RPC. `sidecar_heartbeat` RLS enable, policy yok.
- RPC'ler (security definer, search_path=public, revoke public/anon, grant authenticated):
  - `accept_wa_consent(p_version text)` → agents'a yazar; sürüm sabit '2026-10' dışında `invalid_version`.
  - `get_my_wa_status()` → kendi satırı; `qr` yalnız `status='qr' and qr_expires_at > now()` iken; `pending` ve `requested_at < now()-30s` ve heartbeat 30 sn'den eski → `error/sidecar_timeout` hesaplar (satırı da günceller); `phone_masked`; satır yoksa `{"status":"none"}`.
  - `request_wa_action(p_action text)` → onay yok `consent_required`; erişim yok (feed_access ile aynı kural: active/trialing/past_due + period) `subscription_required`; connect: 10 dk'da ≥3 → `rate_limited`; connected/pending/qr iken connect → mevcut durum; aksi halde upsert pending + requested_action + yeni attempt_id + event. disconnect: satır yoksa `{ok:true,status:"none"}`, varsa requested_action='disconnect'.
- `.down.sql`: hepsini düşürür.

**Sidecar** (CommonJS, yeni modüller; bridge.js ortak oturumu korunur)
- `sessions/crypto-auth-state.js`: `useEncryptedAuthState(dir, key)` — Baileys'in useMultiFileAuthState arayüzü, dosyalar AES-256-GCM (`iv|tag|ciphertext`), BufferJSON ile serileştirme; anahtar 32 bayt hex/base64 `WA_AUTH_KEY`.
- `sessions/paths.js`: `agentAuthDir(root, agentId)` — yalnız UUID regex, `path.resolve` ile kök altında kalma kontrolü, mkdir 0700; `removeAgentAuth`.
- `sessions/mask.js`: `maskPhone(jid)` → `+90 5** *** **12`; `redact(obj)` log yardımcıları.
- `sessions/supabase-rest.js`: fetch tabanlı küçük istemci (select pending requests, update status alanları, insert event, upsert heartbeat) — yalnız AC-S6 alanları.
- `sessions/manager.js`: `SessionManager` (Map agentId→soket), `makeSocket` enjekte edilebilir (test için sahte), poll 3 sn, heartbeat 30 sn, abonelik kontrolü 10 dk, açılışta connected olanları 2 sn arayla aç, backoff 2 sn→5 dk jitter, QR 20 sn/5 deneme, 45 sn no_qr, creds_persist_failed, kapasite, messages.upsert BAĞLANMAZ, `syncFullHistory:false`, `markOnlineOnConnect:false`.
- `sessions/index.js` + `bridge.js` girişinde `WA_MULTI_SESSION !== '0'` ise manager başlatılır; `WA_AUTH_KEY` yoksa misconfigured.
- Testler: `sessions/*.test.js` (node --test), sahte soket ile durum makinesi.

**Web**
- `web/src/lib/whatsapp/status.ts`: RPC çağrıları + tip eşleme; `web/src/app/agent/whatsapp/{page.tsx, actions.ts, wa-panel.tsx}`: onay kutusu + metin, Bağla, QR (qrcode → SVG, 2 sn poll `get_my_wa_status`), durum mesajları (atdd tablosu), Bağlantıyı kaldır (onay diyaloğu). `NEXT_PUBLIC_WA_LINK_ENABLED` yoksa sayfa notFound ve dashboard linki gizli.
- Dashboard'a "WhatsApp'ını bağla" linki (bayrak açıksa).
- `.env.example`: `WA_AUTH_KEY`, `WA_AUTH_ROOT`, `WA_MAX_SESSIONS`, `WA_MULTI_SESSION`, `NEXT_PUBLIC_WA_LINK_ENABLED`.

## Files
| Alan | Dosyalar | Risk |
|---|---|---|
| backend | supabase/migrations/0023_wa_connections.sql (+down), web/src/test/migrations/wa-connections.test.ts | high |
| sidecar | scraper/sidecar/sessions/*.js (+ .test.js), bridge.js girişi, package.json test script | high |
| frontend | web/src/lib/whatsapp/*, web/src/app/agent/whatsapp/*, dashboard link | medium |
| devops | .env.example | low |

## Migration Required?
Evet — 0023, orkestratör, kullanıcı onayıyla.

## Risks
atdd Risks + `sidecar_timeout`'un get_my_wa_status içinde hesaplanması (okuma fonksiyonu yazıyor) — kabul, sadece kendi satırı.

## Open Questions
Yok.
