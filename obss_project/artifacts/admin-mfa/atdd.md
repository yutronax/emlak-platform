---
task_slug: admin-mfa
priority: high
threat_model: inline (AC-S)
jira_id: null
affected_modules: [web/src/lib/auth/requireAdmin.ts, web/src/app/admin/layout.tsx, web/src/app/(marketing)/login/actions.ts, web/src/app/(marketing)/mfa/ (yeni), supabase/migrations/0033_admin_mfa.sql (yeni)]
---

# Admin hesaplarında zorunlu MFA (TOTP)

## Neden
Güvenlik değerlendirmesi (2026-11-15) bulgu 1: admin hesapları yalnız parolayla korunuyor. Admin; telefon numaralı ham WhatsApp mesajlarını (`raw_listings`) görür, ilan onaylar, emlakçı askıya alır, destek mesajlarını okur. Referans vakalar: PowerSchool (MFA'sız destek hesabı), Qantas, Coinbase.

## Kararlar
- Supabase Auth TOTP MFA kullanılır (`supabase.auth.mfa.*`). Yeni bağımlılık yok.
- İki katman: (1) uygulama — admin sayfaları/işlemleri `aal2` ister; (2) veritabanı — admin verisine erişim `aal2` JWT ister (doğrudan REST çağrısıyla uygulama katmanının atlanmasına karşı).
- Admin olmayan emlakçılar için hiçbir şey değişmez (MFA istenmez).

## Acceptance Criteria
1. **AC-1** `requireAdmin()`: oturum + `is_admin` sonrası `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` okunur; `currentLevel !== "aal2"` ise `{ ok: false, reason: "mfa-required" }` döner (mevcut `no-session` / `not-admin` aynen). Tüm admin server action'ları bu sonucu mevcut ok:false yollarıyla reddeder (yeni bir yetki yolu açılmaz).
2. **AC-2** `app/admin/layout.tsx`: admin ama `aal2` değilse `redirect("/mfa")`; admin değilse mevcut `notFound()`; oturum yoksa mevcut `/login`.
3. **AC-3** Giriş: `login` action'ı admin kullanıcıyı `/admin/listings` yerine `/mfa`'ya yönlendirir; admin olmayan aynı (`/agent/dashboard`).
4. **AC-4** `/mfa` sayfası (yalnız admin; oturum yoksa `/login`, admin değilse `notFound()`; zaten `aal2` ise `/admin/listings`'e yönlendirir):
   - Doğrulanmış TOTP faktörü YOKSA kurulum: `mfa.enroll({ factorType: "totp", friendlyName: "Admin" })` sonucu QR (`totp.qr_code`, SVG data URL) ve elle girilecek `totp.secret` gösterilir; 6 haneli kod formu `mfa.challengeAndVerify({ factorId, code })` ile doğrular. Başarı → `/admin/listings`. Önceki yarım kalmış (unverified) faktörler kurulumdan önce `mfa.unenroll` ile temizlenir.
   - Doğrulanmış faktör VARSA doğrulama: yalnız 6 haneli kod formu; `challengeAndVerify` ile `aal2`'ye yükselir → `/admin/listings`.
   - Yanlış/eksik kod: Türkçe hata ("Kod geçersiz ya da süresi doldu."), sayfa kalır. Kod yalnız 6 rakam kabul eder (sunucu tarafında da doğrulanır).
   - Formlar server action; kod ya da secret loglanmaz.
5. **AC-5** Veritabanı (migration 0033): yardımcılar `public.is_admin_user()` (auth.uid() admin mi) ve `public.session_is_aal2()` (`coalesce(auth.jwt()->>'aal','') = 'aal2'`), ikisi `stable`, `search_path` sabit.
   - Admin politikası olan tablolara KISITLAYICI (restrictive) politika: `admin_requires_mfa` — `for all to authenticated using (not public.is_admin_user() or public.session_is_aal2()) with check (aynı)`. Tablolar: raw_listings, listings, properties, property_videos, video_orders, video_order_assets, support_messages (varsa admin erişimi). `agents` tablosuna EKLENMEZ (giriş akışı aal1'de `is_admin` okumalı). storage.objects'teki admin politikaları için aynı kısıtlayıcı politika yalnız admin bucket'larına (`property-videos`, `video-order-assets`) uygulanır.
   - Fonksiyonlar: `admin_get_threshold`, `admin_set_threshold`, `review_approve`, `review_reject` — admin kontrolünden sonra `aal2` değilse `{'ok': false, 'error': 'mfa_required'}` döner; diğer davranış birebir aynı.
6. **AC-6** Admin olmayan kullanıcılar ve servis rolü (scraper) etkilenmez: aal1 emlakçı kendi verisine aynen erişir; service_role RLS'i zaten atlar.

## Güvenlik (AC-S)
- **AC-S1** Uygulama katmanı atlanırsa bile (doğrudan REST, aal1 admin JWT) admin verisi okunamaz/yazılamaz (AC-5).
- **AC-S2** TOTP secret ve kod sunucu loglarına, hata mesajlarına yazılmaz.
- **AC-S3** `/mfa` başka kullanıcıların faktörlerini listeleyemez/değiştiremez (yalnız oturum sahibinin `mfa.listFactors()`).
- **AC-S4** Admin'in MFA'sı kurulmamışsa admin işlevleri tamamen kapalıdır (kurulum zorunlu; "sonra hatırlat" yok).

## Davranış Sözleşmesi
| Durum | Sonuç |
|---|---|
| Oturum yok, /admin/* | /login |
| Admin değil, /admin/* | 404 |
| Admin, aal1, /admin/* | /mfa |
| Admin, aal2, /admin/* | sayfa açılır |
| Admin, faktör yok, /mfa | QR + secret + kod formu |
| Admin, faktör var, aal1, /mfa | kod formu |
| Admin, aal2, /mfa | /admin/listings |
| Admin değil, /mfa | 404 |
| Yanlış kod | hata metni, aal1 kalır |
| aal1 admin JWT ile REST raw_listings | 0 satır / yazma reddi |
| aal1 admin RPC admin_set_threshold | {ok:false,error:'mfa_required'} |
| aal1 emlakçı (admin değil) kendi properties | aynen erişir |

## Test stratejisi
Vitest: requireAdmin (aal1/aal2/no-session/not-admin), admin layout yönlendirmeleri, login yönlendirmesi, /mfa sayfası ve server action'ları (Supabase MFA API mock). Veritabanı: migration canlıya uygulandıktan sonra salt-okunur, işlem içinde geri alınan (`begin … rollback`) rol/claim taklidiyle doğrulama. Tarayıcı: kullanıcı kendi telefonuyla kurulum + giriş.

## Codex migration incelemesi sonrası kararlar (2026-11-15)
- **Kapsam dışı (bilinçli):** `feed_listings`, `feed_filter_options`, `feed_unread_count` SECURITY DEFINER RPC'leri MFA'sız admin'e de kendi abone akışını döndürür. Bu yol her abonenin zaten gördüğü yayınlanmış ilanları verir; admin'e özel veri (raw_listings/ham mesaj, onay, askı, destek, ayarlar) içermez. MFA'nın amacı admin yetkilerini korumaktır; feed yeni yetki vermez.
- Politikalarda yardımcılar `(select public.is_admin_user())` / `(select public.session_is_aal2())` ile sarılır (satır başına yeniden hesaplanmasın).
- Migration ve rollback tek transaction (`begin; … commit;`); rollback tekrar çalıştırılabilir (idempotent).
- `review_approve` / `review_reject` açık `SECURITY INVOKER` ile yazılır.
- `is_admin_user()` admin'in kendi `agents` satırını `agents_self_select` ile görmesine dayanır; bu politika kaldırılırsa MFA kapısı açılır — canlı doğrulamada aal1 admin regresyon kontrolü yapılır.
