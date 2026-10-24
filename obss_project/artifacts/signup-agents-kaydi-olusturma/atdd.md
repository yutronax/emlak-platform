---
task_slug: signup-agents-kaydi-olusturma
jira_id: EML-42
threat_model: done
priority: medium
coverage_target: 80
performance_target: null
memory_target: null
test_strategy:
  unit: 60
  integration: 30
  e2e: 10
affected_modules:
  - web/src/app/signup/page.tsx (yeni)
  - web/src/app/signup/actions.ts (yeni)
  - web/src/lib/auth/ensureAgentRow.ts (yeni)
  - web/src/app/login/actions.ts (değiştir)
  - supabase/migrations/0009_agents_self_insert.sql (yeni)
---

# ATDD — signup-agents-kaydi-olusturma

## Jira Kaynağı
[EML-42 — [P1] Kayıt (signup) akışı + agents satırı otomatik oluşturma (P1-12)](https://kuyusuzyusuf123.atlassian.net/browse/EML-42)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-12, `emlak-platform-customer`
session önerisi. Kod/şema incelemesiyle doğrulandı: `/signup` sayfası hiç
yok, `agents` tablosunda hiç INSERT policy'si yok.

## Persona
Platforma yeni katılmak isteyen bir emlakçı (henüz hiçbir hesabı yok).

## Hedef (Neden)
Kayıt olan bir kullanıcının `agents` satırı hiç oluşmuyor — bu yüzden
`subscriptions`/`properties` gibi `agent_id` FK'li hiçbir tabloyla
etkileşemiyor, platform fiilen kullanılamaz durumda.

## User Story
As a yeni bir emlakçı
I want e-posta+şifre+şirket adımla kayıt olmayı ve kendime ait bir agent
  kaydının otomatik oluşmasını
So that kayıt olduktan (ve varsa e-postamı doğruladıktan) sonra platformu
  gerçekten kullanabileyim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given geçerli e-posta/şifre/company_name, When `/signup`
   formu gönderilir, Then `supabase.auth.signUp({email,password})`
   çağrılır; BAŞARILIYSA (hata yoksa) kullanıcıya genel bir mesaj
   gösterilir: "Kayıt alındı; hesabınız varsa e-postanızı kontrol edin
   veya giriş yapın."
2. [Critical] Given `signUp()` SESSION DÖNDÜRÜR (email confirmation
   kapalı), When kayıt tamamlanır, Then `ensureAgentRow()` ÇAĞRILIR
   (cookie-tabanlı client ile, `agents_self_insert` RLS policy'si
   kullanılarak) ve `/agent/dashboard`'a yönlendirilir.
3. [Critical] Given `signUp()` SESSION DÖNDÜRMEZ (email confirmation
   açık), When kayıt tamamlanır, Then "e-postanızı kontrol edin" mesajı
   gösterilir, `ensureAgentRow()` BU AŞAMADA ÇAĞRILMAZ (oturum yok,
   RLS insert'i reddeder).
4. [Critical] Given bir kullanıcı giriş yapıyor (`login` action) VE
   `agents` tablosunda kendi satırı HENÜZ YOK (ilk giriş, email
   confirmation sonrası), When giriş başarılı olur, Then
   `ensureAgentRow()` login akışında da çağrılır, agent satırı bu anda
   oluşturulur.
5. [High] Given bir kullanıcının ZATEN bir `agents` satırı var, When
   `ensureAgentRow()` tekrar çağrılır (örn. ikinci giriş), Then
   İKİNCİ bir satır oluşturulmaz, hata fırlatılmaz (idempotent — `id`
   PK çakışması `23505` sessizce yutulur, zaten var olan kabul edilir).
6. [High] Given `company_name` boş veya sadece boşluk, When form
   gönderilir, Then `signUp()` HİÇ ÇAĞRILMAZ, "Şirket adı gerekli" gibi
   bir alan hatası gösterilir (client veya server-side validasyon).
7. [Medium] Given var olan bir e-postayla tekrar kayıt denemesi, When
   form gönderilir, Then kullanıcıya AC-1'deki İLE AYNI genel mesaj
   gösterilir (email enumeration önlenir — "zaten kayıtlı" gibi
   e-posta varlığını doğrulayan bir mesaj GÖSTERİLMEZ).

## Threat Model
Çağrıldı — STRIDE-lite: Tampering/Elevation en kritik kategori.
- **AC-S1 (Tampering/Elevation):** Given/When: `ensureAgentRow()`'un
  gönderdiği INSERT payload'ı SADECE `{id: auth.uid(), company_name}`
  içerir — `is_admin` alanı HİÇBİR ZAMAN formdan/istemciden okunmaz veya
  payload'a eklenmez. Then: yeni eklenen `agents_self_insert` RLS
  policy'si de `with check (id = auth.uid() and is_admin = false)` ile
  bunu DB seviyesinde de kilitler — doğrudan bir REST isteğiyle
  `is_admin:true` göndermeye çalışan biri RLS reddiyle karşılanır.
- **AC-S2 (Elevation/IDOR):** Given bir authenticated kullanıcı, When
  `agents` tablosuna BAŞKA bir `id` (kendi `auth.uid()`'ı değil) ile
  INSERT denenirse, Then RLS reddeder (`agents_self_insert` policy'si
  `id = auth.uid()` şartını taşır).
- **AC-S3 (Info disclosure — email enumeration):** Given/When: var olan
  bir e-postayla kayıt denemesi (AC-7) ile YENİ bir e-postayla kayıt
  arasında kullanıcıya gösterilen mesaj/yönlendirme AYNIDIR — e-postanın
  sistemde var olup olmadığı istemciye SIZDIRILMAZ.
- **AC-S4 (Reliability/race):** Given `ensureAgentRow()`'un INSERT'i
  `23505` (unique violation — PK çakışması, eşzamanlı iki çağrı) hatası
  alırsa, Then bu hata YUTULUR (zaten var olan satır kabul edilir),
  500/crash OLUŞMAZ.

Bu bir yetkilendirme/RLS değişikliği olduğu için `authz-test` skill'i de
`verify` adımında çağrılacak — self-insert/cross-id-insert/is_admin
bypass denemeleri gerçek Supabase'e karşı canlı prob edilecek.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Geçerli kayıt, session var | Redirect /agent/dashboard | agents satırı oluşur | Dashboard | AC-2 |
| 2 | Geçerli kayıt, session yok (email confirm) | Mesaj (hata yok) | agents satırı HENÜZ oluşmaz | "e-postanızı kontrol edin" | AC-3 |
| 3 | İlk giriş, agents satırı yok | Redirect (mevcut davranış) | agents satırı BU ANDA oluşur | Normal giriş akışı | AC-4 |
| 4 | Tekrar giriş, agents satırı zaten var | Redirect (mevcut davranış) | Hiçbir yeni satır, hata yok | Normal giriş akışı | AC-5 |
| 5 | company_name boş | signUp() çağrılmaz | Yok | Alan hatası | AC-6 |
| 6 | Var olan email ile kayıt | AC-1 ile AYNI mesaj | Yok (yeni kullanıcı/satır yok) | AC-1'deki genel mesaj | AC-7, AC-S3 |
| 7 | is_admin:true denemesi (doğrudan REST) | RLS reddi | Yok | — | AC-S1 |
| 8 | Başkasının id'siyle insert denemesi | RLS reddi | Yok | — | AC-S2 |
| 9 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal (redirect, mesaj, hata) açık bir sonuç üretir | — | — | Tüm AC'ler |

Kısmi başarı: `signUp()` başarılı ama `ensureAgentRow()` başarısız olursa
(gerçek bir DB hatası, 23505 dışında) — bu durum AC-4/5'in dışında,
kullanıcı giriş yapabilir ama agent satırı yok kalır; bir SONRAKİ
girişte `ensureAgentRow()` tekrar denenir (idempotent tasarım bunu
kendiliğinden telafi eder, ek bir retry mekanizması gerekmez).
Boş sonuç ↔ hata ayrımı: `agents` satırı yoksa (ilk giriş) ile gerçek bir
DB hatası AYRI ele alınır — ilk durumda insert denenir, ikincisinde
console.error + genel hata mesajı.

## Test Strategy
Unit: 60% — form validasyonu (company_name boş), mesaj eşitliği (AC-1/AC-7
aynı mesaj), `ensureAgentRow()`'un idempotency mantığı (mock'lu 23505
senaryosu).
Integration: 30% — gerçek Supabase'e karşı RLS testleri (authz-test
felsefesiyle): self-insert başarılı, cross-id insert reddedilir,
`is_admin:true` insert reddedilir, idempotent re-insert.
E2E: 10% — signup → mesaj/redirect akışının gerçek tarayıcı smoke testi
(opsiyonel, zaman izin verirse).

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen dosyalarda satır/dal %80.
Performance Target: Yok.
Görsel/UI kriteri: Yok (basit form sayfası, vision-test tetiklenmiyor —
atdd.md'de Opus alt-ajanına sorulmadı ama sayfanın basitliği EML-33/
EML-39'daki gerekçeyle aynı, dar tutuldu).

## Kapsam Dışı
- Email şablonu özelleştirme, şifre sıfırlama akışı, sosyal login —
  her biri ayrı bir auth akışı ve ayrı bir threat-model gerektirir.
- `login/actions.ts`'teki `redirect("/admin/listings")` hedefinin
  (muhtemelen yanlış/eski, normal bir agent admin paneline gitmemeli)
  düzeltilmesi — AYRI bir bug, bu görevin kapsamı sadece signup'ın
  eksiksiz çalışması için gereken `ensureAgentRow()` entegrasyonu.
  Risks'e not edildi.

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/signup/page.tsx` (yeni)
- `web/src/app/signup/actions.ts` (yeni)
- `web/src/app/signup/page.test.tsx`, `actions.test.ts` (yeni)
- `web/src/lib/auth/ensureAgentRow.ts` (yeni)
- `web/src/lib/auth/ensureAgentRow.test.ts` (yeni)
- `web/src/app/login/actions.ts` (değiştir — `ensureAgentRow()` çağrısı eklenir)
- `supabase/migrations/0009_agents_self_insert.sql` (yeni)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı).

## Rollback Beklentisi
Geriye dönük uyumsuz değil — yeni bir INSERT policy ve yeni bir sayfa
ekleniyor, mevcut hiçbir davranış değişmiyor (login'in kendi redirect
hedefi dahil, SADECE `ensureAgentRow()` çağrısı eklenir).

## Risks
- `login/actions.ts`'teki `redirect("/admin/listings")` hedefi muhtemelen
  yanlış (normal agent admin paneline gitmemeli) — bu görevde
  DÜZELTİLMİYOR, ayrı bir bug olarak not edildi (bkz. Kapsam Dışı).
- Supabase projesinin email confirmation ayarı (Dashboard'da "Confirm
  email" açık/kapalı) kod'dan bilinmiyor — hem açık hem kapalı senaryo
  için tasarım yapıldı (AC-2/AC-3), gerçek ayar `verify` adımında canlı
  doğrulanmalı.

## Assumptions
- Email enumeration önleme mesajı ("Kayıt alındı; hesabınız varsa
  e-postanızı kontrol edin veya giriş yapın") Opus alt-ajanı tarafından
  önerildi — kullanıcıya ayrıca onaylatılmadı.
- `company_name` için 2-100 karakter sınırı Opus alt-ajanı önerisi.

## Unknowns
- Supabase projesinin gerçek email confirmation ayarı (Risks'te not edildi,
  `verify` adımında `supabase-check` ile canlı doğrulanacak).

## Sorular ve Cevaplar (ham kayıt)
1. Agent satırı ne zaman/nasıl → signUp() sonrası hemen, self-insert RLS policy, service-role YOK (Opus alt-ajanı tarafından yanıtlandı)
2. Email confirmation açık senaryo → ilk girişte ensureAgentRow() (Opus alt-ajanı tarafından yanıtlandı)
3. RLS policy mi service-role mi → self-insert policy (Opus alt-ajanı tarafından yanıtlandı)
4. is_admin istemciden okunmaz → evet + policy'de de kilitlenir (Opus alt-ajanı tarafından yanıtlandı)
5. company_name formda → evet, 2-100 karakter (Opus alt-ajanı tarafından yanıtlandı)
6. Var olan email → genel mesaj, enumeration önlenir (Opus alt-ajanı tarafından yanıtlandı)
7. Email confirmation mesajı → kapsamda, iki dal (Opus alt-ajanı tarafından yanıtlandı)
8. Threat-model AC-S'ler → S1 is_admin, S2 cross-id, S3 enumeration, S4 idempotency (Opus alt-ajanı tarafından yanıtlandı)
9. Test oranı → unit 60/integration 30/e2e 10 (Opus alt-ajanı tarafından yanıtlandı)
10. Kapsam dışı → email şablonu/şifre sıfırlama/sosyal login (Opus alt-ajanı tarafından yanıtlandı)
11. login redirect hedefi → değiştirilmez, ayrı bug notu (Opus alt-ajanı tarafından yanıtlandı)
