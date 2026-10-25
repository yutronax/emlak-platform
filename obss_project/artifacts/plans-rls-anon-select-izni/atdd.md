---
task_slug: plans-rls-anon-select-izni
jira_id: EML-68
threat_model: done
priority: medium
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 10
  integration: 70
  e2e: 20
affected_modules:
  - supabase/migrations/
notion_url: https://app.notion.com/p/4048b4f5446681f3bc92f868b8e1081c?pvs=204
---

# ATDD — plans-rls-anon-select-izni

## Jira Kaynağı
[EML-68 — plans-rls-anon-select-izni: plans tablosu RLS policy'sine anon SELECT izni ekle](https://kuyusuzyusuf123.atlassian.net/browse/EML-68)
User Story: Jira'da henüz tam detay yok (yeni görev), bu dosya tam içeriğiyle Jira'ya adım B'de aktarılacak.

## Persona
Anonim web ziyaretçisi (birincil). Authenticated kullanıcı (ikincil — deneyimi değişmemeli, regresyon korunur).

## Hedef (Neden)
`/pricing` sayfası herkese açık bir pazarlama sayfası; fiyat planları hassas veri değil. Şu anda RLS policy'si sadece `authenticated` role'üne SELECT izni verdiği için anonim ziyaretçi sayfayı boş görüyor — bu amaçlanan davranış değil.

## User Story
As an anonim ziyaretçi
I want `/pricing` sayfasını giriş yapmadan görebilmek
So that satın almaya karar vermeden önce fiyatları inceleyebilirim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given `plans` tablosu dolu (3 satır), When anon key ile `GET /rest/v1/plans?select=*` çağrılır, Then 200 döner ve satır sayısı service_role ile sayılan satır sayısına eşittir (boş liste PASS sayılmaz).
2. [Critical] Given aynı koşul, When authenticated kullanıcı aynı sorguyu çağırır, Then 200 + aynı satır sayısı döner (regresyon — mevcut davranış bozulmaz).
3. [High] Given migration uygulanmış, When anon key ile `plans`'a INSERT/UPDATE/DELETE denenir, Then işlem reddedilir (401/403/42501) VEYA 0 satır etkiler; her durumda service_role ile tekrar okunan veri değişmemiş olmalı. **(AC-S1 — threat-model)**
4. [High] Given migration uygulanmış, When `pg_policies` sorgulanır, Then `plans` için SELECT policy rolleri `{anon, authenticated}` içerir VE `anon` için `INSERT`/`UPDATE`/`DELETE`/`ALL` cmd'li başka policy yoktur. **(AC-S2 — threat-model)**
5. [Critical] Given migration yazılmadan önce, When `plans` tablosunun sütun listesi incelenir, Then hassas görünen bir sütun (örn. `cost_basis`, `internal_notes`, `margin`) yoksa geçilir; varsa bu adım bloke edilir ve kullanıcıya sorulur. **(AC-S3 — threat-model, statik/manuel kontrol)**
6. [Medium] Given `plans` tablosu boş (edge case), When anon `/pricing`'i açar, Then 200 + [] döner; mevcut UI'da boş-durum mesajı yoksa bu görevde eklenmez (kapsam dışı), sadece davranış not edilir.

## Threat Model
Çağrıldı — AC-S1/AC-S2/AC-S3 yukarıdaki Acceptance Criteria'ya eklendi. STRIDE-lite taraması: Tampering/Spoofing/Repudiation N/A (salt okuma, kimliksiz zaten amaçlanan); asıl risk Info Disclosure (ileride hassas sütun eklenirse `USING (true)` onu da ifşa eder — Risks'e not edildi) ve Elevation of Privilege (policy yanlışlıkla `FOR ALL` yazılırsa anon yazma kazanır — AC-S1/S2 bunu test eder). DoS riski (rate limit) bilinçli olarak kapsam dışı bırakıldı (Risks'e not edildi). Authz-test matrisi: `obss_project/artifacts/plans-rls-anon-select-izni/authz_test.md`.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path: anon /pricing'e girer, tablo dolu | 200 + `[{"id":"...","name":"Temel","price":99,...}, ...]` (3 satır) | Yok (salt okuma) | 3 plan kartı (ad + fiyat, mevcut UI alanları) | AC-1 |
| 2 | plans tablosu boş | 200 + `[]` | Yok | Mevcut UI'da boş-durum mesajı varsa o gösterilir; yoksa eklenmez (kapsam dışı) | AC-6 |
| 3 | Anon yazma denemesi (INSERT) | 401/403 (42501 RLS ihlali) | Tabloda değişiklik yok | Kullanıcıya görünmez (API seviyesi) | AC-S1 |
| 3b | Anon yazma denemesi (UPDATE/DELETE) | 200/204 dönebilir ama 0 satır etkilenir — kod yetmez, veri tekrar okunup doğrulanır | Tabloda değişiklik yok | Kullanıcıya görünmez | AC-S1 |
| 4 | Supabase erişilemez / ağ hatası | Fetch hatası / 5xx | Yok | Sayfanın mevcut hata durumu; beyaz ekran/çökme olmamalı | — (mevcut davranış, bu görevde değiştirilmiyor) |
| 7 | Kısmi başarı | N/A — tek bir SQL policy ifadesi atomik, ya uygulanır ya uygulanmaz | — | — | — |
| 8 | Hiçbir şey yapılamadı ama hata yok | Migration uygulanmamış/yanlış role yazılmış → anon'a hâlâ `200 + []` döner (RLS engeli boş liste olarak görünür, hata değil) | Yok | Boş sayfa (bugünkü hata, bu görevin çözdüğü şey) — bu yüzden AC-1 "boş liste PASS değil" kuralını içeriyor | AC-1 |

Kısmi başarı: N/A, tek atomik migration.
Hiçbir şey yapılamadı ama hata da yok: Migration sessizce uygulanmamışsa anon hâlâ `200 + []` görür (satır 8) — bu, AC-1'in "satır sayısı service_role sayımına eşit olmalı" kuralıyla yakalanır, sessiz başarısızlık test tarafından görünür kılınır.
Boş sonuç ↔ hata ayrımı: Supabase RLS engeli 403 değil, `200 + []` döner — API seviyesinde iki durum ayırt edilemez. Test, tablonun service_role ile önceden sayılan dolu durumuna göre anon sonucunu karşılaştırarak ayırt eder (bkz. AC-1, authz_test.md "iki kural").

## Test Strategy
Unit: 10% — migration SQL'inin `FOR SELECT` (değil `FOR ALL`) olduğuna dair statik kontrol.
Integration: 70% — gerçek Supabase'e karşı anon/authenticated okuma + anon yazma reddi (mock YASAK, authz-test kuralı).
E2E: 20% — anonim oturumda `/pricing` render testi (3 kart görünür).

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Performance Target: yok
Memory: yok
Görsel/UI kriteri: `/pricing` anonim oturumda 3 plan kartını (ad+fiyat) render etmeli — `vision-test` ile doğrulanabilir, UI kodu değişmiyor.
Diğer ölçülebilir kriterler: `pg_policies` sorgusu AC-S2'deki rol/cmd eşleşmesini sağlamalı.

## Kapsam Dışı
- Gerçek fiyatların girilmesi/değişmesi
- Plan içeriğinin (isim, özellik listesi) değişmesi
- Anon veya authenticated için INSERT/UPDATE/DELETE izni eklenmesi
- `/pricing` UI/tasarım değişiklikleri (boş-durum mesajı dahil)
- Ödeme/abonelik akışı
- Diğer tabloların RLS policy'leri
- Cache/ISR davranış değişiklikleri
- Rate limiting (DoS ekseni — bilinçli kapsam dışı, bkz. Risks)

## Etkilenen Dosyalar/Modüller (bilinen)
- `supabase/migrations/<timestamp>_plans_anon_select.sql` (yeni dosya)
- Mevcut `plans` RLS migration dosyası (tam yolu `plan` adımında `code-copilot` tarafından bulunacak — DROP POLICY IF EXISTS için gerekli)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökünün proje klasörüyle aynı olup olmadığı önceki görevlerde de doğrulanmamış olarak not edilmişti. Arama/grep bu görevde `emlak-platform/` klasörüyle sınırlı tutulmalı.

## Rollback Beklentisi
Migration sonrası bir sorun fark edilirse (örn. yanlışlıkla fazla izin verildiği anlaşılırsa): ters bir migration yazılır — yeni geniş policy `DROP` edilir, eski `authenticated`-only `SELECT` policy'si yeniden `CREATE` edilir. Acil durumda aynı SQL Supabase SQL editöründe elle çalıştırılabilir, ama sonra migration olarak da kaydedilmeli (migration geçmişi ile gerçek DB arasında fark oluşmamalı).

## Risks
- **Info disclosure (kabul edilmiş, izlenecek):** `USING (true)` satır bazlı bir politika, sütun kısıtlamıyor. `plans` tablosuna ileride hassas bir sütun (örn. `cost_basis`, `internal_notes`, `margin`) eklenirse bu policy onu da otomatik olarak anon'a açar. Önlem: bu uyarı not edildi; `plans`'a yeni sütun eklenecek bir görev açıldığında o görevin atdd.md'sinde "bu sütun herkese açık mı?" sorusu tekrar sorulmalı.
- **DoS/rate-limit (bilinçli kapsam dışı):** Anon'a SELECT açmak sınırsız sorgu riski taşır ama bu 3 satırlık public fiyat verisi, Supabase platform seviyesinde zaten rate limit var; bu görevde ek bir önlem alınmıyor.

## Assumptions
- `/pricing` sayfası istemci tarafında `anon` key kullanıyor (service_role değil) — doğrulanmadı, `plan` adımında kod okunarak teyit edilecek.
- Mevcut `authenticated`-only policy'nin adı migration yazılırken (`code-copilot`) tespit edilecek.

## Unknowns
- `plans` tablosunun tam sütun listesi henüz okunmadı — AC-S3 bu kontrolü `plan` adımına taşıyor.

## Sorular ve Cevaplar (ham kayıt)
1. Persona/rol değişikliği → (Opus low alt-ajanı tarafından yanıtlandı: anonim ziyaretçi birincil, authenticated deneyimi değişmez — amaç erişim genişletmek, daraltmak değil)
2. Happy path → (Opus low alt-ajanı: anon /pricing'i açar, anon key ile SELECT 200 döner, 3 plan kartı görünür, login istenmez)
3. Edge case — boş tablo → (Opus low alt-ajanı: 200+[], mevcut UI'da boş-durum mesajı yoksa eklenmez)
4. Edge case — yanlış policy (FOR ALL) riski → (Opus low alt-ajanı: policy açıkça FOR SELECT yazılmalı, negatif yazma testiyle yakalanır)
5. Davranış sözleşmesi tablosu → (Opus low alt-ajanı tarafından dolduruldu, yukarıdaki tabloya işlendi)
6. Başarı ölçütü → (Opus low alt-ajanı: 5 somut madde, hepsi otomatikleştirilebilir)
7. Kapsam dışı → (Opus low alt-ajanı: 7 madde, yukarıya işlendi)
8. Bağımlılıklar/dosyalar → (Opus low alt-ajanı: supabase/migrations/ altında yeni timestamp'li dosya, DROP+CREATE deseni)
9. Güvenlik/performans kısıtı → (Opus low alt-ajanı: risk düşük ama sütun kontrolü gerekli — AC-S3'e dönüştü)
10. Rollback → (Opus low alt-ajanı: ters migration ile DROP+yeniden CREATE)
11. Kabul kriteri sahibi → (Opus low alt-ajanı: otomatik testler + supabase-check gate + kullanıcının /pricing'i gizli pencerede tek gözle kontrolü)
12. Test stratejisi oranı → (Opus low alt-ajanı: unit 10/integration 70/e2e 20, RLS gerçek DB'ye karşı anlamlı)
13. Bilinen riskler/varsayımlar → (Opus low alt-ajanı: sütun ifşası riski, Risks bölümüne işlendi)
14. Threat-model STRIDE taraması → (bu skill tarafından, doğrudan: Info Disclosure ve Elevation of Privilege asıl eksenler, AC-S1/S2/S3'e döküldü)
