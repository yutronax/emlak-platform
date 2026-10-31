# Code diff — faz3a-whatsapp-baglama (green)
Jira: EML-105, EML-106. web vitest 1019/1019, tsc 0, lint 0 hata, build OK (`○ /agent/whatsapp`). Sidecar `npm test` 96 pass / 1 skip (POSIX izin testi Windows'ta atlanıyor).

## Backend
- supabase/migrations/0023_wa_connections.sql (+down) — agents.wa_consent_*, wa_connections, wa_connection_events (requested_action alanı hız sınırı sayımı için), sidecar_heartbeat; RLS enable + policy yok + tablo grant yok; RPC'ler accept_wa_consent / request_wa_action / get_my_wa_status. **UYGULANMADI.**

## Sidecar
- scraper/sidecar/sessions/{crypto-auth-state,paths,mask,supabase-rest,manager,index}.js (+ testler, manager.lifecycle.test.js)
- bridge.js yalnız giriş bloğu (WA_MULTI_SESSION !== '0' → startSessions, try/catch)
- package.json `"test": "node --test --test-concurrency=1"` (eski bridge testleri aynı log dosyasında yarışıyordu — orkestratör)
- .gitignore `scraper/sidecar/wa-auth/` (orkestratör); .env.example WA_AUTH_KEY/WA_AUTH_ROOT/WA_MAX_SESSIONS/WA_MULTI_SESSION + NEXT_PUBLIC_WA_LINK_ENABLED

## Web
- web/src/lib/whatsapp/status.ts; web/src/app/agent/whatsapp/{actions.ts, wa-panel.tsx, page.tsx}; dashboard'a bayraklı link

## Açık notlar (red-team için)
- page.tsx'te `await connection()` yok (test ortamı); dinamiklik createClient→cookies() ile. Bayrak build'de boşsa sayfa statik 404.
- Panel kaldırma sırasında ~60 sn istemci tarafı sidecar_timeout (sözleşmede yok).
- Rate limit kontrolü mevcut-durum kısa devresinden önce.
- supabase-rest.js ve index.js birim testsiz (davranış manager testleriyle).
- Gerçek WhatsApp QR taraması yapılmadı (VPS/yerel sidecar + WA_AUTH_KEY gerekir).
