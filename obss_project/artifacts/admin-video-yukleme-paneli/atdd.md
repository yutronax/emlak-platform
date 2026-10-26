---
task_slug: admin-video-yukleme-paneli
jira_id: EML-11
threat_model: done
priority: medium
coverage_target: 85
performance_target: "50MB dosya + INSERT 60s altında (bilgi amaçlı, CI gate değil)"
memory_target: null
test_strategy:
  unit: 40
  integration: 40
  e2e: 20
affected_modules:
  - web/src/app/admin/videos/page.tsx
  - web/src/app/admin/videos/actions.ts
  - supabase/migrations/
notion_url: https://app.notion.com/p/4048b4f54466814f82d9cd64d84b396e?pvs=204
---

# ATDD — admin-video-yukleme-paneli

## Jira Kaynağı
[EML-11 — Admin video onay ekranı](https://kuyusuzyusuf123.atlassian.net/browse/EML-11)
Jira açıklaması (mevcut): "web/src/app/admin/videos — ilanlara ait videoların incelenmesi."
Bu ATDD, placeholder'ı gerçek bir yükleme+yayınlama akışına dönüştürüyor.

## Persona
Platform admin'i (`agents.is_admin = true` olan bir agent kaydı). Ayrı bir "editör" rolü açılmıyor — şema sadece `is_admin`'i destekliyor, `requireAdmin()` deseni zaten `/admin/listings`'te kullanılıyor.

## Hedef (Neden)
Scraper ve admin-listings fazlarında toplanan ilanlara, editörde kurgulanmış tanıtım videosu bağlayıp yayınlamak — ilanları satış/pazarlama için görsel olarak güçlendirmek.

## User Story
As a platform admin
I want bir property'ye bitmiş bir tanıtım videosu yükleyip yayınlayabilmek
So that ilanlar görsel içerikle desteklenir

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given admin `/admin/videos`'a girer ve bir property seçer, When geçerli bir video dosyası (mp4/webm/mov, ≤50MB) yükler, Then `property-videos` bucket'ına `{property_id}/{uuid}.ext` yoluna yazılır VE `property_videos`'a `status=draft` ile bir satır INSERT edilir.
2. [Critical] Given taslak bir video, When admin "Yayınla" butonuna basar, Then `status=published`, `published_at=now()` olur (idempotent — zaten published ise değişiklik yok).
3. [High] Given admin geçersiz formatlı bir dosya (.exe/.txt) seçer, When yükleme denenir, Then client'ta engellenir VE server action'da da tekrar doğrulanır (`{ok:false, error:"INVALID_FORMAT"}`), hiçbir Storage/DB yazımı olmaz.
4. [High] Given dosya 50MB'ı aşıyor, When yükleme denenir, Then client'ta engellenir VE Storage 413 dönerse server action bunu `{ok:false, error:"FILE_TOO_LARGE"}`'a çevirir.
5. [High] Given property seçilmemiş veya geçersiz `property_id`, When yükleme denenir, Then `{ok:false, error:"INVALID_PROPERTY"}` döner, upload butonu zaten property seçilmeden disabled'dır.
6. [Critical] Given `is_admin=false` bir kullanıcı veya oturumsuz ziyaretçi, When `/admin/videos`'a girer, Then `requireAdmin()` ile redirect edilir (`/admin/listings` ile aynı desen: oturum yoksa `/login`, admin değilse ana sayfa), sayfa içeriği render edilmez.
7. [Critical] Given admin (`is_admin=true`), When kendi `agent_id`'sine ait OLMAYAN bir property'ye video eklemeye çalışır, Then işlem BAŞARILI olur (bu normal/beklenen davranış — admin'in amacı budur). **(AC-S3 — threat-model)**
8. [Critical] Given `is_admin=false` bir agent (sahip olmadığı bir property için), When `property_videos`'a INSERT/UPDATE veya Storage'a yazma dener, Then RLS tarafından reddedilir (401/42501), service_role ile tekrar okunan veri/Storage listesi değişmemiş olur. Given anon key, When `property_videos` SELECT edilir, Then `200+[]` döner (bu Supabase'in normal RLS-filtreleme davranışı — canlı doğrulandı, 401/403 DEĞİL); bu, test tarafından "veri yok" ile karıştırılmaması için service_role karşılaştırmasıyla kanıtlanır. **(AC-S2 — threat-model, 2026-10-25 canlı doğrulama sonrası düzeltildi)**
9. [Medium] Given `is_admin=false` bir agent, When **kendi** property'sine video ekler (mevcut owner davranışı), Then başarılı olur — bu regresyon testidir, mevcut owner policy'si bozulmamalı.
10. [Critical] Given admin bir property seçip yükleme yapar, When server action'a gönderilen `storage_path` seçili `property_id` öneki ile EŞLEŞMİYORSA (path manipülasyonu), Then server action reddeder (`{ok:false, error:"PATH_MISMATCH"}`), `property_videos`'a hiçbir satır yazılmaz. **(AC-S1 — threat-model)**
11. [High] Given bir video `published` durumda, When imzasız/public bucket URL'si ile doğrudan istek yapılır, Then 403/erişim reddi döner; signed URL ile istek yapılırsa 200 döner. **(AC-S4 — threat-model)**
12. [Medium] Given Storage'a yükleme başarılı ama ardından `property_videos` INSERT başarısız olursa (kısmi başarı), Then server action en iyi çaba ile yüklenen dosyayı Storage'dan siler (compensating action); silme de başarısız olursa path `console.error` ile loglanır (yetim dosya riski kabul edilen risk olarak not edilir).
13. [Medium] Given yükleme ağ hatasıyla tamamlanmadı, Then başarı mesajı SADECE server action gerçekten `ok:true` döndüğünde gösterilir — sessiz başarı YASAK.

## Threat Model
Çağrıldı — AC-S1/AC-S2/AC-S3/AC-S4 yukarıdaki Acceptance Criteria'ya eklendi. STRIDE-lite: Spoofing N/A (mevcut Supabase auth + `requireAdmin()` deseni değişmiyor). **Tampering** asıl risk — client'tan gelen `storage_path`'e güvenmek (AC-S1 ile kapatıldı: server action öneki doğrular). **Elevation** asıl risk — yeni admin RLS policy'si yanlışsa TÜM agent'lara yazma açılabilir (AC-S2 ile kapatıldı, authz-test zorunlu) VE admin'in gerçekten herhangi bir property'ye yazabilmesi gerektiği için owner-only bir policy yazılırsa özellik kırılır (AC-S3 pozitif AC olarak eklendi — "admin her zaman yazabilmeli" testi). Info disclosure — bucket private + signed URL (AC-S4). Repudiation ve DoS kabul edilmiş risk olarak Risks'e yazıldı (aşağıda).

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
**Not (plan.md'de düzeltildi, 2026-10-25):** Mevcut proje konvansiyonu (`/admin/listings/actions.ts`) `{ok,error}` nesnesi DEĞİL, throw-based (`Promise<void>` + `throw new Error("...")` + `redirect`). Aşağıdaki tablo bu gerçek konvansiyona göre güncellendi. Mimari de değişti: client ASLA `storage_path` göndermiyor, tek bir server action dosyayı FormData'dan alıp hem Storage'a yükleyip hem DB'ye yazıyor (bkz. plan.md madde 3) — bu AC-S1'i runtime-reddinden tasarım-garantisine çevirdi.

| 1 | Happy path: admin video yükler, geçerli property+dosya | `Promise<void>` (hata fırlatmaz) | Storage'a `{property_id}/{uuid}.ext` yazılır (path SUNUCUDA üretilir), `property_videos` INSERT (status=draft), `revalidatePath` | Sayfa yeniden render olur, video "Taslak" rozetiyle listede görünür | AC-1 |
| 2 | Admin "Yayınla"ya basar | `Promise<void>` | `status=published`, `published_at=now()` (idempotent — zaten published ise sessizce geçer) | Rozet "Yayında" | AC-2 |
| 3 | Geçersiz format | `throw new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz")` | Yok (Storage/DB yazımı olmaz) | Next.js error boundary (mevcut admin/listings deseniyle aynı, inline mesaj yok) | AC-3 |
| 4 | Boyut limiti aşımı (>50MB) | `throw new Error("Dosya 50MB sınırını aşıyor")` | Yok | Next.js error boundary | AC-4 |
| 5 | Geçersiz/seçilmemiş property | `throw new Error("Geçersiz mülk")` | Yok | Next.js error boundary | AC-5 |
| 6 | Admin olmayan erişimi | `redirect("/login")` (no-session) veya `redirect("/agent/dashboard")` (not-admin, `requireAdmin()`'in gerçek deseni — ana sayfa DEĞİL) | Yok | Sayfa render edilmez | AC-6 |
| 7 | Path manipülasyonu | N/A — mimari olarak imkansız (client path göndermiyor); path üretici fonksiyon HER ZAMAN `{property_id}/` önekiyle üretir, bu birim testiyle kanıtlanır | Yok | Görünmez | AC-S1 |
| 8 | RLS reddi: admin olmayan agent INSERT/UPDATE/Storage yazma | `401` + `code:"42501"` (gerçek RLS ihlali hatası, canlı doğrulandı) | Veri/Storage değişmez | Görünmez (API seviyesi) | AC-S2 |
| 8b | anon key SELECT | `200 + []` (Supabase'in NORMAL RLS-filtreleme davranışı, canlı doğrulandı — 401/403 DEĞİL) | Yok | — | AC-S2 |
| 9 | Kısmi başarı: Storage OK, DB INSERT FAIL | `throw new Error("Video kaydedilemedi, lütfen tekrar deneyin")` | Storage'daki dosya en iyi çaba ile silinir (`storage.remove`); silinemezse path `console.error` ile loglanır | Next.js error boundary | AC-12 |
| 10 | Hiçbir şey yapılamadı ama hata yok (ağ kesildi) | Upload promise reject/error — INSERT asla çağrılmaz | Yok | "Yükleme başarısız" (mevcut Next.js hata gösterimi) | AC-13 |

Kısmi başarı: satır 9 — Storage'da yetim dosya kalma riski kabul edilmiş risk (periyodik temizlik bu görevin kapsamında değil), ama en iyi çaba temizliği + loglama zorunlu.
Hiçbir şey yapılamadı ama hata da yok: satır 10 — upload sonucu kontrol edilmeden INSERT çağrılmaz, sessiz başarı mesajı asla gösterilmez.
Boş sonuç ↔ hata ayrımı: anon'un `property_videos` SELECT'i `200+[]` döner — bu Supabase'in NORMAL davranışı (canlı doğrulandı, 2026-10-25), hata DEĞİL. Test, bunu "veri yok" ile karıştırmamak için önce service_role ile satırın var olduğunu kanıtlar (satır 8b). Yazma denemeleri (INSERT/UPDATE) ise her zaman gerçek bir RLS-ihlali hatası (401/42501) fırlatır — SELECT ile WRITE'ın bu asimetrisi Supabase/PostgREST'in kendi davranışıdır, bu görevde "düzeltilecek" bir şey değildir.

## Test Strategy
Unit: 40% — validasyon (format/boyut/path öneki), action hata eşlemeleri, kısmi-başarı compensating-delete davranışı.
Integration: 40% — gerçek Supabase'e karşı admin/admin-olmayan/anon için RLS (DB + `storage.objects`), INSERT, publish (bkz. authz_test.md).
E2E: 20% — admin happy path (küçük test videosu) + admin olmayanın redirect edilmesi (Playwright).

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Performance Target: 50MB dosya + INSERT yerel/staging ağda 60s altında (bilgi amaçlı).
Diğer ölçülebilir kriterler: Davranış Sözleşmesi'nin 10 satırının tamamı testle kapsanmalı; admin olmayan agent'ın canlı RLS probe'u 0 başarı vermeli (authz_test.md).
Görsel/UI kriteri: Admin happy path sonrası video rozetinin ("Taslak"→"Yayında") doğru güncellendiği — `vision-test` ile `verify` adımında kontrol edilecek.

## Kapsam Dışı
- Video transcode/sıkıştırma, otomatik thumbnail üretimi.
- Agent'ın kendi videosunu yüklemesi için YENİ bir UI (owner policy'leri zaten var, dokunulmuyor, UI eklenmiyor).
- Video silme, değiştirme, unpublish.
- Resumable/TUS ile 50MB üstü yükleme, yükleme ilerleme çubuğu.
- Public ilan sayfasında video oynatıcı entegrasyonu.
- Ayrı bir "editör" rolü.
- Toplu (çoklu dosya) yükleme.
- Video metadata'sı (süre, çözünürlük).
- Kim yükledi/yayınladı audit log'u (aşağıda kabul edilmiş risk).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/admin/videos/page.tsx` (yeniden yazılacak — server component, property seçici + video listesi)
- `web/src/app/admin/videos/actions.ts` (yeni — `createVideoRecord`, `publishVideo` server action'ları)
- Yeni client component (örn. `VideoUploadForm.tsx` — dosya seçimi, client-side validasyon, Storage upload)
- `supabase/migrations/` — yeni migration: (a) `property_videos` için admin SELECT/INSERT/UPDATE policy'leri, (b) `property-videos` Storage bucket'ı (idempotent oluşturma, `file_size_limit`, `allowed_mime_types`) + `storage.objects` üzerinde admin policy'leri.
- `web/src/lib/auth/requireAdmin.ts` — okunur, değiştirilmez.

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — önceki görevlerde de doğrulanmamış olarak not edilmişti. Arama/grep bu görevde `emlak-platform/` klasörüyle sınırlı tutulmalı.

## Rollback Beklentisi
Bu sürümde UI'dan geri alma (unpublish/sil) YOK — kapsam dışı. Yanlışlıkla yayınlanan bir video için geçici çözüm: DB'den manuel olarak `status=draft` yapmak. Migration rollback'i (RLS policy'leri + bucket) için ters bir migration `supabase/rollback/` dizinine ayrıca yazılacak (bkz. `plans-rls-anon-select-izni` görevindeki emsal desen).

## Risks
- **Kabul edilmiş risk (Repudiation):** `property_videos` tablosunda "kim yükledi/yayınladı" audit alanı yok. Bu sürümde eklenmiyor — tek admin kullanıcısı olduğu varsayımıyla düşük öncelik.
- **Kabul edilmiş risk (DoS, düşük):** Aynı admin sınırsız sayıda video yükleyebilir (dosya boyutu sınırlı ama sayı sınırsız). Tek-admin sistemde düşük risk, bu görevde ek önlem alınmıyor.
- **Risk:** Yetim Storage dosyası — kısmi başarı durumunda compensating delete başarısız olursa dosya Storage'da kalır, periyodik temizlik bu görevin kapsamında değil (sadece loglanır).
- **Risk:** Yeni admin RLS policy'si yanlış yazılırsa TÜM agent'lara yazma yetkisi açılabilir — AC-S2/authz-test ile test edilmeden commit edilmemeli.

## Assumptions
- `requireAdmin()` admin olmayanı `/admin/listings`'teki gibi redirect ediyor (doğrulanacak, `plan` adımında kod okunarak teyit edilecek).
- `agents.id = auth.uid()` eşlemesi geçerli — RLS ifadeleri buna dayanıyor.
- Supabase Storage'ın varsayılan/ücretsiz plan dosya limiti 50MB (doğrulanmadı, `plan` adımında Supabase Dashboard'dan teyit edilecek).

## Unknowns
- `property-videos` Storage bucket'ının zaten var olup olmadığı bilinmiyor — muhtemelen yok, migration'a idempotent bucket oluşturma eklenecek.
- `property_videos.storage_path` üzerinde unique constraint olup olmadığı bilinmiyor (`plan` adımında kontrol edilecek).

## Sorular ve Cevaplar (ham kayıt)
1. Persona → (Opus low alt-ajanı: platform admin'i, `is_admin=true`, ayrı editör rolü yok)
2. Hedef/neden → (Opus low alt-ajanı: ilanlara tanıtım videosu bağlamak, satış/pazarlama)
3. Happy path → (Opus low alt-ajanı: property seç → dosya seç → Storage upload → server action INSERT draft → yayınla butonu)
4. Boyut limiti → (Opus low alt-ajanı: 50MB, Supabase ücretsiz plan varsayılan limiti)
5. Çoklu video/silme → (Opus low alt-ajanı: çoklu video destekleniyor, silme kapsam dışı)
6. Davranış sözleşmesi tablosu → (Opus low alt-ajanı tarafından dolduruldu, yukarıya işlendi)
7. Başarı ölçütü → (Opus low alt-ajanı: coverage %85, RLS probe 0 başarı, 60s performans notu)
8. Kapsam dışı → (Opus low alt-ajanı: 8 madde, yukarıya işlendi)
9. Bağımlılıklar/dosyalar → (Opus low alt-ajanı: page.tsx, actions.ts, yeni migration — RLS+bucket)
10. Güvenlik/performans kısıtı → (Opus low alt-ajanı: bucket private+signed URL, path öneki doğrulaması — AC-S1/S4'e dönüştü)
11. Rollback → (Opus low alt-ajanı: UI'dan geri alma yok, DB'den manuel draft'a döndürme)
12. Kabul kriteri sahibi → (Opus low alt-ajanı: otomatik testler + kullanıcının staging'de manuel smoke kontrolü)
13. Test stratejisi oranı → (Opus low alt-ajanı: unit 40/integration 40/e2e 20)
14. Bilinen riskler/varsayımlar → (Opus low alt-ajanı: bucket/limit/unique-constraint Unknown'lara işlendi)
15. Threat-model STRIDE taraması → (bu skill tarafından, doğrudan: Tampering ve Elevation asıl eksenler, AC-S1/S2/S3/S4'e döküldü)
16. Authz-test matrisi → (bu skill tarafından, doğrudan: 11 satırlık matris, authz_test.md'ye yazıldı)
