---
task_slug: agents-self-update-rls-yetki-yukseltme-acigi
jira_id: EML-18
threat_model: done
priority: critical
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 10
  integration: 80
  e2e: 10
affected_modules:
  - supabase/migrations/0001_init.sql
  - supabase/migrations/0004_fix_agents_self_update_rls.sql
  - web/src/app/agent/dashboard/page.tsx
  - web/src/lib/supabase/server.ts
---

# ATDD — agents-self-update-rls-yetki-yukseltme-acigi

## Jira Kaynağı
[EML-18 — \[P0\] agents_self_update RLS: yetki yükseltme açığını kapat](https://kuyusuzyusuf123.atlassian.net/browse/EML-18)
Açıklama (Jira'dan birebir): "supabase/migrations/0001_init.sql içindeki
agents_self_update policy'si kolon kısıtı/WITH CHECK içermiyor, authenticated
kullanıcı kendi satırında is_admin=true yapabiliyor görünüyor. Yeni migration
ile düzeltilmeli. Kaynak: obss_project/artifacts/proje-dokumantasyonu.md §10.1"

## Persona
Saldırgan: sisteme giriş yapmış ama admin olmayan herhangi bir kullanıcı
(bir emlak danışmanı/agent). Düzeltmeden fayda görenler: platform
yöneticileri, admin onay akışının güvenilirliği, diğer tüm kullanıcılar.
(Opus low alt-ajanı tarafından yanıtlandı: policy `authenticated` rolüne ve
`auth.uid() = id` koşuluna dayanıyor, giriş yapmış herkes kendi satırını
değiştirebiliyor.)

## Hedef (Neden)
`agents_self_update` RLS policy'si (`supabase/migrations/0001_init.sql:103-104`)
sadece `USING (id = auth.uid())` içeriyor, `WITH CHECK` yok — bu nedenle
authenticated bir kullanıcı kendi `agents` satırında `is_admin` kolonunu
`true` yapabiliyor (privilege escalation). Kod doğrulandı: `is_admin` kolonu
`0002_admin_review.sql:4`'te eklenmiş ve admin-only policy'lerin
(`raw_listings_admin_select/update`, `listings_admin_insert/select`) tek
yetki kontrolü bu kolona dayanıyor — açık, admin onay akışının tüm güvenliğini
çökertiyor.

## User Story
As a platform güvenliği sorumlusu
I want `agents_self_update` policy'sinin `is_admin` kolonunu self-update'e
karşı korumasını
So that hiçbir authenticated kullanıcı kendi kendini admin yapamasın ve admin
onay akışı (raw_listings/listings) güvenilir kalsın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] **AC-1 (happy path)** Given admin olmayan authenticated
   danışman A (`is_admin=false`), When kendi `agents` satırında
   `company_name`/`phone` gibi izinli alanları günceller, Then güncelleme
   başarılı olur (200/204) ve `is_admin` değişmeden `false` kalır.
2. [Critical] **AC-S1 (elevation of privilege — threat-model)** Given admin
   olmayan authenticated danışman A, When UPDATE isteğinde `is_admin=true`
   göndererek kendi satırını günceller, Then istek reddedilir (PostgREST
   403, Postgres hata kodu `42501`), DB'de A'nın `is_admin` değeri `false`
   kalır — sessiz yok sayma KABUL EDİLMEZ, açık ret olmalı.
3. [High] **AC-S2 (regression — başka satır)** Given authenticated danışman
   A, When başka bir kullanıcı B'nin `agents` satırını güncellemeye çalışır,
   Then 0 satır etkilenir (mevcut `USING (id = auth.uid())` koşulu bunu
   sağlıyor, bu AC regresyonu kilitler).
4. [High] **AC-2** Given authenticated danışman A, When `id` veya
   `created_at` gibi değiştirilmemesi gereken alanları güncellemeye
   çalışır, Then bu alanlar değişmez (ayrı bir doğrulama — kapsam
   `is_admin` ile sınırlı olsa da regresyon için not edilir).
5. [Medium] **AC-3 (admin'in kendi işlevi bozulmamalı)** Given `service_role`
   (admin paneli backend'i), When bir kullanıcının `is_admin` alanını
   değiştirir, Then işlem başarılı olur — düzeltme admin'in kendi
   yönetim akışını kırmamalı.

## Threat Model
Çağrıldı (`threat-model` skill'i) — STRIDE-lite'tan **Tampering** ve
**Elevation of Privilege** kategorileri uyguladı (istemciden gelen
`is_admin` alanına güveniliyor, yetki sunucuda/DB'de kontrol edilmiyordu).
AC-S1 ve AC-S2 yukarıdaki Acceptance Criteria'ya eklendi.
Spoofing/Repudiation/Info-disclosure/DoS kategorileri bu değişiklik
kapsamında uymadı (aşağıda Risks'te "Kabul edilen risk" olarak not edildi).
`authz-test` skill'i de çağrıldı — IDOR/RLS test matrisi üretti (aşağıda),
`test-copilot` adımına `extra_instructions` olarak aktarılacak; canlı sonda
bu aşamada atlandı (henüz iki gerçek test hesabı/ortamı kurulmadı) —
`plan`/`test-copilot` adımında, test ortamı hazır olduğunda çalıştırılacak.

### authz-test matrisi (test-copilot'a aktarılacak, her satır bir AC-S'e bağlı)
| # | Aktör | Beklenen | Bağlı AC |
|---|---|---|---|
| 1 | Sahibi (A, is_admin=false) | 200/204, is_admin false kalır | AC-1 |
| 2 | Sahibi (A), body'de is_admin=true | 403 + Postgres 42501, DB'de false kalır | AC-S1 |
| 3 | Başka kullanıcı (B), A'nın satırını güncellemeye çalışır | 0 satır etkilenir, A'nın verisi değişmez | AC-S2 |
| 4 | anon key (kimliksiz) | 401/403 — boş liste/0 satır değil, hata | AC-S2 (ek) |
| 5 | service_role (admin backend) | is_admin güncellemesi başarılı | AC-3 |

Not: Mock'lu authz testi KABUL EDİLMEZ — bu testler gerçek Supabase
test projesine/local'e karşı gerçek JWT ile atılmalı (bkz. `supabase-check`).

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path — izinli alan güncelleme | 200/204 + güncellenmiş satır `{id, company_name, phone, is_admin:false}` | `company_name`/`phone` DB'de güncellenir | "Kaydedildi" | AC-1 |
| 2 | is_admin=true ile UPDATE denemesi | PostgREST 403 + `{code:"42501", message:"permission denied for table agents"}` (veya RLS check violation mesajı) | DB'de hiçbir değişiklik olmaz (is_admin false kalır) | Genel "yetkiniz yok" hata mesajı | AC-S1 |
| 3 | Başka kullanıcının satırını güncelleme | 200 + 0 satır etkilendi (PostgREST: boş `data: []`, hata yok) | Hedef satır değişmez | UI'da "bulunamadı/güncellenemedi" | AC-S2 |
| 4 | anon key ile UPDATE denemesi | 200 + `data: []` (hata YOK — `id=auth.uid()` koşulu anon için `auth.uid()=null` olduğundan hiç satır eşleşmiyor; gerçek PostgREST/Postgres davranışı doğrulandı, `verify` adımında canlı test edildi) | Değişiklik olmaz | Giriş yapmamış kullanıcıya yönlendirme (client tarafı, `data` boş geldiği için) | AC-S2 (ek) |
| 7 | **Kısmi başarı**: aynı istekte izinli+izinsiz alan birlikte | Tüm istek reddedilir (403/42501) — kısmi uygulama YOK, `WITH CHECK` tüm satırı tek birim olarak değerlendirir | DB'de hiçbir alan değişmez | Hata, "değişiklik kaydedilmedi" | AC-S1 |
| 8 | Hiçbir şey yapılamadı ama hata yok | Bu durum bu görevde oluşmaz — her ret bir hata koduyla (403/42501) döner, sessiz no-op yasak | — | — | AC-S1 |

Kısmi başarı: Satır 7 — PostgREST/Postgres `WITH CHECK` tek bir UPDATE
ifadesini atomik değerlendirir, bu yüzden "bazı kolonlar geçti bazıları
geçmedi" durumu oluşmaz; tüm istek reddedilir.
Hiçbir şey yapılamadı ama hata yok: Satır 8 — oluşmaz, çünkü RLS reddi
her zaman 403/42501 ile döner (sessiz no-op yasak).
Boş sonuç ↔ hata ayrımı: Başka kullanıcının satırını güncellemeye çalışma
(satır 3) ile is_admin yükseltme denemesi (satır 2) FARKLI kodlarla
ayrılır: satır 3 "veri yok/0 satır" (var olan davranış, USING koşulu),
satır 2 ise açık bir yetki reddi (403/42501) OLMALI — bu ayrımın
korunması `code-copilot`'un fix'inde zorunlu, ikisi aynı "0 satır" sonucuna
düşerse açık kapanmamış sayılır.

## Test Strategy
Unit: 10% — client tarafı hata eşleme (supabase-js error code → UI mesajı).
Integration: 80% — gerçek Supabase test projesine/local'e karşı RLS testleri
(yukarıdaki authz-test matrisi, AC-S1/AC-S2/AC-1/AC-3).
E2E: 10% — `web/src/app/agent/dashboard` üzerinden profil güncelleme akışının
bozulmadığını doğrulayan bir senaryo.
(Opus low alt-ajanı tarafından yanıtlandı: RLS yalnızca gerçek Postgres'e
karşı test edilebilir, bu yüzden integration ağırlıklı.)

## Benchmark / Başarı Ölçütü
Coverage Target: 90% (değişen policy/migration için).
Performance Target: yok.
Memory: yok.
Görsel/UI kriteri: yok (bu bir backend/RLS düzeltmesi, dashboard UI'da
görünür bir değişiklik yok — sadece hata mesajı gösterimi, bkz. Davranış
Sözleşmesi satır 2/4).
Diğer ölçülebilir kriterler: Tüm AC/AC-S testleri gerçek Supabase'e karşı
yeşil olmalı; `supabase-check` migration'ın gerçek projeye uygulandığını
doğrulamalı.

## Kapsam Dışı
- Bu görevde SADECE `agents_self_update` policy'si (ve `agents` tablosundaki
  `is_admin` kolonunun korunması) düzeltilecek. Projedeki diğer tablolarda
  benzer RLS açığı olup olmadığının taranması bu görevin kapsamında DEĞİL —
  ayrı bir güvenlik görevi olarak Jira'ya not düşülmeli.
- Audit log / repudiation (kim ne zaman is_admin değiştirdi) bu görevde
  eklenmeyecek (bkz. Risks — kabul edilen risk).
- Mevcut üretim verisindeki `is_admin=true` satırlarının otomatik
  düzeltilmesi (backfill) bu görevin kapsamında DEĞİL — sadece salt-okunur
  bir denetim sorgusu önerilir, elle gözden geçirme kullanıcıya bırakılır.

## Etkilenen Dosyalar/Modüller (bilinen)
- `supabase/migrations/0001_init.sql` (mevcut `agents_self_update` policy,
  satır 103-104 — değiştirilmeyecek, yeni migration üstüne eklenecek)
- `supabase/migrations/0002_admin_review.sql` (referans — `is_admin` kolonunun
  eklendiği ve kullanıldığı yer)
- `supabase/migrations/0004_fix_agents_self_update_rls.sql` (YENİ — fix burada)
- `web/src/app/agent/dashboard/page.tsx` (profil güncelleme UI — regresyon
  kontrolü, is_admin alanı bu formda zaten olmamalı)
- `web/src/lib/supabase/server.ts` (Supabase client kurulumu — service_role
  kullanımı doğrulanacak)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökünün proje klasörüyle aynı olup
olmadığı kontrol edilmedi. Sonraki adımlarda arama `emlak-platform/` ile
sınırlı tutulmalı, kök dizinden sınırsız arama yapılmamalı.

## Rollback Beklentisi
Migration geri alınırsa (down/rollback) eski açık policy GERİ GETİRİLMEMELİ
— geri alma durumunda da en azından sıkı bir policy (örn. tüm UPDATE'leri
`service_role`'e bırakan) devrede kalmalı. Otomatik backfill/toplu
`is_admin=false` güncellemesi YAPILMAYACAK — hangi admin kaydının meşru
olduğunu yalnızca insan bilir, otomatik düzeltme gerçek admini kilitleyebilir.

## Risks
- Mevcut üretim verisinde açık daha önce istismar edilmiş olabilir —
  `SELECT id, email, updated_at FROM agents WHERE is_admin = true` ile
  salt-okunur bir denetim yapılmalı, sonuç kullanıcıya (insan onayına)
  sunulmalı.
- Policy fazla sıkı yazılırsa admin onay akışı (`raw_listings_admin_*`,
  `listings_admin_*`) veya meşru profil güncellemeleri bozulabilir —
  admin işlemlerinin `service_role` üzerinden çalıştığı varsayılıyor,
  `plan`/`code-copilot` adımında doğrulanmalı.
- Diğer tablolarda da yetki taşıyan kolonların (abonelik durumu vb.) aynı
  açığı taşıyor olma riski var — kapsam dışı bırakıldı ama not edildi.
- **Kabul edilen risk (threat-model, Repudiation):** `is_admin` değişikliği
  için audit log eklenmiyor. Gerekçe: P0 düzeltmesi küçük/hızlı kalmalı,
  audit log ayrı bir görev.

## Assumptions
- Admin paneli/onay akışı `service_role` anahtarıyla çalışıyor (kullanıcı
  client'ı ile `is_admin` değiştirilmiyor) — bu görevin fix'inin admin
  akışını kırmaması bu varsayıma dayanıyor, `plan` adımında doğrulanmalı.
- Yeni migration dosyası `0001_init.sql` değiştirilmeden, sıradaki numara
  (`0004_...sql`) ile eklenecek — uygulanmış migration geçmişi düzenlenmez.

## Unknowns
- `agents` tablosunda `is_admin` dışında başka yetki taşıyan bir kolon var
  mı (örn. ileride eklenecek rol kolonları) — `plan` adımında kod/şema
  taranarak netleştirilmeli.
- Fix yönteminin tam şekli (`WITH CHECK` + eski-değer karşılaştırması vs.
  BEFORE UPDATE trigger vs. kolon bazlı REVOKE) `plan` adımında kararlaştırılacak
  — bu atdd.md sadece "ne" olmalı diyor, "nasıl" `plan`'ın işi.

## Notion Mirror
Atlandı — uygun üst sayfa/workspace kullanıcıya henüz sorulmadı (6b adımı,
Hard Stop onayıyla birlikte sorulacak). Jira issue (EML-18) açıklaması bu
atdd.md'nin tam içeriğiyle güncellenecek (adım B), Notion ayna isteğe bağlı
kalır.

## Sorular ve Cevaplar (ham kayıt)
1. Persona: kim istismar edebilir, kim fayda görür? → Opus low alt-ajanı:
   admin olmayan authenticated kullanıcı istismar edebilir; adminler/
   platform/kullanıcılar fayda görür.
2. Happy path somut senaryo → Opus low alt-ajanı: danışman A kendi
   company_name/phone'unu günceller, is_admin false kalır.
3. is_admin=true denemesi ne olmalı → Opus low alt-ajanı: tamamen reddedilsin
   (403/42501), sessiz yok sayma olmasın.
4. Başka kullanıcının satırını güncelleme → Opus low alt-ajanı: mevcut
   USING koşulu zaten engelliyor, bu görevde regresyon testi olarak yer alır.
5. Davranış sözleşmesi (hata kodu) → Opus low alt-ajanı: PostgREST 403,
   Postgres 42501, supabase-js `{data:null, error:{code:'42501'}}`.
6. Başarı ölçütü → Opus low alt-ajanı: gerçek Supabase'e karşı otomatik RLS
   entegrasyon testleri, %100 policy coverage, supabase-check gate'i.
7. Kapsam dışı → Opus low alt-ajanı: sadece agents_self_update, diğer
   tablolar ayrı görev.
8. Bağımlılıklar → Opus low alt-ajanı (varsayım): admin paneli service_role
   kullanıyor, dashboard kullanıcı client'ıyla profil günceller.
9. Rollback/geçmiş veri → Opus low alt-ajanı: rollback'te eski açık policy
   geri gelmez, salt-okunur denetim sorgusu önerilir, otomatik backfill yok.
10. Kabul kriteri sahibi → Opus low alt-ajanı: otomatik testler zorunlu +
    kullanıcının denetim sorgusu çıktısını ve P0 migration'ı onaylaması gerekir.
11. Test stratejisi oranı → Opus low alt-ajanı: unit 10 / integration 80 /
    e2e 10 (RLS gerçek Postgres'e karşı test edilir).
12. Riskler/varsayımlar → Opus low alt-ajanı: geçmiş istismar riski, policy
    fazla sıkı olursa admin akışı bozulabilir, diğer kolonlar aynı açığı
    taşıyabilir.
