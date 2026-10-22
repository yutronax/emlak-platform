---
task_slug: fingerprint-unique-constraint
jira_id: EML-54
threat_model: done
priority: medium
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 70
  integration: 30
  e2e: 0
affected_modules:
  - supabase/migrations/0007_raw_listings_fingerprint_unique.sql
  - scraper/supabase_client.py
  - scraper/orchestrator.py
---

# ATDD — fingerprint-unique-constraint

## Jira Kaynağı
[EML-54 — fingerprint-unique-constraint: paralel scraper worker'ları aynı ilanı iki kez yazabiliyor](https://kuyusuzyusuf123.atlassian.net/browse/EML-54) — `jira-sync` ile oluşturuldu, "Devam Ediyor"a geçirildi.

## Persona
Yusuf — scraper'ı işleten proje sahibi. Dolaylı etkilenen: admin review
panelini kullanan moderatör (aynı ilanı iki kez incelemek zorunda kalmamalı).

## Hedef (Neden)
`scraper/orchestrator.py`'deki `ThreadPoolExecutor` ile paralel çalışan
worker'lar, aynı ilanı (aynı normalize fingerprint) neredeyse aynı anda
işleyebiliyor. Mevcut dedup mekanizması (`fingerprint_exists()` kontrolü +
ayrı bir `insert`) atomik değil — iki worker aynı anda kontrol yapıp ikisi
de "yok" sonucunu görüp ikisi de insert edebiliyor (klasik check-then-act
race condition). `raw_listings.fingerprint` kolonunda sadece normal bir
index var (`raw_listings_fingerprint_idx`), unique constraint yok — veritabanı
seviyesinde de bu race'i engelleyen bir savunma hattı yok. Sonuç: aynı ilan
admin review kuyruğunda iki kez görünebiliyor.

## User Story
As a scraper'ı işleten proje sahibi (Yusuf)
I want fingerprint'e veritabanı seviyesinde bir unique constraint ve atomik
bir insert mekanizması
So that paralel worker'lar aynı ilanı asla iki kez yazamasın, race condition
dahil

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given `raw_listings` tablosu, When migration uygulanır, Then
   `fingerprint` kolonunda `status <> 'rejected'` koşuluyla PARTIAL bir
   unique index vardır (`information_schema`/`pg_indexes`'ten doğrulanabilir)
   — migration'dan önce mevcut mükerrer satırlar `status='rejected'`e
   soft-çekildiği için (customer kararı, bkz. plan.md) partial index aktif
   satırlar için unique garantisi verir.
AC-7. [High] Given migration'ın temizlik adımı mükerrer fingerprint'li N
   satırı `rejected`e çekiyor, When migration çalışır, Then etkilenen satır
   sayısı (N) migration log'unda (`RAISE NOTICE`) görünür olur — audit
   amaçlı, sessizce silinmez/gizlenmez (customer'ın görünürlük şartı).
2. [Critical] Given aynı fingerprint'e sahip iki kayıt art arda (sıralı)
   insert edilmeye çalışılır, When ikinci `insert_raw_listing` çağrılır,
   Then ikinci kayıt veritabanına YAZILMAZ (sessizce reddedilir, exception
   fırlatılmaz), fonksiyon bunun bir "insert edildi mi" bilgisini (bool)
   döndürür.
3. [Critical] Given iki worker aynı fingerprint'i NEREDEYSE AYNI ANDA
   (gerçek bir race — iki ayrı thread/connection) insert etmeye çalışır,
   When her ikisi de `insert_raw_listing`'i çağırır, Then veritabanında
   sadece BİR satır oluşur (unique constraint + `ON CONFLICT DO NOTHING`/
   `ignore_duplicates` ile atomik garanti — `fingerprint_exists()` ön
   kontrolüne güvenilmez).
4. [High] Given iki farklı fingerprint'e sahip kayıt, When ikisi de insert
   edilir, Then ikisi de normal şekilde yazılır (regresyon yok).
5. [High] Given bir insert, metin/parse hatası DEĞİL de gerçek bir DB
   bağlantı/yetki hatası yüzünden başarısız olur (ör. ağ kesintisi), When
   `insert_raw_listing` çağrılır, Then exception YUKARI FIRLATILIR (mevcut
   `handle_message`'ın geniş `except Exception` bloğu bunu yakalayıp loglar)
   — bu, "fingerprint çakışması" ile "gerçek hata" birbirine KARIŞTIRILMAZ.
6. [Medium] Given bir kayıt fingerprint çakışması yüzünden insert edilmedi
   (atlandı), When `handle_message` bunu işler, Then operatör bunu loglarda
   ayırt edebilir — "yeni kayıt yazıldı" ile "mükerrer, atlandı" farklı log
   satırlarıdır (mevcut davranış zaten böyle, `insert_raw_listing`'in yeni
   dönüş değeri bu ayrımı DAHA güvenilir hale getirir — artık ön-kontrolün
   "yok" demesine değil, gerçek DB sonucuna dayanır).

## Threat Model
Çağrıldı — Tetikleyiciler: arka plan işi (scraper worker, ThreadPoolExecutor
ile paralel), dış API çağrısı (Supabase REST, zaten mevcut). STRIDE-lite:
- **Tampering (ilgili, ama KABUL EDİLEN RİSK — AC-S üretilmedi):**
  Fingerprint, WhatsApp mesaj metninden Gemini ile parse edilen
  konum+fiyat+oda+m2 alanlarından hesaplanıyor — teorik olarak bir grup
  üyesi, mevcut gerçek bir ilanla AYNI normalize değerleri üretecek bir
  mesaj atarsa, yeni/gerçek ilan unique constraint'e takılıp sessizce
  reddedilebilir (veri bütünlüğü/görünürlük riski, "DoS" değil ama ona
  yakın bir sınıf). **Bu, bu görevin YARATTIĞI bir risk DEĞİL** —
  `fingerprint_exists()` ön kontrolü zaten BUGÜN aynı sessiz-reddetme
  davranışını gösteriyor (bu görev sadece bunu atomik/garantili hale
  getiriyor, DB seviyesinde). Gerçek sömürülebilirlik düşük: saldırganın
  hedef ilanın TAM parse edilmiş değerlerini (fiyat, m2, oda sayısı,
  ilçe) önceden bilmesi gerekir — bu bilgi zaten o ilanın kendisinde
  (herkese açık WhatsApp grup mesajı) var, yani saldırgan zaten mesajı
  görmüş olmalı; yeni bir saldırı yüzeyi açmıyor, sadece "aynı ilanı
  tekrar paylaşan biri" davranışıyla ayırt edilemez. Kabul edilen risk,
  Risks bölümüne yazıldı.
- **Spoofing/Elevation:** N/A — bu bir arka plan worker'ı, dışarıdan
  doğrudan çağrılan bir HTTP ucu değil, kimlik/rol kavramı yok.
- **Repudiation:** AC-6 ile karşılanıyor — mükerrer/yeni ayrımı loglarda
  görünür (atdd'nin yeni "operatör görünürlüğü" kuralı, bkz. 4a).
- **Info disclosure:** N/A — bu değişiklik hiçbir yanıt/API şekli
  değiştirmiyor, sadece DB yazma davranışı.
- **DoS:** Bkz. Tampering notu — ayrı bir AC-S üretilmedi, kabul edilen
  risk olarak işaretlendi.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Yeni fingerprint, ilk kez insert | `insert_raw_listing` → `(record, inserted=True)` (veya eşdeğer bool) | satır oluşur | — (sidecar/worker, log: "raw_listings'e yazıldı") | AC-1, AC-4 |
| 2 | Aynı fingerprint, sıralı ikinci insert denemesi | `insert_raw_listing` → `(None veya mevcut kayıt, inserted=False)` | satır OLUŞMAZ, exception YOK | log: "mükerrer ilan (fingerprint çakışması), atlandı" | AC-2 |
| 3 | Aynı fingerprint, GERÇEK RACE (iki thread aynı anda) | Her iki çağrı da DB'ye ulaşır, SADECE BİRİ `inserted=True` döner | DB'de tek satır | her iki worker da kendi sonucuna göre doğru loglar (biri "yazıldı", biri "atlandı") | AC-3 |
| 4 | Gerçek DB hatası (bağlantı/yetki, fingerprint çakışması DEĞİL) | Exception fırlatılır | yok (hiçbir satır yazılmaz) | `handle_message`'ın `except Exception` bloğu loglar, mesaj retry edilmez (mevcut davranış) | AC-5 |
| 5 | Kısmi başarı | N/A — tek satırlık atomik bir insert, ara durum mimari olarak mümkün değil | — | — | — |
| 6 | Hiçbir şey yapılmadı ama hata yok (fingerprint çakışması) | AC-2/AC-3'teki `inserted=False` dönüşü — bu NORMAL ve BEKLENEN bir sonuç (dedup'ın amacı tam olarak bu) | yok | AC-6'daki ayrı log satırı | AC-2, AC-6 |

Kısmi başarı: Uygulanmayan (yukarıda #5) — `insert_raw_listing` tek bir
atomik DB operasyonu (upsert + ON CONFLICT), ara durum yok.
Hiçbir şey yapılamadı ama hata da yok: AC-2/AC-3/AC-6'da tanımlı — fingerprint
çakışması nedeniyle insert edilmemesi bir HATA değil, dedup'ın doğru
çalıştığının kanıtı; sessizce gizlenmiyor, ayrı bir log satırıyla görünür
(atdd'nin "operatör görünürlüğü" kuralı burada doğrudan uygulanıyor).
Boş sonuç ↔ hata ayrımı: `insert_raw_listing`'in dönüş değeri (`inserted`
bool'u veya eşdeğeri) bu ayrımı garanti eder — "mükerrer, atlandı" (AC-2/3)
ile "gerçek hata" (AC-5) ASLA aynı şekilde ele alınmaz, ikincisi her zaman
exception olarak yukarı fırlatılır.

## Test Strategy
Unit: 70% — `insert_raw_listing`'in dönüş değeri (inserted=True/False)
mock'lanmış Supabase client ile; `fingerprint_exists` ön-kontrolünün
mevcut davranışı korunduğu.
Integration: 30% — gerçek (veya test) Supabase projesine karşı migration'ın
gerçekten unique constraint oluşturduğunu ve eşzamanlı iki insert'ten
sadece birinin başarılı olduğunu doğrulayan bir test (bkz. `supabase-check`,
verify adımında zorunlu).
E2E: 0% — arka plan worker'ı, UI yok.

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Performance Target: yok (tek ek DB round-trip yok, mevcut insert çağrısının
yerini alıyor, sorgu sayısı artmıyor)
Memory: yok
Görsel/UI kriteri: yok
Diğer ölçülebilir kriterler:
- Aynı fingerprint'e sahip 2 eşzamanlı insert denemesinde DB'de kesinlikle
  1 satır oluşur (test ile doğrulanır, gerçek eşzamanlılıkla — mock'lanmış
  sıralı çağrı değil).
- Farklı fingerprint'lerin insert'i regresyona uğramaz (mevcut testler/akış
  bozulmaz).

## Kapsam Dışı
- Fingerprint hesaplama mantığının (`compute_fingerprint`) kendisi
  değiştirilmiyor — sadece DB seviyesindeki garanti ekleniyor.
- Tampering tehdidinin (kasıtlı fingerprint çakıştırma) önlenmesi — kabul
  edilen risk, bkz. Threat Model/Risks.
- `source_message_id` üzerindeki mevcut unique index'e dokunulmuyor (zaten
  var ve çalışıyor, bu görevin konusu değil).
- Admin review panelinin mükerrer-tespit UI'ı (zaten dedup DB seviyesinde
  engellendiği için gerek yok).

## Etkilenen Dosyalar/Modüller (bilinen)
- `supabase/migrations/0007_raw_listings_fingerprint_unique.sql` (yeni,
  `fingerprint` kolonuna unique index ekler)
- `scraper/supabase_client.py` (`insert_raw_listing` atomik upsert'e
  dönüştürülür, dönüş değeri `inserted` bilgisini taşır)
- `scraper/orchestrator.py` (`handle_message`, yeni dönüş değerine göre
  log satırını ayarlar — AC-6)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökü proje klasörüyle aynı mı
geniş mi teyit edilmedi. Sonraki adımlarda arama `emlak-platform/` altıyla
sınırlanmalı.

## Rollback Beklentisi
Migration geri alınabilir (`drop index if exists`); `insert_raw_listing`'in
eski (check-then-insert, atomik olmayan) haline dönmek tek bir dosya revert'i.
Unique constraint eklenirken tabloda ZATEN mükerrer fingerprint'li satırlar
varsa migration BAŞARISIZ olur (Postgres unique index oluşturamaz) — bu
durumda migration'dan önce mevcut mükerrerlerin temizlenmesi gerekir,
`code-copilot`'a bu kontrolü migration'da (ör. önce bir `SELECT fingerprint,
count(*) ... having count(*) > 1` ile tespit) yapması veya en azından
migration'ın başarısız olacağını açıkça belgelemesi talimatı verilecek.

## Risks
- **Kabul edilen risk (threat-model):** Kasıtlı fingerprint çakıştırma
  yoluyla gerçek bir ilanın sessizce reddedilmesi — düşük sömürülebilirlik
  (saldırganın hedef ilanın tam parse edilmiş değerlerini bilmesi gerekir),
  bu görevin YARATTIĞI değil bugün zaten var olan bir davranış; sadece DB
  seviyesinde garanti ediliyor.
- Migration öncesi tabloda zaten mükerrer fingerprint varsa migration
  başarısız olur — bkz. Rollback Beklentisi, code-copilot'a kontrol
  talimatı verilecek.

## Assumptions
- `raw_listings` tablosunda şu an mükerrer fingerprint'li satır OLMADIĞI
  varsayılıyor (doğrulanmadı — `plan`/`code-copilot` adımında kontrol
  edilmeli, varsa migration'dan önce temizlenmeli).
- `supabase-py>=2.6.0` (requirements.txt'te pinli) `upsert(...,
  on_conflict=..., ignore_duplicates=True)` parametrelerini destekliyor
  varsayımı — PostgREST `Prefer: resolution=ignore-duplicates` başlığına
  karşılık gelir.

## Unknowns
- Üretimde `raw_listings` tablosunun gerçek satır sayısı/mevcut mükerrer
  durumu bu oturumda doğrulanmadı — `plan`/`supabase-check` adımında
  kontrol edilmeli.

## Sorular ve Cevaplar (ham kayıt)
1. Persona/hedef → Yusuf, paralel worker race condition'ı önlemek.
   (kod okunarak türetildi: orchestrator.py'nin ThreadPoolExecutor kullanımı
   + supabase_client.py'nin check-then-insert deseni)
2. Happy path/edge case'ler (AC-1..6) → mevcut kodun (fingerprint_exists,
   insert_raw_listing, handle_message'ın except bloğu) davranışına sadık
   kalınarak, sadece atomiklik garantisi eklenecek şekilde türetildi.
3. Test stratejisi → 70/30/0, gerekçe: saf dönüş-değeri testleri unit,
   gerçek eşzamanlılık/constraint doğrulaması integration (supabase-check).
4. Kapsam dışı → fingerprint hesaplama mantığı, source_message_id index'i,
   admin UI — hiçbiri bu görevin konusu değil, kod okunarak netleştirildi.
5. (threat-model) Kasıtlı fingerprint çakıştırma → kabul edilen risk,
   AC-S üretilmedi (bu görevin yarattığı yeni bir risk değil, bugün zaten
   var olan davranışın DB seviyesinde garantiye bağlanması).
