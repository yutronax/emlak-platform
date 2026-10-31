# Plan — faz2c-web-push
_Reference: atdd.md (EML-101)_

## Keşif bulguları
- `web-push@3.6.7` + `@types/web-push@3.6.4` eklendi (kullanıcı onayı); `npm audit --omit=dev` 0 açık.
- Mevcut desen: `web/vercel.json` crons (`/api/cron/reconcile-subscriptions`, saatlik) ve route içinde `CRON_SECRET` Bearer kontrolü → aynı desen kopyalanır. `CRON_SECRET` zaten var.
- service_role istemcisi: `createServiceRoleClient()` (`src/lib/supabase/server.ts`).
- `listings`'e tek yazma yolu admin onayı; approve'a dokunulmaz.

## Kararlar
**Migration 0021_push_subscriptions.sql**
- `push_subscriptions(id uuid pk default gen_random_uuid(), agent_id uuid not null references agents(id) on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(), last_notified_at timestamptz)`; index `(agent_id)`.
- RLS enable; policy `push_subscriptions_self_select/insert/delete` — `agent_id = auth.uid()` (insert `with check`). Update policy yok. anon'a hiçbir yetki.
- Cihaz sınırı (AC-S7): uygulama katmanında (kayıt action'ı) — upsert sonrası agent'ın 10'dan fazla satırı varsa en eski(ler) silinir.

**Sunucu**
- `src/lib/push/endpoint.ts`: `isAllowedPushEndpoint(url)` (https + host allowlist, alt alan eşleşmesi `.push.apple.com` / `.notify.windows.com` sonek ile; `fcm.googleapis.com.evil.com` reddedilir), `isValidKey(s)` (base64url, 1–200).
- `src/lib/push/payload.ts`: `buildPayload(n)` → `{title:"Yeni ilanlar", body:"{n} yeni ilan geldi" | "99+ yeni ilan geldi", url:"/agent/dashboard"}`.
- `src/lib/push/config.ts`: VAPID env okuma (sunucu-only, `import "server-only"`), eksikse null.
- `src/app/agent/dashboard/push-actions.ts` (`"use server"`): `savePushSubscription`, `deletePushSubscription` — sözleşme satır 1–5.
- `src/app/api/cron/push/route.ts`: GET; CRON_SECRET (yoksa/yanlış 401); VAPID yoksa `skipped:"disabled"`; service_role ile erişimi olan agent'ların abonelik satırları (subscriptions join, feed_access ile aynı kural); her satır için `count listings where created_at > coalesce(last_notified_at, created_at)`; >0 ise `webpush.sendNotification`; başarı → last_notified_at = now(); 404/410 → sil; diğer hata → failed; özet log + JSON. DB okuma hatası → 500 `db_failed`.
- `vercel.json`: `{ "path": "/api/cron/push", "schedule": "*/5 * * * *" }`.

**İstemci**
- `public/sw.js`: yalnız `push` (payload JSON parse, showNotification) ve `notificationclick` (url aynı origin yolu ise aç, değilse `/agent/dashboard`).
- `public/manifest.webmanifest` + `src/app/layout.tsx` metadata `manifest` link; ikon olarak mevcut/basit PNG (192/512) — yoksa SVG ikon.
- `src/app/agent/dashboard/push-toggle.tsx` (`"use client"`): durumlar `unsupported | ios-browser | default | denied | subscribed | busy | error`; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` yoksa null render; iOS tespiti (iPhone/iPad UA + `navigator.standalone !== true` ve `display-mode: standalone` değil) → "Ana Ekrana Ekle" rehberi.
- Dashboard'da zilin yanına/altına yerleşir.
- `.env.example`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public ile aynı değer). Anahtar üretimi: `npx web-push generate-vapid-keys` (SETUP notu).

## Files
| File | Alan | Risk |
|---|---|---|
| supabase/migrations/0021_push_subscriptions.sql (+down) + web/src/test/migrations/push-subscriptions.test.ts | backend | medium |
| web/src/lib/push/{endpoint,payload,config}.ts (+test) | backend | low |
| web/src/app/api/cron/push/route.ts (+test), web/vercel.json | backend | medium |
| web/src/app/agent/dashboard/push-actions.ts (+test) | backend | medium |
| web/public/sw.js, web/public/manifest.webmanifest, ikonlar, web/src/app/layout.tsx | frontend | low |
| web/src/app/agent/dashboard/push-toggle.tsx (+test), dashboard/page.tsx | frontend | low |
| .env.example | devops | low |

## Migration Required?
Evet — 0021. Orkestratör, `db query --linked -f`, kullanıcı onayıyla.

## Risks
atdd Risks + Vercel Hobby cron günde 1 kez (Pro gerekir).

## Open Questions
Yok.
