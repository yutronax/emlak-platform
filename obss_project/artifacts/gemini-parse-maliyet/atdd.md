---
task_slug: gemini-parse-maliyet
jira_id: null
threat_model: done
priority: high
coverage_target: 90
performance_target: "Ek işlem gecikmesi p95 <=100 ms"
memory_target: "Süreç başına LRU en fazla 1000 kayıt"
test_strategy:
  unit: 75
  integration: 20
  e2e: 5
affected_modules:
  - scraper/parser.py
  - scraper/supabase_client.py
  - scraper/orchestrator.py
  - scraper/.env.example
  - scraper/tests/
  - supabase/migrations/
---

> Taslak: Codex (atdd-taslak), denetim: Claude. Jira: bağlantı yok, jira_id null.

# ATDD — gemini-parse-maliyet

## Jira Kaynağı

`jira_id: null`. Kullanıcının sağladığı oturum kaydına göre bu oturumda Jira (Atlassian) MCP bağlantısı yok, `jira-sync` çalıştırılamadı. Bağlantı kurulunca EML projesinde “Gemini ilan ayrıştırma maliyetini düşür” başlıklı issue açılacak.

Jira kaynaklı User Story ve AC bulunmuyor. Bu belgenin kaynağı görev metni, sağlanan 4z yanıtları ve okunan proje kodudur.

Notion mirror atlandı. Bu teslim yalnız belge içeriğidir, dosya ve harici kayıt oluşturulmadı.

## Persona

Platform sahibi/operatör. WhatsApp ilanlarını işleyen scraper’ın Gemini kullanımını ve operasyonel maliyetini yönetir. Emlakçının mevcut ortak havuz ve kişisel ilan akışları korunur.

## Hedef (Neden)

Kullanıcının ilk ifadesi “modelin sürekli aynı promptu verip çıktı isticeğiz ve bunun uzun vadede çok maliyetli”.

Aynı ilan kalitesini daha az Gemini çağrısıyla sağlamak için normalize edilmiş mesaj hash’iyle tekrar önbelleği, güvenli ön-eleme ve kısmi regex çıkarımı uygulanacaktır.

Gerçek kodda ortak yolun sırası `parse_listing_message → compute_fingerprint → fingerprint_exists → score_listing → insert_raw_listing` şeklindedir. Farklı mesaj ID’leriyle farklı gruplara gelen aynı metin, fingerprint kontrolüne ulaşmadan önce tekrar Gemini’ye gönderilir. `_active_ids` yalnız aynı mesaj ID’sinin eşzamanlı işlenmesini sınırlar.

Kişisel yolda `is_group_selected` parse işleminden önce çalışır. Ardından parse, kalite skoru ve `ingest_personal_listing` RPC’si gelir. Önbellek bu erişim ve yazım kontrollerini korumalıdır.

## User Story

As a platform sahibi/operatör  
I want WhatsApp mesajlarının güvenli ön-eleme, tekrar önbelleği ve kısmi regex çıkarımıyla ayrıştırılmasını  
So that ilan kalitesi ve emlakçının mevcut akışı korunurken Gemini çağrıları ve ayrıştırma maliyeti azalır.

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)

1. **AC-1 [Critical]** Given optimizasyon açık, yeni ilan önbellekte yok ve regex kısmi alanlar çıkarıyor, When `parse_listing_message(raw_text, key_manager)` çağrılır, Then model yalnız eksik/belirsiz alanların tamamlanması için kullanılır, açık regex değerleri korunur, tam doğrulanmış `dict` döner ve başarılı sonuç önbelleğe yazılır. Çelişki ve sağlayıcı hatası bulunmayan durumda bir Gemini çağrısı yapılır. `cache_miss`, `regex_partial`, `gemini_call` ve süreler kaydedilir.

2. **AC-2 [Critical]** Given aynı metnin Unicode NFC, baş/son boşluk temizliği ve ardışık boşlukların birleştirilmesiyle eşleşen sürümleri, When farklı grup ve mesaj ID’leriyle ardışık işlenirler, Then aynı sürümlü hash anahtarını kullanırlar ve ilk başarılı sonuçtan sonraki geçerli isabetler Gemini çağırmadan `dict` veya negatif kayıt için `None` döndürür. Harf, emoji, noktalama, telefon ve URL değişiklikleri korunur. Farklı telefonlar farklı hash üretir.

3. **AC-3 [High]** Given süreç başına LRU ve Supabase kalıcı önbellek, When bir mesaj aranır, Then önce LRU, kaçırırsa Supabase sorgulanır, geçerli DB isabeti LRU’ya taşınır ve `cache_hit{layer=lru|supabase}` üretilir. LRU en fazla 1.000 kayıt tutar ve kapasite aşımında en az yakın zamanda kullanılan kayıt çıkarılır.

4. **AC-4 [High]** Given başarılı pozitif veya negatif kayıt, When önbelleğe yazılır ve daha sonra okunur, Then pozitif kayıt yazımdan itibaren 7 gün, negatif kayıt 24 saat geçerlidir. `now >= expires_at` durumunda kayıt kullanılmaz. Okuma ve LRU’ya taşıma sürenin başlangıcını yenilemez. Model, çıktı şeması veya ayrıştırıcı sürümü değişince eski anahtarlar kaçırma sayılır.

5. **AC-5 [Critical]** Given boş metin veya yalnız açık selamlaşma/teşekkürden oluşan kısa mesaj, When ön-eleme çalışır, Then `None` döner, Gemini çağrılmaz, negatif sonuç 24 saat önbelleğe alınır ve `prefilter_rejected` üretilir. Belirsiz mesajlar ve selamlaşmayla birlikte ilan içeren mesajlar ayrıştırmaya devam eder. Doğrulama kümesindeki gerçek ilanlarda ön-eleme yanlış negatifi %0 olur.

6. **AC-6 [High]** Given açık ve tek anlamlı fiyat/para birimi, alan veya oda ifadeleri, When regex uygulanır, Then yalnız `price+currency`, `area_m2`, `rooms` çıkarılır. Birden çok aday, net/brüt ayrımı veya anlam belirsizliği bulunan alan kesin kabul edilmez. `2.500.000 TL`, `120 m²`, `3+1` gibi açık değerler doğru türlere dönüştürülür. Telefon, URL ve ilan numarası fiyat veya alan olarak yorumlanmaz.

7. **AC-7 [Critical]** Given regex çıktısı, When mevcut deterministik kurallarla ilan niteliği ve tüm çıktı sözleşmesi doğrulanamıyorsa, Then Gemini yolu kullanılır. Üç kolay alanın bulunması tek başına `regex_only` için yeterli olmaz. Tam doğrulanabilir çıktı gerçekten üretilebiliyorsa `dict` döner, önbelleğe yazılır ve `regex_only` üretilir.

8. **AC-8 [Critical]** Given regex ve Gemini aynı alan için çelişiyor veya ilan niteliğinde uyuşmazlık oluşuyor, When sonuç birleştirilir, Then `regex_conflict` üretilir ve mevcut tam ayrıştırma yoluna en fazla bir ek mantıksal çağrı yapılır. Ek çağrı, regex değerleri "bilinen alan" olarak dayatılmadan yapılan tam ayrıştırmadır ve çelişkiyi o çözer: doğrulanmış ilan için modelin `dict` sonucu (regex değerleriyle birleştirilmeden), doğrulanmış ilan olmayan sonuç için `None` döner. Ek tam çağrı başarısız olursa `None` döner ve hiçbir önbelleğe yazılmaz. (Red-team F1 sonrası güncellendi: regex yalnız ipucudur; ilan no gibi hatalı regex değeri geçerli ilanı düşürmemelidir.)

9. **AC-9 [Critical]** Given önbellek okuma, yazma, geçersiz kaydı silme veya temizleme hatası, When işlem yürütülür, Then hata mesajı düşürmez. Okuma hatasında normal ayrıştırma sürer, yazma hatasında doğrulanmış `dict` veya başarılı negatif `None` korunur. Mümkünse LRU kaydı tutulur. `cache_error{operation}` ve ilgili yolun sayaçları üretilir.

10. **AC-10 [Critical]** Given Gemini timeout, ağ hatası, bozuk JSON, şema dışı yanıt, kullanılabilir anahtar bulunmaması veya anahtarların tükenmesi, When ayrıştırma tamamlanamaz, Then `None` döner, kısmi regex sonucu döndürülmez ve hiçbir önbelleğe sonuç yazılmaz. Gerçek çağrılar `gemini_call`, hata durumları `gemini_error` ile içeriksiz neden koduyla izlenir.

11. **AC-11 [High]** Given Gemini 429 veya `RESOURCE_EXHAUSTED` yanıtı, When mevcut rotasyon akışı çalışır, Then `switch_to_next_async` davranışı ve anahtar sayısıyla sınırlı deneme bütçesi korunur. Her istemci `HttpOptions(timeout=30000)` kullanır. Her gerçek istek ayrı `gemini_call` sayılır. Başarılı son sonuç önbelleğe alınabilir, başarısız denemeler negatif kayıt oluşturmaz.

12. **AC-12 [Critical]** Given model yanıtı veya pozitif önbellek kaydı, When uygulama doğrulaması yapılır, Then `is_listing` gerçek `bool`, sayısal alanlar sonlu `number | None`, metinsel alanlar `str | None`, `currency` ise `"TRY" | None` olmalıdır. Sayısal alanlarda `bool` kabul edilmez. Pozitif sonuç eksik nullable anahtarlar `None` ile tamamlanarak tam sözleşmeyle döner. Şema dışı model çıktısı `None` ve `gemini_error`, bozuk önbellek kaydı `cache_invalid + cache_miss` üretir.

13. **AC-13 [High]** Given `price`, `currency`, `rooms`, `area_m2`, `city`, `district`, `neighborhood`, `title` veya `description` metinde bulunmuyor, When tam ayrıştırma başarılı olur, Then ilgili alan Python `None` olur. Eksik değerler sıfır, boş metin veya tahmini konumla doldurulmaz. Mevcut kalite skoru ve pending/approved karar yolu çalışmaya devam eder.

14. **AC-14 [High]** Given kullanıcı mesajında talimat, JSON örneği veya delimiter benzeri içerik, When kısmi model isteği hazırlanır, Then güvenilir çıkarım talimatları ile kullanıcı metni sınırları açık veri bloklarında ayrılır ve metin içindeki talimatları yok sayma talimatı bulunur. Kullanıcı içeriği regex bulgusu veya güvenilir talimat olarak kabul edilmez. Mevcut `SYSTEM_PROMPT` ve kapsam dışı SDK üretim ayarları değiştirilmez.

15. **AC-15 [Medium]** Given tek mesajlık ayrıştırma protokolü, When model isteği ve yanıtı oluşturulur, Then eşleştirme alan adlarıyla yapılır ve index/sıra numarası kullanılmaz. Yanlış indeks eşleştirmesiyle alan veya mesaj taşınmaz.

16. **AC-16 [Critical]** Given `GEMINI_PARSE_OPTIMIZATION_ENABLED=false`, When parser normal giriş noktasından çağrılır, Then mevcut Gemini ayrıştırma yolu kullanılır, önbellek, ön-eleme ve regex optimizasyonları atlanır. Mevcut dönüşler, 30 saniyelik HTTP timeout ve 429 rotasyonu korunur. Bayrak dağıtımda açıkça etkinleştirilir.

17. **AC-17 [Critical]** Given önbellekten gelen ilan, When ortak veya kişisel akışta ilerler, Then mevcut fingerprint algoritması, ortak havuz dedup kapsamı, kalite skoru, kayıt sahipliği, kişisel RPC kontrolleri ve `bump_sidecar_counter` iş anlamı korunur. Önbelleğe kalite kararı, owner, grup yetkisi veya yazım sonucu konmaz.

18. **AC-18 [High]** Given 10 worker’ın paralel işlediği farklı veya aynı anahtarlar, When önbellek okunur/yazılır, Then LRU kapasitesi ve veri bütünlüğü korunur, atomik kalıcı yazım bozuk/yarım kayıt oluşturmaz ve bir çağıranın dönen `dict` üzerinde yaptığı değişiklik sonraki isabete taşınmaz. Süreçler arası tamamlanmış kayıtlar yeniden başlatma sonrasında kullanılabilir.

19. **AC-19 [High]** Given optimizasyon açık, When her ayrıştırma yolu çalışır, Then içeriksiz yapılandırılmış loglarda `cache_hit{layer}`, `cache_miss`, `cache_error{operation}`, `cache_invalid`, `prefilter_rejected`, `regex_partial`, `regex_only`, `gemini_call`, `gemini_error`, `regex_conflict` ve işlem süreleri bulunur. Bir tam aramada geçerli isabet yoksa bir `cache_miss` üretilir. Yeni sayaç tablosu oluşturulmaz.

20. **AC-20 [High]** Given sabit, etiketli ve temsili tekrar içeren mesaj kümesi, When bayrak kapalı mevcut akış ve bayrak açık akış aynı sıralamayla karşılaştırılır, Then gerçek Gemini çağrısı en az %40 azalır, ön-eleme yanlış negatifi %0, ek işlem gecikmesi p95 ≤100 ms ve değişen parser kodunda branch coverage ≥%90 olur. Tekrar oranı ve sonuç kalitesi raporlanır.

21. **AC-S1 [Critical]** Given yeni kalıcı önbellek tablosu, When anon, authenticated ve servis rolüyle doğrudan erişim denenir, Then RLS açık ve anon/authenticated politikası bulunmayan tabloya yalnız servis rolü erişebilir. Anon/authenticated hiçbir önbellek satırı okuyamaz, ekleyemez, değiştiremez veya silemez.

22. **AC-S2 [Critical]** Given kalıcı önbelleğe yazılan mesaj sonucu, When tablo satırı ve yazım payload’ı incelenir, Then içerik olarak yalnız hash, `parsed`, `is_listing` bulunur. Ham mesaj metni, grup, kullanıcı, telefon veya URL için ayrı alan bulunmaz. Sürüm ve TTL için gerekli teknik metadata tutulabilir. `parsed.description` içindeki kişisel veri AC-S1 ve AC-S5 ile korunur.

23. **AC-S3 [Critical]** Given mesaj, telefon, URL, hash veya bunları içerebilen model/DB hata yanıtları, When başarı ve hata yolları log üretir, Then bu değerler loglarda bulunmaz. Hatalar güvenli neden kodu ve hata sınıfıyla izlenir. Parser’ın mevcut ham model yanıtı ve serbest hata metni logları da bu kurala uyar.

24. **AC-S4 [Critical]** Given kişisel mesaj için sıcak pozitif veya negatif önbellek ve seçili olmayan grup, When `handle_message` çağrılır, Then `is_group_selected` parse ve önbellek erişiminden önce çalışır, parser çağrılmaz ve `"personal_unselected"` döner. Seçim sorgusu hata verirse `"personal_selection_check_error"` döner, parser çağrılmaz. İlgili mevcut sayaçlar artar.

25. **AC-S5 [Critical]** Given kişisel veri içerebilen pozitif önbellek kaydı, When TTL dolar, Then kayıt LRU ve Supabase okumalarında kullanılmaz ve periyodik temizlemeyle kalıcı tablodan silinir. Temizleme çalışması ve hatası içeriksiz olarak gözlenir. Temizleme hatasında süresi dolmuş kaydın kullanımı engellenmeye devam eder.

26. **AC-S6 [High]** Given çok sayıda benzersiz veya çok uzun mesaj, When başarılı sonuçlar kalıcı önbelleğe yazılır, Then serileştirilmiş `parsed` 8 KB'ı aşan kayıt kalıcı önbelleğe yazılmaz (sonuç yine döndürülür) ve `cache_error{operation=write,reason=too_large}` artar; tablo büyümesi TTL + periyodik temizlikle (AC-S5) sınırlanır.

27. **AC-S7 [Critical]** Given oturumlu bir kullanıcının JWT'si, When önbellek tablosuna doğrudan PostgREST okuma veya yazma isteği gönderilir, Then okuma satır döndürmez, yazma 42501 ile reddedilir ve hiçbir satır eklenmez; kural DB'de (RLS, politika yok) zorlanır. Gerçek Supabase'de authenticated kimlikle doğrulanır.

## Threat Model

Tetikleyici VAR. Görev mesaj metni ve telefon içerebilen `parsed.description`, Supabase servis rolüyle DB erişimi ve dış Gemini API’si içerir.

Sağlanan threat-model kararı bu belgeye işlendi, AC-S1–AC-S5 Acceptance Criteria listesine eklendi. `threat-model` skill'i çalıştırıldı (2026-11-12): AC-S6 (tablo boyutu) ve AC-S7 (doğrudan REST erişimi) eklendi. Önbellek satırlarının sahibi olmadığından kullanıcı bazlı sahiplik filtresi uygulanamaz; erişim yalnız servis rolüyle, dış erişim AC-S1/AC-S7 ile DB'de kapalı. `authz-test`, migration uygulandıktan sonra `verify` aşamasında AC-S1/AC-S7 için koşulacak.

- Kalıcı kişisel veri erişimi RLS ve servis rolü sınırıyla korunur.
- Ham mesajın önbellekte çoğaltılması engellenir.
- Log sızıntısı başarı, JSON hatası, timeout ve DB hata yollarında sınanır.
- Kişisel grup seçimi sıcak önbellekle birlikte doğrudan test edilir.
- TTL okuma kontrolü ve fiziksel retention temizliği ayrı ayrı doğrulanır.
- Servis rolü anahtarı mevcut sunucu/container sınırında kalır.

## Davranış Sözleşmesi (hangi durumda ne döner)

Aşağıdaki `D`, somut Python dönüş örneğidir.

```python
D = {
    "is_listing": True,
    "title": "Satılık daire",
    "price": 2500000,
    "currency": "TRY",
    "rooms": "3+1",
    "area_m2": 120,
    "city": "İstanbul",
    "district": "Kadıköy",
    "neighborhood": None,
    "description": "Temiz daire",
}
```

Her satırdaki “Doğrudan tetikleme” gerçek koşulun testte oluşturulmasını gerektirir. Ortak yoldaki `handle_message` başarılı yazım sonrasında da mevcut sözleşmesi gereği `None` döner. Tablodaki `D` parser sonucudur.

| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Yeni ilan, cache miss, regex kısmi. Doğrudan tetikleme | Parser `D` | Normalde 1 Gemini çağrısı, başarılı sonuç önbelleğe yazılır | Operatör `cache_miss +1`, `regex_partial +1`, `gemini_call +1` ve süreler görür | AC-1 |
| 2 | Normalize aynı metin, geçerli pozitif kayıt. Doğrudan tetikleme | Parser `D` kopyası | Gemini çağrılmaz | `cache_hit{layer} +1` | AC-2, AC-3, AC-18 |
| 3 | Ön-elemede açık ilan olmayan mesaj. Doğrudan tetikleme | `None` | Gemini çağrılmaz, 24 saat negatif kayıt yazılır | `cache_miss +1`, `prefilter_rejected +1` | AC-5 |
| 4 | Regex ve mevcut deterministik kurallar tam geçerli çıktı üretir. Doğrudan tetikleme | Parser `D` | Gemini çağrılmaz, pozitif kayıt yazılır. Koşul sağlanmıyorsa model yolu kullanılır | `cache_miss +1`, `regex_only +1` | AC-7 |
| 5 | LRU miss ve Supabase okuma hatası. Doğrudan tetikleme | Yeniden ayrıştırmaya göre `D` veya `None` | Normal ön-eleme/regex/Gemini akışı sürer | `cache_error{operation=read} +1`, `cache_miss +1` ve kullanılan yolun sayaçları | AC-9 |
| 6 | Gemini timeout veya ağ hatası. Doğrudan tetikleme | `None` | Sonuç hiçbir önbelleğe yazılmaz | Gerçek istek için `gemini_call +1`, `gemini_error +1`, güvenli neden ve süre | AC-10, AC-11 |
| 7 | Regex kısmi ve Gemini hatalı. Doğrudan birleşik tetikleme | `None` | Eksik ilan döndürülmez, önbelleğe yazılmaz | `regex_partial +1`, `gemini_call +1`, `gemini_error +1` | AC-1, AC-10 |
| 8 | Bozuk/şema dışı önbellek kaydı. Doğrudan tetikleme | Yeniden ayrıştırmaya göre `D` veya `None` | Kayıt yok sayılır, mümkünse silinir | `cache_invalid +1`, `cache_miss +1`, silme hatasında `cache_error{operation=delete}` | AC-9, AC-12 |
| 9 | Geçerli negatif önbellek kaydı. Doğrudan tetikleme | `None` | Gemini çağrılmaz | `cache_hit{layer} +1` | AC-2, AC-4 |
| 10 | TTL dolmuş veya sürümü eski kayıt. Her sürüm ve sınır zamanı doğrudan tetiklenir | Yeniden ayrıştırmaya göre `D` veya `None` | Eski kayıt kullanılmaz, başarılı sonuçla yenilenir | `cache_miss +1` ve kullanılan yolun sayaçları | AC-4, AC-S5 |
| 11 | Başarılı parse sonrasında önbellek yazım hatası. Doğrudan tetikleme | `D` | İşleme devam edilir, mümkünse LRU tutulur | `cache_error{operation=write} +1` ve başarılı yolun sayaçları | AC-9 |
| 12 | Gemini başarıyla `is_listing=false` döndürür. Doğrudan tetikleme | `None` | Negatif sonuç 24 saat önbelleğe alınır | `gemini_call +1`, `cache_miss +1` | AC-4, AC-12 |
| 13 | Regex/Gemini çelişkisi; bilinen alan dayatılmadan yapılan ek tam ayrıştırma çözer (regex ile hâlâ farklı olsa da modelin doğrulanmış sonucu kazanır). Doğrudan tetikleme | Modelin doğrulanmış `D`'si (regex ile birleştirilmez) veya doğrulanmış ilan olmayan sonuç için `None` | En fazla bir ek tam ayrıştırma; ilan → pozitif, ilan değil → negatif önbellek | `regex_conflict +1`, her gerçek istekte `gemini_call +1` | AC-8 |
| 14 | Çelişkide ek tam çağrı başarısızdır (hata/timeout/geçersiz çıktı). Doğrudan birleşik tetikleme | `None` | Önbelleğe yazılmaz | `regex_conflict +1`, çağrı sayaçları, `gemini_error` | AC-8, AC-10 |
| 15 | Bayrak kapalı. Doğrudan tetikleme | Mevcut parser sonucuna göre `D` veya `None` | Üç optimizasyon atlanır | Mevcut operasyonel kayıtlar, içerik sızdırmayan hata logları | AC-16, AC-S3 |
| 16 | Cache hit ortak veya seçili kişisel akışta ilerler. İki yol ayrı tetiklenir | Parser `D`; ortak handler `None`; kişisel handler mevcut sonuç anahtarı | Quality gate, fingerprint ve yetki/yazım kontrolleri çalışır | `cache_hit +1` ve mevcut akış sayaçları/logları | AC-17, AC-S4 |
| 17 | Gemini bozuk JSON veya geçerli JSON içinde yanlış tür döndürür. Her hata doğrudan tetiklenir | `None` | Negatif kayıt yazılmaz | `gemini_call +1`, `gemini_error{reason=json_invalid|schema_invalid}` | AC-10, AC-12 |
| 18 | Kullanılabilir Gemini anahtarı yok. Doğrudan tetikleme | `None` | Gemini istemcisi ve istek oluşturulmaz, önbelleğe hata yazılmaz | `gemini_error{reason=no_key}`, `gemini_call` artmaz | AC-10 |
| 19 | 429 sonrasında sonraki anahtar başarılı. Doğrudan tetikleme | `D` | Mevcut rotasyon, başarılı sonuç için cache write | Her gerçek çağrı için `gemini_call`, 429 için `gemini_error`, mevcut rotasyon kaydı | AC-11 |
| 20 | Tüm anahtarlar 429 ile tükenir. Doğrudan tetikleme | `None` | Deneme bütçesinde sonlanır, negatif kayıt yazılmaz | Gerçek çağrı ve hata sayıları, güvenli tükenme nedeni | AC-10, AC-11 |
| 21 | Nullable alanlar metinde yok. Her alan parametrik tetiklenir | Örneğin `{"is_listing": True, "title": None, "price": None, "currency": None, "rooms": None, "area_m2": None, "city": None, "district": None, "neighborhood": None, "description": None}` | Mevcut kalite skoru uygulanır, eksikler tahmin edilmez | Parser yol sayaçları, mevcut quality-score/issues kaydı | AC-12, AC-13 |
| 22 | Sıcak cache ve kişisel grupta seçim yok. Doğrudan birleşik tetikleme | Handler `"personal_unselected"` | Parser/cache çağrılmaz, ilan yazılmaz | `personal_unselected +1`, mevcut kişisel sonuç logu | AC-S4 |
| 23 | Sıcak cache ve kişisel seçim sorgusu hatalı. Doğrudan birleşik tetikleme | Handler `"personal_selection_check_error"` | Parser/cache çağrılmaz, ilan yazılmaz | `personal_selection_check_error +1`, içeriksiz mevcut uyarı | AC-S4 |
| 24 | TTL temizleme başarılı veya DB hatalı. İki dal doğrudan tetiklenir | Parser çağrılmadığından parser dönüşü yok; sonraki parse `D` veya `None` | Başarıda süresi dolan kayıtlar silinir, hatada kullanılmaları yine engellenir | İçeriksiz temizleme zamanı/silinen kayıt sayısı veya `cache_error{operation=cleanup}` | AC-S5, AC-19 |
| 25 | LRU kapasitesi aşılır veya dönen dict değiştirilir. Doğrudan tetikleme | Sonraki parse doğru `D` veya `None` | En fazla 1.000 kayıt, önbellek içeriği çağıranın mutasyonundan korunur | Sonraki `cache_hit{layer}` veya `cache_miss`, süreler | AC-3, AC-18 |

**Kısmi başarı**

Regex başarılı, model başarısızsa `None` döner ve sonuç saklanmaz. Parse başarılı, kalıcı önbellek yazımı başarısızsa `D` döner ve normal ilan işleme sürer. Önbellek yazımı ilan yazımından bağımsız hızlandırıcı yan etkidir.

**Hiçbir şey yapılamadı ama hata da yok**

Doğrulanmış ilan olmayan mesaj `None` döndürür. Ön-eleme veya negatif cache isabeti sayacı bu sonucu görünür kılar. Boş mesaj doğrudan parser’a verildiğinde ön-eleme sınanır. Mevcut webhook ve handler boş metni parser’dan önce eleyebildiğinden webhook testi tek başına bu kriterin kanıtı sayılmaz.

**Boş sonuç ↔ hata ayrımı**

Mevcut dış imza `Optional[Dict[str, Any]]` korunur. İlan olmayan sonuç ile teknik hata dışarıya `None` dönebilir. İç işlem sonucu ve içeriksiz neden kodları ikisini ayırır. Yalnız doğrulanmış ilan olmayan sonuç negatif önbelleğe yazılır. Kişisel handler’ın mevcut `personal_not_listing` iş anlamı korunur, teknik ayrım parser loglarından izlenir.

**LLM çağrısı varsa**

- **(a)** Uygulama tarafı doğrulama AC-12’deki on alanlı sözleşmeyi uygular. JSON geçerli olsa bile yanlış tür, eksik/geçersiz `is_listing` veya sonlu olmayan sayı `None` üretir ve saklanmaz. `{"is_listing": false}` mevcut test davranışıyla uyumlu başarılı negatif sonuçtur, eksik nullable alanlar `None` kabul edilir. Sayısal aralıklar mevcut quality gate tarafından değerlendirilir.
- **(b)** AC-14 kapsamında güvenilir regex bulguları ile güvenilmeyen mesaj ayrı veri bloklarında gönderilir. Kullanıcı içeriğindeki talimatları yok sayma talimatı kısmi isteğin güvenilir bölümünde bulunur. Delimiter benzeri kullanıcı girdisi doğrudan test edilir. `system_instruction` SDK alanına geçiş yapılmaz.
- **(c)** AC-15 kapsamında mesaj başına tek nesne kullanılır. Index/sıra numarası protokole dahil edilmez.

HTTP durum kodu parser sözleşmesine uygulanmaz. Yeni UI davranışı talep edilmediğinden nullable alanlar için yeni ekran metni tanımlanmaz. Parser `None` değerlerini mevcut tüketicilere geçirir, kalite kapısındaki eksik alan davranışı sınanır.

## Test Strategy

Unit %75. Normalizasyon/hash, sürümlendirme, LRU kapasitesi ve mutasyon izolasyonu, TTL sınırları, ön-eleme, regex belirsizliği, alan birleştirme, çelişki, çıktı doğrulaması, bayrak, hata yolları ve içeriksiz loglar.

Integration %20. Gerçek Supabase üzerinde kalıcı önbellek CRUD, RLS/rol erişimi, TTL, retention temizliği, yeniden başlatma sonrası isabet ve paralel yazım. Orchestrator ile parser’ın birlikte çalıştığı ortak/kişisel akışlar ve sıcak cache ile seçim reddi/hatası ayrıca doğrulanır.

E2E %5. Webhook üzerinden farklı mesaj ID’leri/gruplarla aynı ilan, seçili kişisel akış, seçim kaldırıldıktan sonra sıcak cache ve bayrak kapalı geri dönüş senaryoları. Normal giriş noktalarındaki sonuçlar, kayıtlar ve çağrı sayıları birlikte doğrulanır.

Toplam %100.

- Critical kriterler önce yazılır.
- `scraper/tests/test_parser.py` ve `test_parser_timeout.py` mevcut regresyon kaynağıdır. Mock hedefi `parser.genai` olur. Rotasyon testlerinde gerçek `GeminiKeyManager` davranışı kullanılır.
- Mevcut örneklerden biri girişte `2+1`, model cevabında `3+1` içerir. Bayrak kapalı test mevcut sonucu doğrular, bayrak açık test aynı girdiyi çelişki olarak doğrudan ele alır.
- `test_fingerprint.py`, `test_insert_raw_listing.py`, `test_orchestrator_dedup.py`, `test_personal_ingest.py` ve `test_personal_counters.py` regresyon kapsamına alınır.
- Gerçek Supabase testleri mevcut `--run-integration` veya `RUN_INTEGRATION=1` mekanizmasıyla çalıştırılır. Atlanan test kabul kanıtı sayılmaz.
- RLS, TTL ve temizleme yalnız SQL metni aramasıyla doğrulanmaz. Gerçek rollerle erişim ve süre dolmuş satırla temizleme tetiklenir.
- Bu belge hazırlanırken test çalıştırılmadı. Mevcut test dosyaları okunarak strateji çıkarıldı.

## Benchmark / Başarı Ölçütü

**Coverage Target**

Değişen parser kodunda branch coverage ≥%90. Satır coverage tek başına yeterli değildir.

**Performance Target**

Optimizasyonun eklediği normalizasyon, LRU, kalıcı cache erişimi, ön-eleme, regex, doğrulama ve cache yazım sürelerinin toplamı için p95 ≤100 ms. Gemini bekleme süresi ayrı ölçülür. Ortam, örnek sayısı ve sıcak/soğuk cache dağılımı raporda bulunur.

**Memory**

Süreç başına LRU en fazla 1.000 kayıt. Bayt/MB hedefi tanımlanmamıştır. Benchmark tepe bellek kullanımını raporlar.

**Diğer ölçülebilir kriterler**

- Aynı sabit mesaj kümesinde `100 × (baseline_calls - optimized_calls) / baseline_calls ≥40`.
- Her gerçek SDK isteği, retry ve çelişki fallback çağrısı toplama dahil edilir.
- Başlangıçta soğuk cache ile tüm veri kümesi oynatılır. Sıcak cache ve yeniden başlatma deneyleri ayrıca raporlanır.
- Kümenin normalize tekrar oranı, ilan/ilan olmayan dağılımı ve grup dağılımı belirtilir. Çağrı azalmasının tekrar oranına bağlı olduğu açıkça yazılır.
- Ön-eleme yanlış negatifi `reddedilen gerçek ilan / toplam gerçek ilan = %0`.
- Etiketli sette ilan sınıflandırma ve açık fiyat/para birimi, alan, oda doğruluğu baseline’a göre gerilemez.
- Pozitif TTL 7 gün, negatif TTL 24 saat ve tam sona erme anı kontrollü saatle sınanır.
- API kullanımından sağlanabiliyorsa giriş/çıkış tokenları ayrıca raporlanır. Çağrı azalması doğrudan parasal tasarruf yüzdesi olarak sunulmaz.
- Yeni UI/görsel değişiklik yoktur.

## Kapsam Dışı

- Batch API, model değişimi ve context caching.
- `system_instruction`, `response_schema`, token sınırı ve thinking ayarları.
- Sahibinden/Facebook kaynakları.
- Mevcut fingerprint normalizasyonu, alanları ve dedup mantığının değiştirilmesi.
- Kalite kapısı eşikleri, ilan sahipliği, kişisel RPC kararları ve mevcut iş sayaçlarının yeniden tasarlanması.
- Yeni sayaç tablosu ve UI geliştirmesi.

## Etkilenen Dosyalar/Modüller (bilinen)

- `scraper/parser.py` mevcut `parse_listing_message` async imzasını koruyarak optimizasyon girişini barındırır. Mevcut kod senkron `generate_content` çağırır, model `gemini-3.8-flash`, HTTP timeout 30.000 ms’dir. `_extract_json` süslü parantezli JSON arar ve çıktı türlerini kapsamlı doğrulamaz.
- `scraper/supabase_client.py` servis rolü istemcisiyle kalıcı cache erişimi ve best-effort hata davranışı için etkilenir.
- `scraper/orchestrator.py` ortak/kişisel girişlerin ve parse öncesi seçim kontrolünün entegrasyon/regresyon kapsamındadır. Ortak yolda fingerprint kontrolü kalite skorundan önce, Gemini çağrısından sonra yapılır.
- `scraper/fingerprint.py` uyumluluk referansıdır. Şehir, ilçe, oda, fiyat ve alan üzerinden SHA-256 üretir. Konum/oda normalizasyonunda lower, NFKD ve boşluk kaldırma kullanır. Yeni mesaj hash’i kendi NFC kurallarını uygular.
- `scraper/quality_gate.py` uyumluluk referansıdır. Eksik fiyat skoru 0,1, eksik şehir 0,3 düşürür. Fiyat, alan ve oda biçimi sorunlarını puanlar, tek başına ilan sınıflandırması yapmaz.
- `scraper/.env.example` yeni bayrağın açık dağıtım yapılandırmasını belgeler. Mevcut örnekte bu bayrak bulunmuyor.
- `scraper/tests/` parser, timeout, fingerprint, dedup, kişisel akış ve Supabase testlerini içerir. Yeni deterministik ve gerçek altyapı senaryoları bu kapsamda yer alır.
- `supabase/migrations/` içinde okuma anındaki en yüksek numara **0030**’dur. Son ileri migration `0030_support_messages.sql`, karşılığı `0030_support_messages.down.sql` dosyasıdır. Yeni cache migration’ı için **0031** adaydır, uygulama öncesinde sıra tekrar kontrol edilir.
- `0030_support_messages.sql` RLS açık ve anon/authenticated politikasız tablo örneği içerir. Önbellek tablosunun erişimi ayrıca doğrulanır.
- `scraper/tests/conftest.py` gerçek Supabase testlerini varsayılan olarak atlar.

Yeni cache modülünün adı, tablo adı ve temizleme mekanizmasının yerleşimi plan aşamasında belirlenir.

## Proje Ortamı Kısıtı (arama/grep kapsamı)

`git rev-parse --show-toplevel` sonucu gerçek Git kökünü `C:/Users/kuyus/OneDrive/Belgeler/Masaüstü/projelerim/emlak-platform` olarak doğruladı. Bu oturumda Git kökü proje klasörüyle eşleşiyor.

Sonraki aramalar bu proje klasörüyle sınırlandırılmalıdır. Bu ortamda `rg` bulunmadığından dosya listesi ve metin aramaları PowerShell araçlarıyla gerçekleştirildi. Geniş Git geçmişi taraması yapılmadı.

Oturum read-only’dır. Kod, migration, önbellek ve harici kayıt değiştirilmedi.

## Rollback Beklentisi

`GEMINI_PARSE_OPTIMIZATION_ENABLED=false` mevcut ayrıştırma yoluna döndürür. Bayrak kapalıyken önbellek okuma/yazma, ön-eleme ve regex optimizasyonları çalışmaz.

Kalıcı cache tablosunun arızası normal parse akışını engellemez. Migration geri alınmadan önce bayrak kapatılır. Cache tablosunun kaldırılması mevcut ilan kayıtlarını etkilememelidir.

Rollback sırasında kalıcı kişisel veri retention sorumluluğu devam eder. Kullanılmayan cache kayıtları temizlenir veya cache tablosu geri alma işlemiyle kaldırılır.

## Risks

- Gereğinden agresif ön-eleme gerçek ilanları kaybettirebilir.
- Türkçe fiyat yazımları, net/brüt alanlar ve birden çok oda/fiyat adayı regex çelişkisi yaratabilir.
- `parsed.description` telefon ve kişisel veri içerebilir. Hash kullanımı bu alanın erişim ve retention gereksinimini ortadan kaldırmaz.
- Parser şu anda bozuk JSON yanıtının ilk 200 karakterini ve sağlayıcı hata metnini loglayabilir. Bu yollar AC-S3 kapsamında düzeltilmelidir.
- Supabase ağ gecikmesi p95 hedefini aşabilir. Cache erişiminin bekleme bütçesi ve hata fallback’i ölçülmelidir.
- On worker farklı event loop’larda parser çağırır. Paylaşılan LRU ve senkron SDK erişimi thread güvenliği gerektirir.
- Eşzamanlı soğuk istekler aynı metin için birden fazla model çağrısı başlatabilir. Kalıcı önbellek tek başına süreçler arası çağrı birleştirmesi sağlamaz.
- Farklı boşluk biçimlerinin aynı hash’e gitmesi, `description` metninin ilk başarılı ayrıştırmadan yeniden kullanılmasına yol açabilir.
- Güncel test yorumlarının bazıları timeout’u henüz eklenmemiş olarak anlatır. Gerçek parser kodunda timeout zaten vardır.
- Ek tam ayrıştırma ve 429 retry’ları bazı mesajların çağrı sayısını artırabilir.

- **Kabul edilen risk:** Benzersiz mesajların Gemini maliyeti bu görevle değişmez; kota/rate limit ayrı iş.
- **Kabul edilen risk:** KVKK silme talebinde `parsed.description` en fazla 7 gün + temizlik aralığı önbellekte kalabilir; hedefli silme yolu yok, gerekirse tablo tümüyle boşaltılabilir (yalnız hızlandırıcı).

## Assumptions

- **Varsayım** Öncelik `high` seçildi.
- **Varsayım** Bayrak tanımsızsa kapalı kabul edilir. Dağıtımda açıkça `true` verilerek etkinleştirilir.
- **Varsayım** Yeni mesaj hash’i SHA-256 olur ve anahtar model/şema/parser sürümüyle birlikte değerlendirilir.
- **Varsayım** Kalıcı kayıtta hash, parsed ve is_listing yanında sürüm, oluşturulma ve sona erme zamanları gibi teknik metadata tutulması ham mesaj saklamama kararıyla uyumludur.
- **Varsayım** Periyodik retention temizliği en geç saatlik çalışır. Başarılı çalışan sistemde süresi dolan kayıt bir sonraki saatlik koşumda silinir. Temizleyici arızasında TTL okuma reddi sürer ve hata görünür olur.
- **Varsayım** Selamlaşma/teşekkür ön-elemesi tam mesaj eşleşmesine dayalı sınırlı bir listeyle uygulanır. Kısa mesajın kesin uzunluk sınırı plan sırasında belirlenir.
- **Varsayım** Mevcut deterministik kurallar ilan niteliğini ve konumu tam doğrulamadığından başlangıç uygulamasında `regex_only` sayısı sıfır olabilir.
- **Varsayım** Çelişkide “en fazla bir ek çağrı” bir ek mantıksal tam ayrıştırmayı ifade eder. Bu çağrı da mevcut sınırlı 429 rotasyonunu kullanır ve tüm gerçek istekler ayrı sayılır.
- **Varsayım** Süreçler arası dağıtık kilit bu görev için zorunlu tutulmaz. Eşzamanlı soğuk cache davranışı benchmark’ta açıkça raporlanır.
- **Varsayım** Kabul kanıtı etiketli benchmark, deterministik testler ve gerçek Supabase doğrulamalarından oluşur. Nihai ürün kabulünü platform sahibi yapar.

## Unknowns

- Temsili benchmark kümesinin kaynağı, boyutu, tekrar oranı ve etiketleme sorumlusu henüz belirlenmedi.
- Gerçek Supabase test ortamı, anon/authenticated test kimlikleri ve katalog erişimi bu oturumda doğrulanmadı.
- Periyodik temizliğin DB scheduler, mevcut scheduler veya worker mekanizmasıyla çalıştırılacağı henüz belirlenmedi.
- Kalıcı cache erişimi için timeout bütçesi ve p95 ölçümünün koşulacağı ortam belirlenmedi.
- Kısmi model isteğinin alan bazlı yanıt biçimi ve sürümleme sabitlerinin yerleşimi plan aşamasında kesinleştirilecek.
- Yeni migration uygulanırken 0031 numarasının hâlâ boş olup olmadığı kontrol edilecek.
- Süreç içi aynı anahtarlı eşzamanlı isteklerin tek çağrıda birleştirilmesine ihtiyaç, gerçek tekrar yoğunluğu ölçülerek değerlendirilecek.
- Değişen parser kodunun branch coverage ölçüm aracı ve rapor kapsamı mevcut CI ile eşleştirilecek.

## Sorular ve Cevaplar (ham kayıt)

Sağlanan 4z yanıtları kullanıldı, sorular yeniden sorulmadı.

1. Persona kimdir? → **Persona: platform sahibi/operatör; emlakçının mevcut akışı korunur.** (Codex tarafından yanıtlandı: Değişikliğin amacı aynı ilan kalitesini daha az Gemini çağrısıyla sağlamaktır.)

2. Önbellek nerede tutulmalıdır? → **(c) Bellek LRU + Supabase kalıcı önbellek; ham mesaj saklanmaz.** (Codex tarafından yanıtlandı: LRU hızlı tekrarları, Supabase yeniden başlatmalar ve süreçler arasındaki tekrarları karşılar; `parsed.description` da kişisel veri içerebileceğinden kalıcı kayıtta erişim ve süre sınırı uygulanmalıdır.)

3. Mesaj nasıl normalize edilmelidir? → **Unicode NFC, baş/son boşluk temizliği ve ardışık boşlukları birleştirme; harf, emoji, noktalama, telefon ve URL korunur.** (Codex tarafından yanıtlandı: Daha agresif normalizasyon fiyat/oda anlamını veya `description` içeriğini değiştirebilir; farklı telefonlar farklı hash üretmelidir.)

4. Hangi sonuçlar ne kadar saklanmalıdır? → **Başarılı “ilan değil” sonuçları da önbelleğe alınır; pozitif TTL 7 gün, negatif TTL 24 saat, LRU en fazla 1.000 kayıt olur.** (Codex tarafından yanıtlandı: Tekrarlayan gereksiz çağrılar engellenirken yanlış sınıflandırmaların uzun süre kalması sınırlandırılır ve model/şema/ayrıştırıcı sürümü değişince önbellek geçersizleşir.)

5. Ön-eleme hangi mesajları reddetmelidir? → **Ön-eleme yalnız boş metinleri ve açıkça selamlaşma/teşekkürden oluşan kısa mesajları reddeder; belirsiz mesajlar modele gider.** (Codex tarafından yanıtlandı: Yalnız uzunluk ve anahtar kelime yokluğuyla ret vermek gerçek ilanları kaçırabileceğinden yanlış negatif hedefi doğrulama kümesinde %0 olmalıdır.)

6. Regex hangi alanları çıkarmalı ve model ne zaman çağrılmalıdır? → **Regex yalnız açık ve tek anlamlı `price+currency`, `area_m2`, `rooms` değerlerini çıkarır; mevcut kurallarla geçerli tam çıktı üretilemedikçe Gemini çağrılır.** (Codex tarafından yanıtlandı: Bu üç alan tek başına ilan niteliğini ve konumu doğrulamaz; model kalan alanları tamamlar, açık regex değerleri korunur, çelişki belirsizlik sayılarak mevcut tam ayrıştırmaya en fazla bir ek çağrı yapılır.)

7. Model üretim ayarları değiştirilecek midir? → **`system_instruction`, `response_schema`, token sınırı ve thinking ayarları bu görevde kapsam dışıdır.** (Codex tarafından yanıtlandı: Bunlar ayrı uyumluluk ve çıktı kalitesi doğrulaması gerektirir; bu görev önbellek, ön-eleme ve kısmi regex çıkarımıyla sınırlı kalmalıdır.)

8. Önbellek ve model hatalarında ne yapılmalıdır? → **Önbellek hataları işlemi durdurmaz; kısmi regex sonucu tek başına döndürülmez; Gemini hata/timeout sonucu önbelleğe yazılmaz.** (Codex tarafından yanıtlandı: Önbellek yalnız hızlandırıcıdır ve altyapı/model hatasının kalıcı “ilan değil” sonucuna dönüşmesi engellenmelidir.)

9. Operatör hangi kayıtları görmelidir? → **İçeriksiz yapılandırılmış loglarda `cache_hit{layer}`, `cache_miss`, `cache_error{operation}`, `cache_invalid`, `prefilter_rejected`, `regex_partial`, `regex_only`, `gemini_call`, `gemini_error`, `regex_conflict` ve süreler tutulur.** (Codex tarafından yanıtlandı: Yeni sayaç tablosu gerekmeksizin maliyet etkisi izlenebilir; mevcut `bump_sidecar_counter` iş anlamı korunur, mesaj/telefon/URL/hash loglanmaz.)

10. Başarı hedefleri nelerdir? → **Temsili tekrar içeren mesaj kümesinde Gemini çağrısı ≥%40 azalmalı; ön-eleme yanlış negatifi %0, ek işlem gecikmesi p95 ≤100 ms, değişen parser kodunda branch coverage ≥%90 olmalıdır.** (Codex tarafından yanıtlandı: Bunlar varsayılan kabul hedefleridir; çağrı azalması aynı veri kümesindeki mevcut akışla karşılaştırılmalı ve tekrar oranına bağlı olduğu açıkça raporlanmalıdır.)

11. Hangi işler kapsam dışıdır? → **Batch API, model değişimi, context caching, sahibinden/Facebook kaynakları ve mevcut fingerprint mantığının değiştirilmesi kapsam dışıdır.** (Codex tarafından yanıtlandı: Onaylanan kapsam yalnız WhatsApp mesajlarının ayrıştırma maliyetine odaklanır.)

12. Test oranı ve geri dönüş nasıl olmalıdır? → **Test oranı yaklaşık %75 unit / %20 integration / %5 e2e; `GEMINI_PARSE_OPTIMIZATION_ENABLED=false` mevcut ayrıştırma yoluna döndürür.** (Codex tarafından yanıtlandı: Mantığın çoğu deterministik test edilebilirken gerçek Supabase TTL/erişim hataları ve ortak/kişisel akışlar ayrıca doğrulanmalıdır; bayrak dağıtımda açıkça etkinleştirilir.)