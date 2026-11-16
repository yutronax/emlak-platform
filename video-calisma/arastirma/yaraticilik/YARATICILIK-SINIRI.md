# Yaratıcılık neden sınırlanıyor, nasıl aşarız — YouTube araştırması (2026-11-16)

Kaynaklar (altyazı dökümünden okundu; Gemini kotası 402 verdi, diğer videoların altyazısı 429 ile indirilemedi):
- Inside the Edit (Patty Bird) — "7 Ways to Avoid Repetitive Editing" https://www.youtube.com/watch?v=4s7WdcyV1H4
- "The 7 Levels of Video Editing" https://www.youtube.com/watch?v=A3ESexsIHuk
- Arama sonuçlarında öne çıkan: "Real Estate Videos Don't Need to Be Complicated" https://www.youtube.com/watch?v=Vz08_9X3LlA (yorumda: "dönen evler, editing gösterisi — evin neye benzediğini hatırlayamadım")

## Videolardan çıkan ilkeler
1. **Azalan getiri yasası:** Bir teknik 1. kez çarpar, 3. kez tahmin edilir, 4. kez sıkar. Sorun teknik değil "değer": aynı kalıbı fazla arz edersen etkisi düşer. (Inside the Edit)
2. **Tekrarlarını kaydet:** Her videoda kullanılan motifleri (ses, kesim ritmi, müzik formülü) yaz, örüntüye bak — kendini denetle.
3. **Yapıyı değiştir:** Yakın aralıkta aynı yapısal tekniği tekrarlama. Geniş planla bitti → yakınla başla; yüksek enerjiyle bitti → yavaş başla.
4. **Kontrast:** Nakarat, kıta sayesinde güçlüdür. Hep zirve yoğunluk = hiçbir şey yoğun değil. Nefes, sessizlik, gerilimi bırakma.
5. **Tekrar şartsa yükselt:** Her tekrar daha büyük/tuhaf/derin olsun; üçüncüsü kalıbı kırsın.
6. **20+ tekniklik envanter, döndür:** Her video/bölümde aynı tekniği bir kez kullan.
7. **Dış göz:** Başkasına "nerede tahmin edilebilir?" diye sordur.
8. **Netlik değil sürpriz:** Bilgiyi sakla, beklentiyle oyna, yanılt.
9. **Hikâye önce (7 Levels):** Sevdiğin kareyi hikâyeye hizmet etmiyorsa göm ya da hikâyeye bağla (gün batımı → kapanışta "gün bitti" ödülü).
10. **Söyleme, hissettir:** Yazıyla anlatma; kurguyla göster (aynı kadrajda zaman/ışık değişimi).
11. **Tarz–içerik uyumu:** Kurgu dili izleyiciye "ne izliyorsun" sinyali verir; tanıtım filmine klip editi uyumsuzluk yaratır (bizdeki "sarmadı" geri bildirimi).
12. **Ses yarı yarıya:** Diegetik ses (adım, kapı, kilit, su, kuş) gerçeklik ve his kurar; yalnız müzik + whoosh yetmez.
13. **Ritim:** Plan, değerini teslim ettiği an kesilir; ritim öğrenilince küçük sapmalar heyecan verir.

## Bizdeki sınırın teşhisi
| Sınır | Neden |
|---|---|
| Kapalı menü | Gemini hep aynı ~70 öğeyi yeniden karıştırıyor; yeni teknik yalnız "en fazla 2 yeni" ile mümkün ve pek kullanılmıyor |
| Hafıza yok | `gemini_kurgu_json.py` önceki videoları bilmiyor (geçmiş kaydı yalnız eski `yonetmen.py`'de) → Cinzel/ışık açılışı vb. tekrar |
| Hikâye yok | Gemini doğrudan "efekt seçimi" yapıyor; konsept → hikâye → teknik sırası yok, bu yüzden her video "oda turu + efekt" |
| Kontrast/yükseliş yok | Enerji eğrisi tanımlanmıyor; her plan benzer yoğunlukta |
| Ses zayıf | Yalnız sentez whoosh/vuruş; diegetik ses kütüphanesi yok |
| Şablon görünümü sabit | Kapanış kartı, yazı yerleşimi, renk mantığı hep aynı iskelet |
| Görüntü sınırı | Gerçek ilan tek parça telefon turu; çekim çeşitliliği az (detay, ışık anı, kapı açılışı yok) |

## Önerilen değişiklikler (pipeline'a)
1. **Konsept adımı:** Gemini önce 3 farklı KONSEPT yazar (ör. "sabah ışığıyla bir gün", "anahtar teslimi POV", "sessiz tur + yalnız ev sesleri", "önce-sonra hafıza"), birini seçer; tüm müzik/geçiş/yazı kararları bu konsepte bağlı gerekçelenir.
2. **Tekrar defteri:** Her render `kurgu/gecmis-yaratici.json`'a teknikleri yazar; sonraki istemde "son 3 videoda kullanılanlar — kullanma" listesi gider.
3. **Yaratıcı kısıt kartı:** Her videoya rastgele bir kısıt (ör. "geçiş yok, yalnız eşleşmeli kesim", "tek renk paleti", "yazısız; anlatım sesle", "tek uzun plan + 3 detay"). Kısıt yaratıcılığı zorlar.
4. **Enerji eğrisi:** JSON'a bölüm bazlı enerji (sakin → yükseliş → nefes → zirve → kapanış) ve her bölümde farklı yapı.
5. **Büyüyen envanter:** Her videoda en az 1 yeni teknik zorunlu; çalışırsa kütüphaneye eklenir (envanter her hafta büyür).
6. **Diegetik ses kütüphanesi:** kapı, anahtar, adım, perde, su, çay, kuş, şehir uğultusu — Gemini plan başına ses seçer.
7. **Eleştiriye soru:** `izlet.py` notuna "Hangi an tahmin edilebilir/tekrar? Önceki videolardan farkı ne?" eklenir.
8. **Çekim rehberi:** Gerçek ilanlar için danışmana 60 sn'lik çekim listesi (kapı açılışı, detay, ışık, el hareketi) — kurgu yaratıcılığının ham maddesi.

## Karşı görüş: imza stili (Gemini analizi, https://www.youtube.com/watch?v=-ttBhqZvZ3Y — "How I Built My Unique Editing Style")
Bu video tersini savunuyor: az seçeneği tutarlı tekrarlayarak **tanınır bir imza** kur (sabit 2–3 font, sabit renk/LUT, sabit ses imzası, imza açılış hareketi, şablon). Ayrıntı: `ttBhqZvZ3Y.md`.

**Denge (uyguladığımız):** Marka imzası SABİT, hikâye/yapı DEĞİŞKEN.
- Sabit: İNZA logosu + yükseliş animasyonu, lacivert-altın kapanış kartı, vurgu rengi ailesi (altın), kapanış sesi.
- Değişken (Gemini + tekrar defteri + kısıt kartı): konsept, sıra, açılış tekniği, geçiş dili, yazı stili, müzik, ortam sesleri.
