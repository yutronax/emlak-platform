# AC-20 / F4 Benchmark Raporu — gemini-parse-maliyet
_Tarih: 2026-11-12 · Betik: `bench.py` · Küme: `dataset.json` · Ham sonuç: `results.fake.json`_

## Özet
| AC-20 ölçütü | Hedef | Sonuç | Durum |
|---|---|---|---|
| Gemini çağrı azalması (temsili akış) | ≥%40 | **%48,3** (58 → 30) | GEÇTİ, *koşullu*: tamamen tekrar oranına bağlı |
| Gemini çağrı azalması (tekrarsız akış) | — | **%0** (30 → 30) | bilgi |
| Ön-eleme yanlış negatifi | %0 | **%0** (0/20 ilan) | GEÇTİ |
| Ek işlem gecikmesi p95 | ≤100 ms | soğuk **2.987 ms**, yeniden başlatma **1.269 ms**, sıcak LRU **0,02 ms** | **KALDI** |
| Branch coverage (değişen kod) | ≥%90 | parser %92,5 · regex %90 · diğerleri %100 · toplam **%93,8** | GEÇTİ |
| Sonuç kalitesi (gerçek model) | baseline'dan gerilemez | **ÖLÇÜLEMEDİ** — Gemini kotası dolu | AÇIK |
| Bellek | LRU ≤1.000 | LRU 30 kayıt, tracemalloc tepe 3,3 MiB | GEÇTİ |

**Sonuç: AC-20 karşılanmadı.** Gecikme hedefi kalıyor, kalite ölçülemedi. Bayrak (`GEMINI_PARSE_OPTIMIZATION_ENABLED`) kapalı kalmalı.

## Ortam
- Windows 11, Python 3.11.9, scraper/.venv-verify. Supabase: canlı proje (gerçek ağ). Model adı: `gemini-3.8-flash`.
- **Gemini SAHTE**: etikete göre doğru yanıt veren, sabit 600 ms gecikmeli model (`BENCH_FAKE_GEMINI=1`). Çağrı sayısı, ek gecikme (Gemini süresi çıkarılarak ölçülür) ve bellek modelin içeriğinden bağımsızdır; bu yüzden geçerli. Kalite bu modla ÖLÇÜLMEZ (etiketi döndürdüğü için gerileme sıfır çıkar; kanıt değildir).
- Benchmark önbellek kayıtları ayrı `CACHE_VERSION` (`bench-…`) ile yazıldı, sonda silindi (60 satır).

## Veri kümesi (sentetik — canlıda yalnız 1 raw_listings kaydı var)
- 30 farklı mesaj: 20 ilan, 10 ilan olmayan. Elle etiketlendi; yalnız metinde açıkça yazan alanlar etiketli (net/brüt, `3+1+1` gibi belirsizler etiketsiz).
- Temsili akış: 58 mesaj, normalize tekrar oranı **%48,3** (aynı ilanın birden çok gruba iletilmesi, boşluk farklı iletimler, tekrar eden selamlaşmalar). 41'i ilan geçişi.
- Grup dağılımı modellenmedi (normalize anahtar grup içermez; azalmayı etkilemez).
- **Gerçek WhatsApp gruplarının tekrar oranı bilinmiyor.** %48,3 bir varsayımdır; gerçek oran ölçülmeden tasarruf tahmin edilemez.

## Bulgular
1. **Azalma = tekrar oranı.** Temsili akışta %48,3 azalma, akışın tekrar oranıyla birebir aynı. Tekrarsız akışta %0. Kazancın neredeyse tamamı önbellekten geliyor; ön-eleme ve regex çağrı kesmiyor (aşağıdaki 2. madde ile birbirini götürüyor).
2. **Talep mesajları 2 çağrıya mal oluyor.** "Kadıköy'de 2+1 kiralık arayan müşterim var, 20.000 TL'ye kadar" → regex fiyat+oda çıkarıyor, model "ilan değil" diyor → AC-8 gereği çelişki → ek tam çağrı. Gerçek gruplarda "arayan var mı" mesajları sık; bu mesajlarda optimizasyon maliyeti **artırıyor**. Ön-elemenin kurtardığı tek çağrıyı (N02 "Teşekkürler") bu götürdü.
3. **Gecikme hedefi Supabase gidiş-dönüşü yüzünden tutmuyor.** Bu makineden ölçüm (p50): yeni istemci 163 ms, aynı istemciyle sorgu 306 ms, yeni istemci + sorgu (bugünkü kod) **893 ms**. Soğuk önbellek ıskasında okuma + yazma var → p95 ~3 sn. Yeniden başlatmada (LRU boş, DB dolu) tek okuma → p95 ~1,3 sn. Yalnız sıcak LRU 100 ms altında.
4. **F5 düzeltmesi tek başına yetmez.** İstemciyi yeniden kullanmak işlem başı ~900 → ~300 ms indirir ama tek gidiş-dönüş bile 100 ms hedefinin 3 katı. Hedef, uzak bir veritabanına senkron erişimle bu ağdan karşılanamaz.
5. **Gemini kotası doldu.** İlk (gerçek model) koşum toplam 280 SDK isteği yaptı; rate limit sayılan ilk iki turda 113 isteğin 88'i `429 RESOURCE_EXHAUSTED` aldı; tek anahtar var. Kota bu benchmark sırasında tükendi, büyük olasılıkla benchmark'ın kendisi tüketti → kota sıfırlanana kadar canlı scraper ayrıştırması da başarısız olur. Geçersiz koşumun çıktısı kanıt olarak `results.real.GECERSIZ-kota.json`'da duruyor; hiçbir sonucu kullanılmadı.

## Seçenekler (karar kullanıcıda)
- **A — Gecikmeyi düşür:** istemciyi süreç başına tek tut (F5), DB yazımını arka plana al (yol üstünden çıkar), DB okumasına kısa timeout (ör. 150 ms, aşılırsa ıska say). Beklenen: soğuk ıska ~300 ms, yazma 0 ms. Yine 100 ms'yi geçmez.
- **B — Hedefi gözden geçir:** 100 ms, Gemini'nin kendisi (gerçek p50 bilinmiyor; sahte model 600 ms) yanında ölçülmeden konmuş bir hedef. "Ek gecikme Gemini p50'sinin X%'i" ya da mutlak 400 ms gibi gerçekçi bir hedef atdd'ye yazılabilir.
- **C — Talep mesajı maliyeti:** çelişki kuralını "model ilan değil derse regex'e rağmen kabul et" yönünde değiştirmek talep mesajlarında ek çağrıyı kaldırır (AC-8 değişikliği).
- **Kalite ölçümü:** kota sıfırlanınca ya da ikinci bir anahtar eklenince `bench.py` gerçek modda yeniden koşulmalı (`BENCH_FAKE_GEMINI` olmadan).

## Yeniden çalıştırma
```
cd scraper
BENCH_FAKE_GEMINI=1 python ../obss_project/artifacts/gemini-parse-maliyet/benchmark/bench.py   # çağrı/gecikme/bellek
python ../obss_project/artifacts/gemini-parse-maliyet/benchmark/bench.py                       # + kalite (gerçek Gemini, kota gerekir)
```

## F5 gecikme düzeltmesi sonrası (2026-11-12, "A: Gecikmeyi düşür")
Uygulanan: süreç başına tek önbellek istemcisi, kalıcı okumaya `PARSE_CACHE_READ_TIMEOUT_MS` sınırı, kalıcı yazım/silme arka planda. Testler: 353 geçti (yalnız önceden kararsız webhook testi), canlı integration 9/9. Ölçüm yine sahte Gemini + gerçek Supabase.

| Ek gecikme p95 | Önce | Sonra (300 ms) | Sonra (600 ms) | Sonra (1000 ms) |
|---|---|---|---|---|
| Soğuk önbellek | 2.987 ms | 313 ms | 608 ms | 579 ms |
| Yeniden başlatma (LRU boş, DB dolu) | 1.269 ms | 312 ms | 308 ms | 334 ms |
| Sıcak LRU | 0,02 ms | 0,29 ms | — | — |
| Yeniden başlatmada ekstra Gemini çağrısı (30 farklı mesajda) | 0 | **10** | 0 | 0 |

- Gecikme ~10 kat düştü; 100 ms hedefi bu ağdan yine karşılanmıyor (Supabase gidiş-dönüşü p50 ~306 ms).
- 300 ms sınırı RTT medyanının altında: okumaların bir kısmı kesiliyor ve kalıcı önbellek isabeti Gemini çağrısına dönüşüyor (maliyet artışı). 600 ms'de kayıp sıfır.
- Çağrı azalması (%48,3) ve sonuç doğruluğu (sahte modelle) değişmedi; hata yok; benchmark satırları temizlendi.
- **Karar (kullanıcı): varsayılan 600 ms** (maliyet önceliği). Gerçek sunucunun Supabase'e uzaklığı farklıysa env ile ayarlanır.
- AC-20 durumu: gecikme hedefi (100 ms) hâlâ KALDI; hedefin kendisinin yeniden belirlenmesi gerekiyor. Kalite ölçümü Gemini kotası nedeniyle hâlâ AÇIK.

## Talep mesajı kuralı sonrası (2026-11-12)
Kural: modelin ilk "ilan değil" kararı regex alan bulmuş olsa bile kabul edilir, ek çağrı yok (atdd AC-8, sözleşme satır 12). Testler 355 geçti.

| | Önce | Sonra |
|---|---|---|
| Temsili akış Gemini çağrısı | 30 (%48,3 azalma) | **29 (%50,0)** |
| Tekrarsız akış Gemini çağrısı | 30 (%0) | **29 (%3,3)** |

- Talep mesajı (N04) artık 1 çağrı. Ön-elemenin kazandırdığı çağrı artık götürülmüyor.
- Kalite gerilemesi yok (sahte modelle), hata yok, benchmark satırları temizlendi.
- Bu koşuda yeniden başlatma turunda 3 okuma 600 ms sınırını aştı (önceki 600 ms koşusunda 0); okuma yolu değişmediği için Supabase gecikme dalgalanması. 600 ms de her zaman yetmiyor; ağ yakınlığı (sunucu konumu) belirleyici.
