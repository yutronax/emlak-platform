---
task_slug: p0-vitrin-guven
jira_id: EML-90
threat_model: done
priority: high
coverage_target: 80
performance_target: null
memory_target: null
test_strategy:
  unit: 50
  integration: 30
  e2e: 20
affected_modules:
  - web/src/components/site-header.tsx
  - web/src/components/whatsapp-button.tsx
  - web/src/app/(marketing)/page.tsx
  - web/src/app/(marketing)/pricing/{page,buy-button}.tsx
  - web/src/app/(marketing)/signup/{page,actions}.ts(x)
  - web/src/app/(marketing)/login/page.tsx
  - web/src/app/(marketing)/sifremi-unuttum (yeni)
  - web/src/app/(marketing)/sifre-yenile (yeni)
  - web/src/app/agent/dashboard/page.tsx (trial yeniden deneme)
  - supabase/migrations/0019_* (yeni)
---

# ATDD — p0-vitrin-guven

## Jira Kaynağı
[EML-90 — p0-vitrin-guven: Tasarım raporu P0 düzeltmeleri](https://kuyusuzyusuf123.atlassian.net/browse/EML-90)
Kaynak: obss_project/artifacts/tasarim-elestirisi-2026-10-28/rapor.md (P0).

## Persona
Teknolojiyle arası zayıf, siteye çoğunlukla telefondan bakan emlakçı; WhatsApp'ını tanımadığı bir siteye emanet etmekten çekiniyor.

## Hedef (Neden)
Canlıya çıkmadan önce güveni ve dönüşümü öldüren P0 sorunlarını kapatmak. Özellikle "Kredi kartı istemeden deneyin" vaadi bugün yanlış: kodda hiçbir yer deneme aboneliği oluşturmuyor.

## User Story
As a emlakçı ziyaretçi
I want siteyi telefonda rahatça kullanmak, kart vermeden 14 gün denemek, WhatsApp'ımın güvende olup olmadığını öğrenmek ve şifremi unutursam kurtarabilmek
So that kaydolmaya ve denemeye güvenle karar vereyim.

## Acceptance Criteria
1. [Critical] AC-1 — Mobil header: 320/375/768/1280px'te header tek satır (yükseklik ≤64px), `document.scrollingElement.scrollWidth ≤ viewport`. Kısa logo + "Giriş" metin linki + küçük terracotta "Kayıt Ol", hepsi `whitespace-nowrap`. Hamburger yok.
2. [Critical] AC-2 — Kayıt: tek onay kutusu, varsayılan işaretsiz, metin "Kullanım Şartları'nı ve KVKK Aydınlatma Metni'ni okudum, kabul ediyorum." (iki metin yeni sekmede link). İşaretsiz → istemci ve sunucu reddeder, kutu altında "Devam etmek için şartları kabul etmeniz gerekiyor." (brick-700, `aria-describedby`). Hiçbir auth/agents kaydı oluşmaz.
3. [Critical] AC-3 — Onaylı kayıtta `agents.terms_accepted_at = now()` ve `agents.terms_version = '2026-10'` yazılır.
4. [Critical] AC-4 — Kayıt sonrası sunucu `start_trial()` RPC'sini çağırır: `subscriptions`'a `status='trialing'`, `current_period_end = now() + 14 gün`, en ucuz aktif plan (plan_id NOT NULL ise) ile 1 satır. Kullanıcıya "Hoş geldiniz, 14 günlük denemeniz başladı".
5. [Critical] AC-5 — Deneme kullanıcı başına bir kez: kullanıcının herhangi bir subscriptions satırı varsa `start_trial()` satır eklemez ve `false` döner. Eşzamanlı iki çağrı ikinci satır üretemez (DB unique kısıtı).
6. [High] AC-6 — Kısmi başarı: hesap oluştu ama trial yazılamadı (hata veya 0 satır) → kayıt yine başarılı yönlenir, `console.error('trial_create_failed', {agent_id, error_code|reason})`; dashboard ilk yüklemede `start_trial()`'ı tekrar dener; yine başarısızsa dashboard'da "Denemeniz başlatılamadı, destekle iletişime geçin" uyarısı + fiyat sayfası linki.
7. [Critical] AC-7 — Fiyat CTA durumları: girişsiz → "14 gün ücretsiz dene" → `/signup?plan=<slug>`; denemede → "Denemeniz sürüyor: X gün kaldı" + ikincil "Şimdi abone ol" (mevcut checkout); deneme bitmiş → "Denemeniz bitti" + birincil "Abone ol" (checkout); aktif aboneli → "Mevcut planınız" pasif buton. "Satın Al" metni hiçbir yerde kalmaz.
8. [High] AC-8 — Fiyat sayfası metni: "14 gün ücretsiz. Kredi kartı istemiyoruz. Deneme bitince hesabınız kendiliğinden ücretlendirilmez. Devam etmek isterseniz bir plan seçip ödeme yaparsınız. Ödeme yapmazsanız erişiminiz duraklar, verileriniz silinmez."
9. [High] AC-9 — Landing'de "Nasıl çalışır"ın hemen altında "WhatsApp'ım güvende mi?" bölümü, 4 madde (Bugün ortak hesap / Hesabınız bağlandığında — planlanan / Ban riski / KVKK). "garanti", "%100", "ban olmaz" ifadeleri yok; gelecek özellik "planlanan" diye etiketli.
10. [Medium] AC-10 — Giriş sayfası kopyası "WhatsApp'a attığınız ilanlara" → "takip ettiğiniz WhatsApp gruplarındaki ilanlara".
11. [Critical] AC-11 — `/sifremi-unuttum`: e-posta formu → `resetPasswordForEmail(email, {redirectTo: <site>/auth/callback?next=/sifre-yenile})`. Kayıtlı, kayıtsız ve rate-limit durumlarında AYNI mesaj: "Bu adrese kayıtlı bir hesap varsa sıfırlama bağlantısı gönderdik." + "E-posta gelmediyse spam klasörünü kontrol edin; 60 sn sonra tekrar gönderebilirsiniz." Gönder butonu 60 sn pasif. Geçersiz format → "Geçerli bir e-posta girin". Log `password_reset_requested {result: ok|rate_limited|error}` (e-posta yok).
12. [Critical] AC-12 — `/sifre-yenile`: geçerli recovery oturumunda yeni şifre + tekrar → `updateUser({password})` → "Şifreniz güncellendi" + `/agent/dashboard`. <8 karakter → "En az 8 karakter"; eşleşmezse "Şifreler eşleşmiyor". Oturum yok/süresi dolmuş → "Bağlantının süresi dolmuş" + "Yeni bağlantı iste" (`/sifremi-unuttum`). Hata log `password_update_failed {reason}`.
13. [Medium] AC-13 — Giriş sayfasında "Şifremi unuttum" linki.
14. [High] AC-14 — Destek butonu: mobilde 48px ikon (aria-label "WhatsApp destek"), terracotta-600 zemin + beyaz halka/gölge; lacivert footer üzerinde ≥3:1 kontrast. Body mobilde `padding-bottom: calc(72px + env(safe-area-inset-bottom))`. 375px'te landing/fiyat/giriş/kayıt sayfalarında butonun kutusu hiçbir CTA, fiyat veya form alanıyla kesişmez (sayfa en alta kaydırılmış hâlde de).
15. [Medium] AC-15 — Değişen sayfalarda axe ciddi/kritik ihlal 0; metin AA 4.5:1.
16. [Critical] AC-S1 (Tampering/Elevation) — `start_trial()` argüman almaz; hedef `auth.uid()`, `status='trialing'`, süre (14 gün) ve plan fonksiyon içinde sabittir. `POST /rest/v1/rpc/start_trial` gövdesine `{"days":365}`, `{"agent_id":"<B>"}` gönderilse bile ya 4xx döner ya yok sayılır; oluşan satırın `current_period_end - created_at` değeri 14 gün ±1 dk ve `agent_id = çağıran`. SECURITY DEFINER ise `set search_path = public` taşır.
17. [Critical] AC-S2 (Elevation) — Canlıda `has_function_privilege('anon','start_trial()','execute') = false` (migration `revoke ... from public` VE `from anon` içerir); anon key ile `POST /rpc/start_trial` → 401/42501.
18. [Critical] AC-S3 (Elevation) — Giriş yapmış A, PostgREST ile doğrudan `POST /rest/v1/subscriptions {agent_id:A, status:'trialing', current_period_end:'2099-01-01'}` veya kendi satırına `PATCH ... {current_period_end:'2099-01-01'}` / `{status:'active'}` gönderdiğinde istek reddedilir veya 0 satır etkiler; deneme/abonelik yalnız `start_trial()` ve ödeme webhook'u ile oluşur. (Mevcut subscriptions RLS'i plan adımında doğrulanır; açık bulunursa bu görevde kapatılır.)
19. [High] AC-S4 (Tampering) — Kayıtta `terms_accepted_at` ve `terms_version` istemciden alınmaz; form'a `terms_accepted_at=2000-01-01` eklense bile sunucu `now()` ve sabit `'2026-10'` yazar. Onay kutusu değeri `on`/`true` dışında bir şeyse kabul edilmez.
20. [Critical] AC-S5 (Spoofing/open redirect) — Reset `redirectTo` sunucu tarafında sabit site origin'inden üretilir (istemci Host/Origin başlığından değil). `/auth/callback?next=` yalnız `/` ile başlayan ve `//` ile başlamayan göreli yolları kabul eder; `next=https://evil.com`, `next=//evil.com`, `next=/\\evil.com` → `/agent/dashboard`'a yönlenir.
21. [High] AC-S6 (Info disclosure) — Hesap varlığı sızmaz: kayıtlı ve kayıtsız e-posta için reset action'ın dönüş değeri ve gösterilen metin birebir aynı (`{ok:true}`); Supabase hata mesajı kullanıcıya iletilmez.
22. [High] AC-S7 (Elevation) — `/sifre-yenile` action'ı oturum yoksa `updateUser` çağırmaz, "Bağlantının süresi dolmuş" döner; şifre alanı sunucuda da ≥8 karakter doğrulanır.
23. [Medium] AC-S8 (Info disclosure) — `trial_create_failed`, `password_reset_requested`, `password_update_failed`, `signup_terms_missing` loglarında e-posta, şifre, token, IP yok.

## Threat Model
Çağrıldı — AC-S1..AC-S8 eklendi. Varlıklar: abonelik/deneme durumu (ödeme hakkı), hesap kimliği (şifre), KVKK onay kaydı. Sınırlar: tarayıcı→server action, tarayıcı→PostgREST (anon/JWT), e-posta linki→/auth/callback. STRIDE: R — onay zamanı ve sürümü kaydediliyor (AC-3), ek audit gerekmez; D — reset için Supabase yerleşik rate limit'e güveniliyor (kabul edilen risk).
Ortam kısıtı: AC-S2/S3 PostgREST REST + `supabase db query --linked` ile çalıştırılabilir (bu oturumda kanıtlandı).

## Davranış Sözleşmesi
| # | Durum | Dönen / gösterilen | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Kayıt, onay işaretli | redirect `/agent/dashboard` (e-posta onayı açıksa onay ekranı) | auth user, agents (terms_accepted_at, terms_version), subscriptions trialing +14g | "Hoş geldiniz, 14 günlük denemeniz başladı" | AC-2,3,4 |
| 2 | Kayıt, onay işaretsiz | form hatası, action `{ok:false, error:'terms_required'}` | yok; `signup_terms_missing` log (sunucuya ulaşırsa) | "Devam etmek için şartları kabul etmeniz gerekiyor." | AC-2 |
| 3 | Kayıt ok, trial hata | redirect başarılı | `trial_create_failed {agent_id, error_code}`; dashboard tekrar dener | normal; ikinci hata → uyarı + fiyat linki | AC-6 |
| 4 | Trial zaten kullanılmış / abonelik var | RPC `false` | yeni satır yok, log yok | mevcut durum (kalan gün / "Abone ol") | AC-5 |
| 5a-d | Fiyat CTA (girişsiz/deneme/bitmiş/aktif) | AC-7'deki dört durum | yok | AC-7 | AC-7 |
| 6a-d | Şifre sıfırlama (kayıtlı/kayıtsız/rate limit) | aynı genel mesaj; format hatası ayrı | e-posta (yalnız kayıtlıda), log | AC-11 | AC-11 |
| 7a-c | Yeni şifre (geçerli/süresi dolmuş/zayıf-eşleşmeyen) | AC-12 | şifre değişir (yalnız 7a) | AC-12 | AC-12 |
| 8a | Reset 200 ama e-posta gelmedi | genel mesaj | tespit edilemez (bilinçli sınır) | spam/60 sn notu | AC-11 |
| 8b | Trial RPC hatasız, 0 satır ve abonelik yok | `false` | `trial_create_failed {reason:'no_row'}` | #3 gibi | AC-6 |
| 9 | Destek butonu 375px | — | body padding | kesişme yok, footer'da görünür | AC-14 |

Kısmi başarı: #3 — hesap kalır, trial dashboard'da tekrar denenir, ikinci hatada kullanıcı uyarılır.
Hiçbir şey yapılamadı ama hata yok: #8b (trial 0 satır) loglanır ve #3 akışına girer; #8a uygulama tarafından doğrulanamaz, kullanıcıya ne yapacağı söylenir.
Boş sonuç ↔ hata: `start_trial()` `false` = "zaten var" (log yok); hata = exception (log var); "0 satır ve abonelik yok" ayrı log reason'ı.
LLM çağrısı: yok.

## Test Strategy
Unit 50% — onay/şifre şemaları, CTA durum seçici, header/destek butonu render.
Integration 30% — signup action + start_trial, reset/update actions, dashboard trial tekrar denemesi.
E2E 20% — Playwright: 320/375/768/1280 header tek satır + scrollWidth; destek butonu boundingBox kesişim; kayıt + şifre sıfırlama akışları (mümkün olduğunca).

## Benchmark / Başarı Ölçütü
Coverage: değişen satırlarda %80.
Görsel/UI kriteri: AC-1, AC-14, AC-15 — verify'da vision-test + Playwright boundingBox, 4 viewport.

## Kapsam Dışı
Telefon/SMS girişi; gerçek plan adları/fiyatlar/destek numarası (kullanıcı kararı: henüz yok); hero mockup ve illüstrasyon değişimi; mevcut kullanıcılara geriye dönük deneme; deneme bitiş e-postası/hatırlatma; otomatik tahsilat; P1/P2 maddeleri; Faz 3 kişisel WhatsApp bağlantısı; ayrı pazarlama izni.

## Etkilenen Dosyalar/Modüller (bilinen)
Frontmatter `affected_modules`. `/auth/callback` route'unun varlığı plan adımında doğrulanmalı.

## Proje Ortamı Kısıtı
Aramalar `emlak-platform/` ile sınırlı.

## Rollback Beklentisi
Migration yalnız ekleme (RPC, 2 kolon, unique index) → down dosyası drop eder. Oluşmuş trial satırları silinmez. Canlıya uygulama dosya bazında, kullanıcı onayıyla.

## Risks
- `start_trial()` yeni bir yazma yolu; yanlış kurgulanırsa kullanıcı kendine sınırsız/uzun deneme açabilir (bkz. AC-S).
- Supabase e-posta onayı açıksa kayıt sonrası oturum yok → RPC kayıt anında `auth.uid()` göremez; trial dashboard'daki ilk girişte açılır (AC-6 yolu ana yol olur).
- Kabul edilen: reset için ek rate limit yok (Supabase yerleşik limiti); `agents_self_update` policy'si kullanıcının kendi `terms_accepted_at` kolonunu sonradan değiştirmesine izin verebilir — kayıt anındaki değer AC-S4 ile korunur, sonradan değiştirme bu görevde engellenmez (düşük değer).
- Landing hero "WhatsApp'ınızı bağlayın" diyor, ama güven bölümü "bugün ortak hesap, telefonunuza bağlanmıyoruz" diyecek — mesaj çelişkisi (Unknowns).

## Assumptions
- (varsayım) `plans` tablosunda "en ucuz aktif plan" belirlenebilir; plan_id kısıtı plan adımında doğrulanacak.
- (varsayım) Supabase rate limit yeterli, ek rate limit yazılmaz.
- (varsayım) Şifre kuralı kayıttakiyle aynı (≥8).

## Unknowns
- Hero metni ("WhatsApp'ınızı bağlayın") Faz 3 yokken düzeltilmeli mi? Bu görevde değiştirilmiyor; kullanıcıya sorulacak.
- Supabase projesinde e-posta onayı açık mı (trial'ın kayıtta mı dashboard'da mı açılacağını belirler) — plan adımında kontrol.
- Mevcut kayıtlı (trial'sız) kullanıcılar için backfill — kullanıcı kararı, ayrı migration önerisi.

## Sorular ve Cevaplar (ham kayıt)
Kullanıcıdan (AskUserQuestion): slug `p0-vitrin-guven` tek görev; gerçek plan/fiyat/numara yok → kapsam dışı; deneme 14 gün.
1-11: Opus low alt-ajanı tarafından yanıtlandı — trial kayıtta dar kapsamlı RPC ile, tek seferlik, kısmi başarıda hesap kalır ve dashboard tekrar dener; CTA dört durumu; tek KVKK kutusu + terms_accepted_at/version; güven bölümü 4 madde, temkinli dil; reset akışı hesap varlığını sızdırmaz; header sadeleştirme (hamburger yok); destek butonu terracotta + body padding; 4 viewport ölçütleri, %80 coverage, 50/20/30 → 50/30/20; kapsam dışı listesi; ekleme-only migration; PII'siz loglar + trial'sız ajan sorgusu.
Notion mirror: atlandı (Jira EML-90 tek görünür kaynak).
