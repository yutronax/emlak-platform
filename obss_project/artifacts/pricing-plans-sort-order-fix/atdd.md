---
task_slug: pricing-plans-sort-order-fix
jira_id: EML-19
threat_model: not-applicable
priority: critical
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 20
  integration: 60
  e2e: 20
affected_modules:
  - supabase/migrations/0004_plans_sort_order.sql
  - web/src/test/fake-supabase.ts
  - web/src/app/pricing/page.tsx (sadece referans, değişmeyecek)
notion_url: https://app.notion.com/p/3fd8b4f54466816a877cc0c1fce78965?pvs=204
---

# ATDD — pricing-plans-sort-order-fix

## Jira Kaynağı
[EML-19 — [P0] /pricing: plans.sort_order kolon hatasını düzelt](https://kuyusuzyusuf123.atlassian.net/browse/EML-19)
Açıklama (Jira'dan birebir): "web/src/app/pricing/page.tsx plans tablosundan
olmayan sort_order kolonunu select+order ediyor, PostgREST hatası veriyor,
sayfa sürekli 'Planlar yüklenemedi' gösteriyor. Ya kolonu migration ile ekle
ya da sayfadan kaldır. Kaynak: proje-dokumantasyonu.md §9.1"
User Story/AC Jira'da ayrıca verilmemiş (Görev tipi issue, serbest metin açıklama).

## Persona
Giriş yapmış (authenticated) emlakçı/agent kullanıcı; abonelik planı seçmek
için /pricing sayfasını ziyaret ediyor. (RLS'de sadece
`plans_authenticated_select` policy'si var — anonim kullanıcı planları
göremez, bu görev bunu değiştirmiyor.)

## Hedef (Neden)
/pricing sayfası şu an her koşulda "Planlar yüklenemedi" gösteriyor çünkü
sorgu var olmayan bir kolonu (`sort_order`) select+order ediyor (PostgREST
42703 hatası). Bu P0 bug, abonelik satın alma akışını (gelir akışını)
tamamen durduruyor.

## User Story
As a giriş yapmış emlakçı
I want /pricing sayfasını açtığımda mevcut planları fiyat sırasına göre görmek
So that bir abonelik planı seçip satın alabileyim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given `plans` tablosunda `sort_order` kolonu migration ile
   eklenmiş ve satırlar varsa, When authenticated kullanıcı /pricing'i
   açarsa, Then sayfa HTTP 200 döner, PostgREST hatası oluşmaz ve planlar
   `sort_order` artan sırada render edilir.
2. [Critical] Given migration uygulanmışsa, When `plans` tablosunun şeması
   `information_schema.columns`'tan okunursa, Then `sort_order` kolonu
   `integer`, `not null`, `default 0` olarak bulunur.
3. [High] Given `plans` tablosu boşsa, When /pricing açılırsa, Then sayfa
   hata göstermez, boş liste render edilir ("Planlar yüklenemedi" görünmez).
4. [High] Given migration ÖNCESİ durum (regresyon testi — sort_order kolonu
   yok), When sorgu çalıştırılırsa, Then PostgREST 42703 hatası döner ve
   page.tsx bunu `plansError` ile yakalayıp "Planlar yüklenemedi" gösterir
   (mevcut hata yolu bozulmamalı).
5. [Medium] Given migration var olan satırları backfill ediyorsa, When
   backfill sonrası satırlar okunursa, Then her satırın `sort_order` değeri
   birbirinden farklıdır ve fiyata göre artan sıradadır (price_minor_unit
   artan, eşitlikte created_at belirleyici).

## Threat Model
Tetikleyici yok — değerlendirilen tetikleyiciler: kimlik doğrulama/
yetkilendirme, kullanıcı girdisi, dosya yükleme/indirme, ödeme, kişisel veri
(KVKK), çok kiracılı sınır, dış API çağrısı, arka plan işi, yeni HTTP ucu.
Hiçbiri uymuyor çünkü bu görev sadece mevcut, değişmeyen bir salt-okuma
sorgusunun (RLS policy'si aynı kalıyor, yeni endpoint/yazma yolu yok) ihtiyaç
duyduğu bir kolonu migration ile eklemekten ibaret.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path: migration uygulanmış, plans satırları var | PostgREST 200, `data` sort_order artan sırada, `error=null`; sayfa HTTP 200 | Yok (salt okuma) | Plan kartları fiyata göre sıralı (Free→Pro→Premium), hata mesajı yok | AC-1 |
| 2 | plans tablosu boş | PostgREST 200, `data=[]`, `error=null`; sayfa HTTP 200 | Yok | Boş liste render edilir, "Planlar yüklenemedi" görünmez | AC-3 |
| 3 | sort_order kolonu eksik (düzeltme öncesi/regresyon) | PostgREST 400, kod 42703, `plansError` dolu; sayfa HTTP 200 | Yok (sayfa çökmez) | "Planlar yüklenemedi" | AC-4 |
| 4 | Backfill/default varsayımı yanlış (tüm satırlar 0) | PostgREST 200 ama değerler eşit, sıra deterministik değil | Yok | Kartlar yüklemeler arası farklı sırada görünebilir | AC-5 |

Kısmi başarı: Migration tek transaction içinde çalışır (Supabase CLI); kolon
ekleme başarılı olup backfill UPDATE'i başarısız olursa transaction rollback
olur, kolon da eklenmemiş gibi kalır — "yarım" bir şema asla commit edilmez.
Hiçbir şey yapılamadı ama hata da yok: Bu migration için geçerli değil —
`alter table` ve backfill `update` ifadeleri ya tamamen uygulanır ya da
transaction hata fırlatıp hiç uygulanmaz; sessiz no-op senaryosu yok.
Boş sonuç ↔ hata ayrımı: `data=[]` + `error=null` → "plan yok" (satır 2);
`data=null` + `error` dolu (kod 42703 vb.) → "sorgu/şema hatası" (satır 3).
İkisi asla aynı koşulda dönmez çünkü PostgREST şema hatasını her zaman
`error` alanında, boş sonucu her zaman `error=null` ile döner.

## Test Strategy
Unit: 20% — `fake-supabase.ts` ile plans fixture'larına `sort_order` eklenip
page.tsx'in sıralama/boş-liste/hata render mantığı test edilir.
Integration: 60% — gerçek (veya yerel) Supabase'e migration uygulanıp
`information_schema.columns` ve gerçek `.from("plans").select(...).order(...)`
sorgusu doğrulanır (bkz. `supabase-check` gate); migration-öncesi regresyon
testi (42703 hatası) de bu katmanda.
E2E: 20% — Playwright ile /pricing açılıp plan kartlarının sıralı ve
hatasız render edildiği tek bir smoke test.

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Performance Target: yok (sıradan bir select sorgusu, ek index gerekmiyor)
Memory: yok
Görsel/UI kriteri: Plan kartları fiyata göre soldan sağa artan sırada
görünmeli (Free→Pro→Premium gibi); "Planlar yüklenemedi" metni DOM'da
olmamalı.
Diğer ölçülebilir kriterler:
- `information_schema.columns`'ta `plans.sort_order` (integer, not null,
  default 0) bulunur.
- Authenticated sorgu 42703 hatası vermez, PostgREST 200 döner.
- Backfill sonrası mevcut satırların `sort_order` değerleri birbirinden
  farklıdır.

## Kapsam Dışı
- `plans` tablosuna admin UI üzerinden yazma / yeni bir yazma RLS policy'si
- Plan verisi seed etme veya fiyat değişikliği
- `web/src/app/pricing/page.tsx` sorgusunu veya UI'ını değiştirmek (zaten
  doğru, sadece eksik kolonu bekliyor)
- Ödeme akışı (checkout/webhook) değişiklikleri
- `sort_order` için unique constraint

## Etkilenen Dosyalar/Modüller (bilinen)
- Yeni: `supabase/migrations/0004_plans_sort_order.sql`
- `web/src/test/fake-supabase.ts` ve plans fixture'ları (sort_order alanı eklenecek)
- Varsa üretilmiş Supabase TS tipleri (`database.types.ts`) yeniden üretilecek
- Sadece referans, değişmeyecek: `web/src/app/pricing/page.tsx`

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu oturumda git reposu kökünün proje klasörüyle aynı olup
olmadığı ayrıca kontrol edilmedi. Sonraki adımlarda arama/grep
`emlak-platform` klasörüyle sınırlı tutulmalı.

## Rollback Beklentisi
Migration Supabase CLI ile tek transaction'da çalışır; `alter table` veya
backfill `update` hata verirse tüm migration rollback olur, şema eski haliyle
kalır (sayfa eskisi gibi "Planlar yüklenemedi" gösterir, daha kötü bir durum
oluşmaz). Elle geri alma gerekirse: `alter table plans drop column if exists sort_order;`.
Migration `add column if not exists` kullanacak şekilde yazılacak ki tekrar
çalıştırma güvenli olsun.

## Risks
- Mevcut `plans` satırlarının (varsa) fiyat sırasına göre backfill edilmesi
  varsayımı — gerçek iş sıralaması (ör. "Pro"nun ortada gösterilmesi gibi
  pazarlama tercihi) fiyat sırasından farklıysa, backfill sonrası elle
  düzeltme gerekebilir.

## Assumptions
- Mevcut `plans` tablosunda satır varsa bunlar fiyata göre (price_minor_unit
  artan, eşitlikte created_at) backfill edilecek — bu bir varsayım, kullanıcı
  onayı alınmadı.
- Supabase CLI migration'ları bu projede transactional çalışıyor (önceki
  migration dosyalarının yapısından çıkarım, doğrudan doğrulanmadı).

## Unknowns
- `plans` tablosunda şu anda gerçekten satır olup olmadığı (seed edilmiş mi)
  — `supabase-check` adımında gerçek projeye bakılarak doğrulanmalı.

## Sorular ve Cevaplar (ham kayıt)
1. Persona → Giriş yapmış emlakçı/agent kullanıcı (Opus low alt-ajanı
   tarafından yanıtlandı: RLS'de sadece authenticated select policy var)
2. Hedef/Neden → /pricing P0 prod bug, gelir akışını durduruyor (kullanıcı
   mesajından/Jira açıklamasından, tekrar sorulmadı)
3. Happy path → migration uygulanır, sayfa açılır, sorgu hatasız döner,
   planlar sort_order artan sırada render edilir (Opus low alt-ajanı
   tarafından yanıtlandı)
4. Edge case — mevcut satırların backfill değeri → fiyata göre artan sıra
   (price_minor_unit, eşitlikte created_at) (Opus low alt-ajanı tarafından
   yanıtlandı: hepsi 0 kalırsa sıra belirsiz olur)
5. Edge case — boş tablo → hata yok, boş liste döner (Opus low alt-ajanı
   tarafından yanıtlandı)
6. Davranış sözleşmesi — mevcut plansError kontrolü yeterli mi → evet,
   ek değişiklik gerekmiyor (Opus low alt-ajanı tarafından yanıtlandı)
7. Başarı ölçütü → information_schema kontrolü + 42703 hatasının
   oluşmaması + sıralı render (Opus low alt-ajanı tarafından yanıtlandı)
8. Kapsam dışı → admin yazma UI, seed, fiyat değişikliği, page.tsx/ödeme
   değişikliği, unique constraint (Opus low alt-ajanı tarafından yanıtlandı)
9. Bağımlılıklar → migration dosyası, fake-supabase fixture'ları, üretilmiş
   TS tipleri (Opus low alt-ajanı tarafından yanıtlandı)
10. Performans/güvenlik kısıtı → yok, ek risk taşımıyor (Opus low alt-ajanı
    tarafından yanıtlandı)
11. Rollback → transaction içinde otomatik rollback, elle drop column
    yeterli (Opus low alt-ajanı tarafından yanıtlandı)
12. Test stratejisi oranı → unit 20/integration 60/e2e 20 (Opus low
    alt-ajanı tarafından yanıtlandı: asıl risk gerçek DB şeması)
13. Jira ID ve görev kapsamı → EML-19, kullanıcı mesajından ("eml 19 jira
    görevine başla"), tekrar sorulmadı
14. Threat-model tetikleyicisi var mı → yok, bu dosyadaki "Threat Model"
    bölümünde gerekçelendirildi (otomatik karar, alt-ajana sorulmadı)
