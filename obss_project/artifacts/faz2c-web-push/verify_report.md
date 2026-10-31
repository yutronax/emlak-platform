# Verify Report — faz2c-web-push
_2026-10-31 · Reference: atdd.md, plan.md, code_diff.md_

| # | Gate | Result | Evidence |
|---|---|---|---|
| 2 | Build | PASS | Compiled successfully, `ƒ /api/cron/push` |
| 3 | Supabase canlı | PASS | 0021 uygulandı (kullanıcı onayı); RLS probe'ları aşağıda |
| 4 | Lint | PASS | 0 hata |
| 5 | Type check | PASS | tsc 0 |
| 6 | Unit | PASS | 857/857 |
| 7 | E2E | PARTIAL | Yerel dev: cron 401, sw.js 200 (application/javascript), manifest 200, `<link rel="manifest">` HTML'de. İzin istemi ve gerçek bildirim otomatikleştirilemez → gerçek cihaz testi kullanıcıda (VAPID anahtarları üretildikten sonra) |
| 10 | Güvenlik | PASS | `npm audit --omit=dev` 0 açık; probe'lar aşağıda |

## Canlı probe'lar (rolled-back tx, admin olmayan iki agent A/B)
| Kontrol | Sonuç | AC |
|---|---|---|
| A, B'nin satırını select | 0 | AC-S1 ✓ |
| A, B'nin satırını delete | 0 satır silindi, B satırı duruyor | AC-S1 ✓ |
| A, kendi satırını insert/select | 1 / 1 | AC-1 ✓ |
| A, `agent_id` = başkası ile insert | 42501 RLS | AC-S1 ✓ |
| anon `GET /rest/v1/push_subscriptions` | 42501 (grant yok) | AC-S1 ✓ |
| `GET /api/cron/push` başlıksız / yanlış Bearer | 401 `{"error":"unauthorized"}` | AC-S3 ✓ |

## Doğrulanamayan
- Gerçek bildirim teslimi (Android Chrome, iPhone PWA) — VAPID env yok; kullanıcı anahtar üretip cihazda test etmeli.
- Vercel Cron 5 dk çalışması — Pro plan gerektirir.
- Buton görünümü panelde — panel oturum gerektiriyor.

## Iterate (2026-10-31, red-team düzeltmesi, kullanıcı: "Evet, düzelt")
- 0022_push_endpoint_check canlıya uygulandı (kullanıcı onayı). Doğrudan PostgREST yolu (authenticated, kendi agent_id'si) ile insert:
  - `http://169.254.169.254/latest` → 23514 (check)
  - `https://fcm.googleapis.com.evil.com/x` → 23514
  - `https://fcm.googleapis.com:8443/x` → 23514
  - `https://fcm.googleapis.com/fcm/send/ok` → eklendi (rollback)
- Cron her hedefi göndermeden önce yeniden doğruluyor, geçmeyeni siliyor. Paylaşılan cihazda sahiplik devri (getPushRegistrationStatus + service-role eq(endpoint) silme). vitest 887 geçti (2 canlı-DB dosyası tam koşuda timeout, tek başına geçiyor), tsc 0.
