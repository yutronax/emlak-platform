---
task_slug: faz2-ilan-akisi-bildirim
jira_id: EML-85
threat_model: done
priority: high
coverage_target: 80
performance_target: "dashboard server p95 <800ms; okunmamış sayaç sorgusu <150ms"
memory_target: null
test_strategy:
  unit: 70
  integration: 20
  e2e: 10
affected_modules:
  - web/src/app/agent/dashboard/page.tsx
  - web/src/app/agent/dashboard/page.test.tsx
  - web/src/app/admin/listings (onay akışı — source_group_name kopyası)
  - supabase/migrations/0016_* (yeni)
---

# ATDD — faz2-ilan-akisi-bildirim

## Jira Kaynağı
[EML-85 — faz2-ilan-akisi-bildirim: İlan akışı sayfası + site içi bildirim](https://kuyusuzyusuf123.atlassian.net/browse/EML-85)
Açıklama (Jira'dan): Faz 2 (yol-haritasi.md): /agent/dashboard'ı ilan akışına çevir — kart görünümü, kaynak grup adı, fiyat/oda/m²/konum/geliş zamanı; filtreler (grup, fiyat aralığı, oda, il/ilçe); site içi bildirim (zil, "N yeni ilan"). Kapsam dışı: Web Push, max_listings.

## Persona
Aboneliği aktif (active/trialing) emlakçı; teknolojiyle arası orta-zayıf, çoğunlukla mobilden bakıyor.

## Hedef (Neden)
Abonelik ürününün görünen yüzü: WhatsApp gruplarından gelen ilanları formatlı, filtrelenebilir ve "yeni geldi" bildirimli bir akışta göstermek. Bugünkü ortak havuzla çalışır; Faz 3'te kişiselleşir.

## User Story
As a aboneli emlakçı
I want gruplardan gelen ilanları kaynak grubuyla, filtreleyerek görmek ve yeni ilan geldiğinde haberdar olmak
So that WhatsApp gruplarını tek tek taramadan işime yarayan ilanı hızlıca bulayım.

## Acceptance Criteria
1. [Critical] AC-1 — Given aboneli emlakçı ve ilanlar var, When /agent/dashboard açılır, Then `created_at desc` sıralı ilk 20 ilan kart olarak görünür; her kartta grup adı, fiyat, oda, m², konum, geliş zamanı.
2. [Critical] AC-2 — Given `?grup=&fiyat_min=&fiyat_max=&oda=&il=&ilce=&sayfa=` param'ları, When sayfa açılır, Then filtreler server-side (Supabase query builder, parametreli) uygulanır; sayfa başına 20, offset sayfalama.
3. [Critical] AC-3 — Given abonelik yok/süresi dolmuş, When sayfa açılır, Then ilan sorgusu çalışmaz, zil ve filtreler görünmez, mevcut "Abone olun" çağrısı görünür.
4. [Critical] AC-4 — Given listings sorgusu hata döner (DB/timeout 5sn), Then "İlanlar yüklenemedi." görünür ve `console.error('[dashboard] listings query failed', {code})` loglanır; boş liste mesajı GÖSTERİLMEZ.
5. [High] AC-5 — Given filtreye uyan ilan yok (error yok, data=[]), Then "Filtreye uyan ilan yok." + "Filtreleri temizle" linki; filtre yokken mevcut "Şu an gösterilecek ilan yok."
6. [High] AC-6 — Given geçersiz param (sayı değil, negatif, >1e12, listede olmayan oda, >100 karakter metin, allowlist dışı il/ilçe/grup), Then o param yok sayılır, kalanlar uygulanır, "Bazı filtreler geçersizdi, uygulanmadı" notu görünür. min>max ise yer değiştirilir (not gösterilmez).
7. [High] AC-7 — Fiyat filtresi aktifken yalnızca `currency='TRY'` ve `price is not null` ilanlar döner.
8. [High] AC-8 — Oda seçenekleri sabit: 1+0, 1+1, 2+1, 3+1, 4+1, 5+ ("5+" = 5 ve üstü oda). Diğerleri tam eşitlik.
9. [High] AC-9 — İl/ilçe/grup seçenekleri `listings`'ten distinct; ilçe listesi seçili ile daralır.
10. [Critical] AC-10 — Null alanlar: price null → "Fiyat belirtilmemiş"; rooms/area_m2 null → o parça gizlenir; city+district null → "Konum belirtilmemiş", biri doluysa sadece o; source_group_name null → "Bilinmeyen grup". Hiçbir kartta "null", "NaN", "Invalid Date" görünmez. TS tipi nullable'a düzeltilir.
11. [Medium] AC-11 — Geliş zamanı: <24 saat göreli ("12 dk önce"), aksi halde "27 Eki 14:05" (tr-TR, Europe/Istanbul).
12. [Critical] AC-12 — Kaynak grup: `listings.source_group_name text null` eklenir; admin onayı raw_listings.source_group_name'i kopyalar; mevcut satırlar `raw_listing_id` üzerinden tek seferlik backfill edilir. Yeni onaylanan ilanda kolon doluysa kartta grup adı görünür (doğrudan tetikleme: admin onay fonksiyonu çağrılıp listings satırı okunur).
13. [Critical] AC-13 — Bildirim: `agents.listings_seen_at timestamptz null`. Sayaç = `count(listings where created_at > coalesce(listings_seen_at, now()-7 gün))`, `limit 100`. Zilde N (>99 ise "99+"), 0 ise rozetsiz.
14. [High] AC-14 — Zile tıklanınca server action `listings_seen_at = now()` yazar, yalnızca `auth.uid()` satırını; başarıda rozet sıfırlanır. Sayfa açılışı tek başına "görüldü" sayılmaz.
15. [High] AC-15 — Sayaç sayfa yüklemede server'da hesaplanır, client 60 sn'de bir polling yapar; sekme gizliyken polling durur; polling hatası/timeout'ta son değer korunur.
16. [High] AC-16 — Kısmi başarı: ilanlar geldi ama sayaç sorgusu hata → liste normal, zil sayısız, `console.error('[dashboard] unread count failed', {code})`. seen_at update hata → rozet sıfırlanmaz, `console.error('[dashboard] seen_at update failed', {code})`.
17. [High] AC-17 — Sessiz başarısızlık yasak: seen_at update 0 satır etkilerse başarı SAYILMAZ, rozet sıfırlanmaz, `console.warn('[dashboard] seen_at update affected 0 rows')`. (Doğrudan tetikleme: başka agent id'si / satırı olmayan kullanıcı ile action çağrılır.)
18. [Medium] AC-18 — İndeksler: `listings(created_at)`, `listings(source_group_name)` (mevcut `(city,district)` korunur).
19. [Critical] AC-S1 (Tampering/Elevation) — `listings_seen_at` yazan server action hedef id'yi istemciden ALMAZ; `auth.getUser()`'dan alır. Action'a body/form ile `agentId=<B_id>` gönderilse bile yalnızca çağıranın satırı değişir, B'nin `listings_seen_at`'ı değişmez. Oturumsuz çağrı → hiçbir satır değişmez, hata döner.
20. [Critical] AC-S2 (Elevation/RLS) — A emlakçısının JWT'siyle PostgREST'e doğrudan `PATCH /agents?id=eq.<B_id>` `{listings_seen_at: ...}` → 0 satır etkilenir. A kendi satırında `role`/abonelik/immutable kolonları (0005) bu yeni yol üzerinden değiştiremez (column grant veya SECURITY DEFINER `mark_listings_seen()` yalnızca `listings_seen_at`'a yazar).
21. [Critical] AC-S3 (Info disclosure/Elevation) — Aboneliği olmayan kullanıcının JWT'siyle doğrudan `GET /listings?select=source_group_name` → boş/ret (mevcut `listings_subscriber_select` korunur); sayaç sorgusu ve distinct seçenek sorguları da aynı RLS'ten geçer, abone olmayana sayı/grup adı sızmaz. Sayaç server action'ı abonelik yoksa sorgu atmaz.
22. [High] AC-S4 (Tampering/injection) — `?il=x,city.eq.y)` , `?grup=*`, `?oda=1+1);drop` gibi girdiler: ham değer `.or()`/`.filter()` string'ine birleştirilmez, yalnızca `.eq()/.gte()/.lte()` ile ve allowlist'ten geçmiş değerle kullanılır; allowlist dışı değer AC-6'ya düşer, yanıtta beklenmeyen satır yoktur.
23. [High] AC-S5 (DoS) — `?sayfa=999999999` veya negatif → 1..1000 aralığına kırpılır; limit istemciden alınmaz (sabit 20); polling 60 sn altına indirilemez (sunucu sabiti).
24. [Medium] AC-S6 (Info disclosure) — Hata loglarında ve UI'da DB hata mesajı/stack, agent e-postası veya ilan metni yer almaz; sadece `code` loglanır.

## Threat Model
Çağrıldı — AC-S1..AC-S6 yukarıdaki Acceptance Criteria'ya eklendi. Varlıklar: `agents.listings_seen_at` (emlakçıya ait), `listings` + `source_group_name` (sadece abonelere). Sınırlar: tarayıcı→server action, tarayıcı→PostgREST (anon key + JWT), URL→sorgu. STRIDE: S — mevcut Supabase oturumu, yeni yüzey yok, atlandı; R — seen_at düşük değerli işlem, audit gerekmez (kabul edilen risk). Yetki AC'leri için `authz-test` matrisi test adımında koşulacak.
Ortam kısıtı: AC-S2/AC-S3 PostgREST REST çağrısıyla test edilebilir (doğrudan DB bağlantısı gerekmez).

## Davranış Sözleşmesi
| # | Durum | Dönen / gösterilen | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path | 20 kart `{id,title,price,currency,rooms,area_m2,city,district,source_group_name,created_at}` + sayaç N | Yok | Kartlar + zil "N yeni ilan" | AC-1, AC-13 |
| 2 | Geçersiz filtre param'ı | Geçersizler düşer, geçerliler uygulanır | Yok | Liste + "Bazı filtreler geçersizdi, uygulanmadı" | AC-6 |
| 3 | Filtreye uyan ilan yok | `data=[]`, `error=null` | Yok | "Filtreye uyan ilan yok." + temizle linki | AC-5 |
| 4 | Abonelik yok/dolmuş | Sorgu yok, zil yok | Yok | "İlanları görmek için aktif abonelik gerekir." + "Abone olun" | AC-3 |
| 5 | listings DB hatası | `error!=null` | console.error kod | "İlanlar yüklenemedi." (zil bağımsız çalışabilir) | AC-4 |
| 6 | Zaman aşımı (5 sn) | #5 gibi; polling timeout'ta son değer | timeout logu | "İlanlar yüklenemedi." | AC-4, AC-15 |
| 7 | Kısmi: ilan var, sayaç/seen_at hata | İlanlar döner | console.error | Liste normal; zil sayısız / rozet sıfırlanmaz | AC-16 |
| 8 | Hiçbir şey olmadı ama hata yok (seen_at 0 satır) | Başarısız sayılır | console.warn | Rozet sıfırlanmaz, hata mesajı yok | AC-17 |
| 9a | Yeni ilan var | count>0 | Yok | "N yeni ilan" | AC-13 |
| 9b | Yeni ilan yok | count=0 | Yok | Rozetsiz zil | AC-13 |
| 9c | count>99 | limit 100 | Yok | "99+" | AC-13 |
| 10 | Yetkisiz (başka agent'ın seen_at'ı) | RLS/action reddeder, 0 satır | console.warn | Değişiklik yok | AC-17 |

Boş sonuç ↔ hata ayrımı: `error` varsa hata mesajı + log; `error=null && data=[]` ise boş mesajı. Abonelik yoksa sorgu hiç atılmaz (RLS'in boş döndürmesine güvenilmez).
LLM çağrısı: yok — satır silindi.

## Test Strategy
Unit: 70% — filtre param parse/doğrulama, formatlayıcılar (fiyat, konum, zaman, 99+), null render.
Integration: 20% — sorgu oluşturucu + RLS (abone select, seen_at sadece kendi), server action, admin onay kopyası, backfill.
E2E: 10% — filtrele → sonuç; zil rozeti → tıkla → sıfırlanır.

## Benchmark / Başarı Ölçütü
Coverage Target: 80%
Performance Target: dashboard p95 <800ms, sayaç <150ms
Görsel/UI kriteri: 375px mobilde kartlar taşmaz, filtreler kullanılabilir; zil rozeti okunur; hata/boş mesajları görünür (vision-test).

## Kapsam Dışı
Web Push / tarayıcı bildirimi; `max_listings` plan limitleri; per-agent ilan ayrımı (Faz 3); Realtime; kur dönüşümü; ilan detay sayfası; her ilan için ayrı bildirim satırı.

## Etkilenen Dosyalar/Modüller (bilinen)
`web/src/app/agent/dashboard/page.tsx` (+test), admin onay akışı (`/admin/listings`), yeni migration `0016_*`, yeni zil client bileşeni + server action.

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — aramalar `emlak-platform/` ile sınırlansın.

## Rollback Beklentisi
Migration geri alınabilir: iki kolon + iki indeks drop; mevcut veri bozulmaz. Bildirim hatası sayfayı bozmaz.

## Risks
- Distinct il/ilçe/grup sorguları havuz büyüdükçe yavaşlar.
- `agents` üzerinde yeni update yolu, immutable kolon korumasıyla (0005) çakışabilir.
- Backfill canlı DB'de çalışır — kullanıcı onayıyla, orkestratör uygular.
- Kabul edilen risk: seen_at değişikliği için audit log yok (düşük değerli, yalnızca kendi bildirim durumu).
- Kabul edilen risk: polling için ayrı rate limit yok; istemci 60 sn sabit, Supabase varsayılan limitlerine güveniliyor.

## Assumptions
- Tüm aboneler aynı havuzu görür (Faz 3'e kadar).
- 7 günlük ilk sayaç penceresi makul (varsayım).

## Unknowns
- `agents` için column-level grant mı SECURITY DEFINER `mark_listings_seen()` mi — plan adımında karar.

## Sorular ve Cevaplar (ham kayıt)
Kapsam (Web Push/max_listings hariç) ve slug: kullanıcı mesajından ("Evet, başla").
1-11: Opus low alt-ajanı tarafından yanıtlandı — cevaplar yukarıdaki AC'lere birebir işlendi (kaynak grup denormalize+backfill; seen_at zaman damgası; 60 sn polling; URL param + server-side + 20/sayfa offset; TRY fiyat filtresi, sabit oda listesi, distinct seçenekler; null gösterimleri; zil abonesiz gizli, geçersiz param yok sayılır; p95 800ms/%80/70-20-10; geri alınabilir migration; ayrı hata logları; RLS + allowlist).
Notion mirror: atlandı (takım okumuyor, Jira EML-85 tek görünür kaynak).
