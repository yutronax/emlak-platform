# Code diff — p0-vitrin-guven (green)
Jira: EML-93 (backend), EML-94 (frontend). Orkestratör doğrulaması: tsc 0 hata. vitest tam takım: 622/626 bir koşumda (4 düşen = canlı DB'ye bağlanan admin-video-rls + agents-self-update-rls testlerinde 5-10 sn timeout); bu iki dosya tek başına 16/16 geçti → paralel yükte ağ zaman aşımı, bu değişiklikle ilgisiz. Alt-ajan iki tam koşumda 626/626 raporladı.

## Backend
- supabase/migrations/0019_trial_terms.sql (+.down) — agents.{trial_started_at, terms_accepted_at, terms_version}; mevcut kullanıcılar için `trial_started_at = created_at` backfill (kullanıcı kararı); `start_trial()` security definer + search_path, argümansız, 14 gün, en ucuz plan; revoke public + anon, grant authenticated. UYGULANMADI.
- web/src/lib/auth/ensureAgentRow.ts — terms sunucu değerleri, ardından `start_trial` RPC; hata loglanır, throw yok.

## Frontend
- cta-state.ts (yeni, `none` durumu eklendi: girişli + aboneliksiz → "Abone ol")
- pricing page + buy-button (dört durum, "Satın Al" kaldırıldı), landing güven bölümü, site-header, whatsapp-button, marketing layout padding
- signup (KVKK kutusu + sunucu reddi + terms_version), login (kopya, link, terms metadata)
- sifremi-unuttum, sifre-yenile, auth/callback (yeni)
- dashboard trial yeniden deneme + uyarı
- .env.example: NEXT_PUBLIC_SITE_URL
- Test düzeltmeleri: signup actions (4. argüman), sifremi-unuttum page (deterministik fake timer)

## Açık notlar (red-team için)
- Fiyat sayfası iptal/past_due aboneliklere de "Denemeniz bitti" gösteriyor.
- `?plan=` kayıttan sonra kullanılmıyor.
- Şifre güncellenince "Şifreniz güncellendi" mesajı yok (AC-12 istiyor; test düz redirect bekliyor).
- E-posta onaylı yolda terms_accepted_at ilk giriş zamanı oluyor (kayıt zamanı değil).
- signup/login'deki ensureAgentRow try/catch artık fiilen ölü (ensureAgentRow throw etmiyor).
- Görsel ölçümler (320-1280 header, destek butonu kesişimi, kontrast, axe) yapılmadı → verify.
