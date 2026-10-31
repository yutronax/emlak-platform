# Code diff — faz2c-web-push (green)
Jira: EML-102, EML-103. vitest 857/857, tsc 0, build OK (`ƒ /api/cron/push`).

## Backend
- supabase/migrations/0021_push_subscriptions.sql (+down) — tablo, endpoint unique, RLS self select/insert/delete, update yok, anon/public revoke. **UYGULANMADI.**
- web/src/lib/push/{endpoint,payload,config,targets}.ts (+ targets.test.ts — AC-3 erişim filtresi)
- web/src/app/agent/dashboard/push-actions.ts — upsert `ignoreDuplicates` (update policy yok), 10 cihaz sınırı
- web/src/app/api/cron/push/route.ts — CRON_SECRET fail-closed, VAPID yoksa disabled, 404/410 sil, kısmi başarı, db_failed 500
- web/vercel.json — `*/5 * * * *`
- package.json — web-push 3.6.7, @types/web-push 3.6.4
- .env.example — VAPID_*, NEXT_PUBLIC_VAPID_PUBLIC_KEY, CRON_SECRET

## Frontend
- web/public/sw.js, manifest.webmanifest, icons/icon.svg; layout.tsx manifest metadata
- web/src/app/agent/dashboard/push-toggle.tsx, page.tsx (zilin yanında)

## Açık notlar (red-team için)
- Paylaşılan cihaz: endpoint başka agent'a kayıtlıysa yeni agent'ın kaydı no-op (ignoreDuplicates); eski agent o cihaza "N yeni ilan" sayısını almaya devam eder. Çıkışta silme yok.
- last_notified_at = çalışma başlangıcı → nadir çift sayım (kaçırma yok).
- Apple touch icon (PNG) yok; iOS ana ekran ikonu varsayılan olabilir.
- 5 dk cron Vercel Pro gerektirir.
