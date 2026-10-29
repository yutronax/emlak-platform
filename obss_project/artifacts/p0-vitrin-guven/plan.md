# Plan — p0-vitrin-guven
_Reference: atdd.md (EML-90)_

Frontend-pipeline: tetiklendi. Discover + Audit = `tasarim-elestirisi-2026-10-28/rapor.md` (7 ekran görüntüsü, aynı gün). Design Direction: yeni yön yok, mevcut token sistemi (`musteri-sayfalari-tasarim-yenileme/design-direction.md`). verify gate 12 (vision-test) aktif, 4 viewport.

## Keşif bulguları (kararları belirleyen)
- `subscriptions` RLS: yalnız `subscriptions_self_select` var, kullanıcı INSERT/UPDATE policy'si YOK → AC-S3 bugün zaten sağlanıyor; test ile kanıtlanacak, yeni policy eklenmeyecek.
- `subscriptions_one_open_per_agent_idx` yalnız `pending/active` için unique; `trialing` kapsam dışı → "bir kez deneme" garantisi ayrıca kurulmalı.
- `plans`'ta slug/is_active yok → fiyat CTA linki `/signup?plan=<plan.id>`; "en ucuz plan" = `order by price_minor_unit asc limit 1`.
- Kayıt (`signup/actions.ts`) iki yol: e-posta onayı kapalıysa session var → `ensureAgentRow` + redirect; açıksa session yok → genel mesaj. Login (`login/actions.ts`) da `ensureAgentRow` çağırıyor. → trial çağrısı tek yerde: `ensureAgentRow` sonrası + dashboard yeniden denemesi; kayıt anındaki e-posta onayı durumundan bağımsız çalışır (atdd Unknown çözüldü).
- `/auth/callback` route'u YOK → yeni.

## Kararlar
- **Tek seferlik deneme:** `agents.trial_started_at timestamptz null` kolonu. `start_trial()` (SECURITY DEFINER, `set search_path = public`, argümansız, `returns boolean`):
  `update agents set trial_started_at = now() where id = auth.uid() and trial_started_at is null and not exists (select 1 from subscriptions where agent_id = auth.uid())` → `row_count = 0` ise `return false`; değilse en ucuz plan ile `insert into subscriptions (agent_id, plan_id, status, current_period_end) values (auth.uid(), v_plan, 'trialing', now() + interval '14 days')` → `return true`. Satır kilidi eşzamanlı ikinci çağrıyı 0 satıra düşürür (AC-5). Plan yoksa exception (kısmi başarı → AC-6 yolu).
- **Grant:** `revoke all ... from public; revoke execute ... from anon; grant execute ... to authenticated;` (AC-S2, postmortem K4).
- **KVKK:** `agents.terms_accepted_at timestamptz null`, `agents.terms_version text null`. Kayıt onaylanınca değer `ensureAgentRow`'a parametre olarak sunucuda `now()`/`'2026-10'` ile geçer; onay bilgisi session yoksa `auth.signUp` `options.data.terms_version` içinde taşınır ve ilk `ensureAgentRow`'da yazılır (AC-3, AC-S4).

## Files to Modify
| File | Alan | Why | Risk |
|---|---|---|---|
| web/src/components/site-header.tsx | frontend | AC-1 kısa logo, nowrap, 320px tek satır | low |
| web/src/components/whatsapp-button.tsx | frontend | AC-14 terracotta + halka, aria-label | low |
| web/src/app/(marketing)/layout.tsx (veya app/layout.tsx) | frontend | AC-14 mobil body padding-bottom (safe-area) | low |
| web/src/app/(marketing)/page.tsx | frontend | AC-9 güven bölümü "Nasıl çalışır" altına | low |
| web/src/app/(marketing)/pricing/page.tsx, buy-button.tsx | frontend | AC-7/8 dört CTA durumu, metin; "Satın Al" kaldır | medium |
| web/src/app/(marketing)/signup/page.tsx, actions.ts | frontend | AC-2/3/S4 onay kutusu + sunucu doğrulaması, terms meta, `?plan=` korunur | medium |
| web/src/app/(marketing)/login/page.tsx | frontend | AC-10 kopya, AC-13 link | low |
| web/src/lib/auth/ensureAgentRow.ts | backend | AC-3 terms alanları, ardından `start_trial()` çağrısı + AC-6 log | medium |
| web/src/app/agent/dashboard/page.tsx | frontend | AC-6 trial yeniden deneme + ikinci hatada uyarı | medium |
| (mevcut testler) signup/pricing/login/dashboard/header/whatsapp-button testleri | frontend | yeni metinlere uyarlama | low |

## New Files
| File | Alan | Purpose |
|---|---|---|
| supabase/migrations/0019_trial_terms.sql (+ .down.sql) | backend | agents.{trial_started_at, terms_accepted_at, terms_version}; `start_trial()` + revoke/grant |
| web/src/test/migrations/trial-terms.test.ts | backend | statik SQL testi (security definer + search_path, argümansız, revoke public+anon, interval 14 days) |
| web/src/lib/pricing/cta-state.ts (+ test) | frontend | `getCtaState({user, subscription, now})` → `'guest'|'trialing'|'expired'|'active'` + kalan gün (AC-7) |
| web/src/app/(marketing)/sifremi-unuttum/{page.tsx, actions.ts} (+ test) | frontend | AC-11, AC-S6; redirectTo `process.env.NEXT_PUBLIC_SITE_URL` + `/auth/callback?next=/sifre-yenile` |
| web/src/app/(marketing)/sifre-yenile/{page.tsx, actions.ts} (+ test) | frontend | AC-12, AC-S7 |
| web/src/app/auth/callback/route.ts (+ test) | frontend | `exchangeCodeForSession`; `next` yalnız `/` ile başlayan, `//` ve `/\` ile başlamayan göreli yol, aksi `/agent/dashboard` (AC-S5) |
| web/e2e veya mevcut Playwright yoksa web/src/test/layout/*.test.tsx | frontend | AC-1/AC-14 ölçümü — Playwright kurulu değilse verify'da Playwright MCP ile manuel ölçüm (yeni paket eklenmez) |

## Dependencies
`createClient` (server), `ensureAgentRow`, mevcut checkout (`/api/subscriptions/checkout`) değişmeden "Abone ol"/"Şimdi abone ol" butonlarının hedefi; `plans` RLS (authenticated select — girişsiz fiyat sayfası için 0010 anon select mevcut).

## Migration Required?
Evet — 0019. Kural: yalnız orkestratör, dosya bazında `db query --linked -f`, kullanıcı onayıyla. `NEXT_PUBLIC_SITE_URL` env değişkeni gerekiyorsa `.env.example`'a eklenir (SETUP notu) — yoksa plan adımında varlığı kontrol: (code-copilot kontrol edecek, yoksa ekleyecek).

## Risks
- SECURITY DEFINER RLS'i atlar: tüm sahiplik `auth.uid()`'e dayanır; argüman almadığı için IDOR yüzeyi yok. Güvenlik kontrol yolları:
  - trial oluşturma: tek yol `start_trial()`; doğrudan `subscriptions` INSERT/PATCH RLS'te policy olmadığı için reddedilir (AC-S3) — authz-test iki yolu dener.
  - terms alanları: kayıt action + `ensureAgentRow` (sunucu değerleri); `agents_self_update` ile sonradan değiştirme kabul edilen risk (atdd).
  - redirect: reset `redirectTo` ve `/auth/callback?next` — ikisi de sunucu tarafı sabit/allowlist (AC-S5).
  - reset sonucu: tek dönüş şekli `{ok:true}` her durumda (AC-S6).
- Mevcut trial'sız kullanıcılar `ensureAgentRow`/dashboard yolunda ilk girişte deneme alabilir (çünkü `trial_started_at` null ve aboneliği yok). Bu, atdd'nin "geriye dönük deneme yok" kapsam dışı maddesiyle çelişir → Kararlar'da çözüm: migration'da mevcut tüm agents için `trial_started_at = created_at` backfill (deneme hakkını kapatır, abonelik oluşturmaz).
- Destek butonu kesişim ölçümü Playwright gerektirir; repo'da Playwright kurulu değilse yeni bağımlılık yerine verify'da MCP ile ölçülür.

## ECC Danışman Notları
Koşul var (migration + auth), danışman çağrılmadı (maliyet); red-team telafi eder.

## Kararlar (kullanıcı)
- 2026-10-28: Mevcut kullanıcıların deneme hakkı kapatılır — 0019'da `update agents set trial_started_at = created_at where trial_started_at is null` (abonelik oluşturmaz). (kullanıcı onayı: "Evet, kapat")

## Open Questions
Yok. atdd Unknowns: e-posta onayı → iki yolu da kapsayan tasarımla çözüldü; hero metni ve mevcut kullanıcı backfill'i → atdd'de kapsam dışı (backfill yalnız deneme hakkını kapatmak için yapılır, bkz. Risks).

UI dosyası var → verify gate 12 aktif.
