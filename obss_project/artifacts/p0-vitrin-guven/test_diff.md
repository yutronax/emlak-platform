# Test diff — p0-vitrin-guven (red step)
Jira: EML-91 (backend), EML-92 (frontend). Testler çalıştırılmadı.

| Dosya | Hedef AC |
|---|---|
| web/src/test/migrations/trial-terms.test.ts (yeni) | AC-3,4,5, AC-S1, AC-S2, backfill, rollback |
| web/src/lib/auth/ensureAgentRow.test.ts (genişletildi) | AC-3, AC-4, AC-6, AC-S4, AC-S8 |
| web/src/lib/pricing/cta-state.test.ts (yeni) | AC-7 |
| web/src/app/(marketing)/pricing/page.test.tsx (genişletildi) | AC-7, AC-8 |
| web/src/app/(marketing)/signup/{actions,page}.test.ts(x) (genişletildi) | AC-2, AC-3, AC-S4 |
| web/src/app/(marketing)/sifremi-unuttum/{actions,page}.test.ts(x) (yeni) | AC-11, AC-S6, AC-S8 |
| web/src/app/(marketing)/sifre-yenile/actions.test.ts (yeni) | AC-12, AC-S7 |
| web/src/app/auth/callback/route.test.ts (yeni) | AC-S5 |
| web/src/app/(marketing)/login/page.test.tsx (yeni) | AC-10, AC-13 |
| web/src/app/(marketing)/page.test.tsx (yeni) | AC-9 |
| web/src/components/site-header.test.tsx (yeni) | AC-1 (metin/yapı) |
| web/src/components/whatsapp-button.test.tsx (genişletildi) | AC-14 (aria-label) |
| web/src/app/agent/dashboard/page.test.tsx (genişletildi) | AC-4, AC-5, AC-6 |

Testle kanıtlanmayan (verify'da): AC-1 tek satır/scrollWidth, AC-14 kesişim + kontrast, AC-15 axe — Playwright/axe kurulu değil, MCP ile ölçülecek. AC-S2/S3 canlı (anon RPC 401, doğrudan subscriptions INSERT/PATCH reddi) — migration uygulandıktan sonra authz-test.

## Implementasyon için imza notları (alt-ajan raporlarından)
- `ensureAgentRow(supabase, userId, companyName, terms?: {accepted: boolean})`; `terms_accepted_at = new Date().toISOString()`; `start_trial` insert'ten sonra her çağrıda.
- `getCtaState({user, subscription, now})` → `{kind, daysLeft?}`.
- `requestPasswordReset(formData)` → `{ok:true}|{error}`; 429 → `rate_limited`.
- `updatePassword(formData)` alanlar `password`, `password_confirm`; oturum `auth.getUser()`.
- `auth/callback/route.ts` `GET(request)`.
- "Mevcut planınız" pasif `<button disabled>`.
- `NEXT_PUBLIC_SITE_URL` env'i `.env.example`'a eklenmeli.
- Sözleşme #8b: `start_trial()` `false` + kullanıcının aboneliği yoksa (agents satırı yok vb.) dashboard bunu hata gibi ele alır — uyarı gösterir ve `trial_create_failed {reason:'no_row'}` loglar; `false` + abonelik varsa log yok (#4).
