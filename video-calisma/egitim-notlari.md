# Claude ile video editi — öğrenilenler

Kaynak: YouTube, Berke Çıtak — "Claude ile 8 Dakikada Video Editi Yap! (Sıfırdan Öğren)"
https://www.youtube.com/watch?v=9gmic549GMI (otomatik Türkçe altyazıdan özetlendi)

## Videodaki yöntem
1. Tek bir proje klasörü hazırla: editlenecek video/fotoğraflar, logo, font, ikonlar, müzik.
2. Referans görselleri (beğenilen giriş, yazı stili, animasyon) ekran görüntüsü olarak
   aynı klasöre koy; adlarını `referans1`, `referans2` gibi net ver. Kopyalama değil, ilham.
3. Dosyalara anlamlı isimler ver (`logo`, `kaynaklar`, `referans`), model daha iyi kullanır.
4. Prompt kısa ama net: format (reels/kanca), akıcılık, marka renkleri + logo, ses efektleri,
   çıktı klasörü. Aşırı kısıtlama yaratıcılığı düşürür.
5. Video kodla (matematiksel animasyon) üretilir; Remotion/HyperFrames gibi araçlar da olabilir.
6. Çıktıyı izle, kusurları tek tek geri bildirerek düzelt.
7. Beğenilen stili bir şablon / skill olarak kaydet; sonraki videolar aynı stille hızlı çıkar.

## Yabancı kanallar (İngilizce altyazıdan özet)

### Stockton Walbeck — "How to Edit Videos With Claude Code (From a 10-Year Editor)"
https://www.youtube.com/watch?v=gM40EV6Esh0
- 5 adım: çekim → ayıklama (ölü boşluk/tekrar çekim temizliği) → **storyboard** → kurgu → revizyon.
- Kurgunun ~%80'i storyboard: söylenen/anlatılan her şeye uygun bir görsel eşlenir.
  Yapay zekâ kendiliğinden yaratıcı değil; "hangi durumda hangi yerleşim/animasyon"
  kurallarından oluşan bir şablon kütüphanesi verilmeli.
- Kısa video için ayrı yerleşim kuralları (bölünmüş ekran, tam ekran B-roll, üstte beliren
  öğeler, ortada altyazı).
- Kurgu bir "montaj hattı" gibi adım adım yapılır; her adımdan sonra kalite kontrol.
- İlk sürüm asla kusursuz değildir; zaman damgalı yorumlarla revizyon yapılır.

### Christian Peverelli — "I Fully Automated My Video Editing Using Claude Code"
https://www.youtube.com/watch?v=HzXD4GVqXwM
- Roller ayrı araçlara dağıtılır: Claude Code = editör/koordinatör, Parakeet = transkript,
  HyperFrames = animasyon (her animasyon küçük bir web sayfası gibi yazılıp videoya çevrilir),
  tarayıcı = araştırma/B-roll, Epidemic Sound = müzik ve ses efektleri, FFmpeg = son birleştirme
  ve kontrol (siyah kare, ses senkronu).
- **Ses tasarımı** ayrı bir iş: girişte hafif gerilimli müzik, sonra kısık tempolu müzik;
  öğe belirince "pop", tıklamada "klik" gibi efektler. Fazla kalabalık olmamalı.
- En önemli parça **skill dosyası**: renkler, fontlar, animasyonlar, sesler, kurallar
  (onunkinde 36 kural). Önce kısa bir parçayla (sadece giriş) başla, zaman damgalı
  geri bildirim ver ("22. saniyede şunu yaptın, şöyle olsun"), sonra
  "öğrendiklerini skill'e kaydet" de. Aynı hata bir daha tekrarlanmaz.

## Hangi edit aracı? (2026-11-04 YouTube araştırması)

| Araç | Nasıl çalışır | Kaynak video | Güçlü yanı | Zayıf yanı |
|---|---|---|---|---|
| **HyperFrames** (HeyGen, ücretsiz, açık kaynak) | Claude her sahneyi HTML/CSS/JS olarak yazar, araç bunu videoya çevirir | Andy Lo "Remotion vs HyperFrames" https://www.youtube.com/watch?v=mCjJKq2_JJU · Christian Peverelli | Yapay zekâ için tasarlanmış; efekt/animasyon zenginliği (cam efekti, daktilo yazı, RGB kayma, geçiş efektleri); hazır örnek projelerden skill çıkarılabiliyor | Yeni; Node.js gerekiyor |
| **Remotion** (React) | Video bir React uygulaması gibi kodlanır, kare kare render | Andy Lo karşılaştırması | Hassas, yapılı, güvenilir; Next.js projemizle aynı dil; resmî Claude skill'i var | Daha çok geliştirici işi; şirket kullanımında lisans koşullarına bakılmalı |
| **DaVinci Resolve + MCP** | Claude, Resolve'u MCP ile yönetir; zaman çizelgesi gerçek proje olarak oluşur, grafikleri HyperFrames ile yapar | Jason Cooperson https://www.youtube.com/watch?v=fSJh8etPngU | Profesyonel program, elle son rötuş, renk düzenleme | Masaüstü programı, otomasyona/sunucuya uygun değil; Studio sürümü ücretli |
| **CapCut** | Claude proje dosyalarını doğrudan yazar (program kapalıyken) | Matt Loui https://www.youtube.com/watch?v=U-AdnIz1jIk | Tanıdık arayüz, sonradan elle düzeltme; düzeltmelerinden stil öğrenip skill yapma | Masaüstü; ilk proje ~3 saat; hareketli grafik için ayrı ücretli araç (Higgsfield) |
| **FFmpeg** (şu an kullandığımız) | Filtre zinciriyle doğrudan render | Hepsi son aşamada kullanıyor | Ücretsiz, hızlı, sunucuda çalışır, kurulu | Yazı animasyonları ve grafikler sınırlı/zahmetli |

Ortak ders: araç ne olursa olsun kalite **storyboard + kurallar dosyası (skill) +
zaman damgalı geri bildirim** üçlüsünden geliyor; kurgu tek seferde değil
aşama aşama (temel → sahneler → cila) yaptırılmalı.

**Bu proje için öneri:** Platform ilan videolarını otomatik, insan dokunmadan üretecek.
Bu yüzden masaüstü programlar (CapCut, DaVinci) uygun değil. En iyi yol
**HyperFrames (yazı/grafik/geçiş animasyonları) + FFmpeg (birleştirme, müzik, kontrol)**.
Alternatif: Next.js ile aynı dilde olduğu için **Remotion**, ama önce lisansına bakılmalı.

## Edit kursları: geçiş seçimi ve çeşitlilik (2026-11-04, altyazılardan özet)

### StudioBinder — "Ultimate Guide to Scene Transitions" (Shot List Ep. 9)
https://www.youtube.com/watch?v=TKXBAaQB03U
Her geçişin bir **işlevi** var:
- **Kesme:** varsayılan.
- **Siyahtan açılış / siyaha kapanış:** başlangıç ve son, "kitabı açıp kapatmak".
- **Siyaha dip:** bölüm arası, nefes aldırır.
- **Çözülme:** zaman geçişi, iki görüntüyü üst üste bindirip bağ kurar.
- **Eşleşmeli kesim** (şekil, kompozisyon, renk, hareket ya da ses benzerliği): iki planı anında bağlar.
- **İris:** tek bir öğeye odaklar.
- **Silme:** eski moda, bilinçli bir tercih olarak kullanılır.
- **Önünden geçme** (kamera bir nesnenin önünden geçer): kesimi gizler.
- **Whip pan:** momentumu korur.
- **Sert kesme** (smash cut): sessiz/gürültülü zıtlığıyla şok etkisi.
- **J/L kesme:** sesin görüntüden önce başlaması ya da sonra bitmesi.

### Herman Huang — "Why Your Video Transitions SUCK (And How to FIX IT)"
https://www.youtube.com/watch?v=FZS0olGLPIw
1. **Geçiş süs değildir.** "Bu geçiş ne işe yarıyor?" sorusunu sor: zaman mı gösteriyor, mekân mı bağlıyor, ritim mi kuruyor?
2. **Organik ol.** Dijital efekt yerine kameranın kendi hareketiyle geç: bir şeyin içinden geçerek ilerle ya da geri çekilerek yeni bilgiyi göster.
3. **Az kullan.** Her planda gösterişli geçiş olunca hiçbiri öne çıkmaz. Ritim kurmayan, bağ kurmayan ya da anlam katmayan geçiş çıkarılır. "Her geçiş yerini hak etmeli."

### Tim Runia — "The ONLY 7 Cuts You Need To Tell Any Story"
https://www.youtube.com/watch?v=J0ydlAqg6_8
- **Akış kesmesi:** hareket yönü bir sonraki planda sürer. Ters yön sürtünme yaratır.
- **Sert kesme:** ritmi bilerek bozar; sürpriz ancak seyrek kullanılırsa işe yarar.
- **Zıplama kesmesi** (jump cut): aynı kadrajda zaman atlar; vuruşa oturtmak iyi hissettirir.
- **Hareket içinde kesme:** göz ekranın aynı noktasında kalırsa kesim görünmez olur.
- **Geniş → orta → yakın dizisi:** netlik sağlar. Bilinçli olarak ters çevrilebilir (yakından başlayıp sonda geniş planı göstermek).
- **Eşleşmeli kesme:** benzer şekil ya da konum ekranın aynı yerinde durur.
- **Tempo değişimi:** hızlı kesimler gerilim kurar, yavaş kesimler duygunun yerine oturmasına izin verir. Hep aynı hız izleyiciyi koparır.
- **"Hepsini tek videoya tıkıştırma":** her an ne istiyorsa (akış, sürpriz, ritim değişimi) onu seç.

### Joel Van Beek — "How I Edit Modern Real Estate Videos" (DaVinci)
https://www.youtube.com/watch?v=LnbDaoKNBcs
Emlak videosunda her geçiş farklı bir iş görüyor:
- **Hız rampası:** %50 yavaştan başlayıp vuruşa doğru hızlanıyor. Yumuşatmalı (ease in/out) ve vuruşa hizalı.
- **Gündüzden geceye:** luma fade (önce parlak alanlar geçer) ile dış cephe gündüzden geceye dönüyor.
- **Ölçek rampası:** hız rampasının sonuna ölçek büyütme eklenerek hız hissi artırılıyor.
- **Neredeyse donma:** plan %4–5 hıza kadar yavaşlatılıyor, sonra yeniden hızlanıyor.
- **Yön değiştirme:** klip ters çevrilerek kameranın yönü kurguya göre değiştiriliyor.
- **Cine whip:** kamera hareketinin yönüne göre (sağa, hafif yukarı) aşırı-salınımlı (overshoot) eğri kullanılıyor.
- **Detaya dalış:** mutfakta geniş plandan ocağa hızla yaklaşılıyor.
- **Sanal mobilya:** mobilya bir "belirme" efektiyle gelip gidiyor (yapay zekâyla döşenmiş oda).
- **Motion blur:** yalnızca hız rampalarının üstünde.

## CapCut kursları (2026-11-04)

### Cory Malveaux — "How to Edit Real Estate Videos in Minutes – CapCut Tutorial"
https://www.youtube.com/watch?v=yDP4ILJ_fJM
- **Çekim:** 4K 60fps, telefonun en geniş lensi, bütün ışıklar açık, perdeler açık; görüntüler %50 yavaşlatılarak kullanılıyor.
- **Müzik:** Ritim düştüğü anda (beat drop) içeri giriş yapılıyor. AI Beat Sync'te "Beat 1" seçiliyor; seyrek vuruşlar emlak için daha uygun, Beat 2 fazla hızlı.
- **Kesimler vuruşta:**
  - Plan geçişlerinde hız eğrileri kullanılıyor: ilk planda "flash out" (normalden 5x'e hızlanarak çıkış), ortadakilerde "bullet" (hızlı giriş, %50 yavaş orta, hızlı çıkış), son planda "flash in".
  - Aynı odanın detaylarında (gardırop, banyo) hız rampası yapılmıyor; %50 yavaşlatılıp düz kesiliyor. Bu, izleyiciye "burası aynı oda" mesajı veriyor.
- **Geçiş ve kapanış:** Açılışta "Pull in" geçişi, kapanışta "TV off" efekti.
- **Ses:** Konuşma varken müzik −12 ila −20 dB, müzik yumuşakça giriyor ve çıkıyor.

### Joey Edits — "Top 5 Cinematic Transitions in CapCut PC"
https://www.youtube.com/watch?v=CrqKi3gTouA
1. **Hız rampası:** Önce stabilizasyon. Çıkan planda "flash out", giren planda "flash in" eğrisi, en yüksek hızda. Üstüne motion blur (%60–70, karışım %50).
2. **J/L kesme:** Ses görüntüden önce başlıyor ya da görüntü değiştikten sonra sürüyor.
3. **Maske geçişi:** Ekrandan geçen bir nesne (kolon gibi) bölme maskesiyle izleniyor (yumuşak kenarlı) ve sonraki plan onun ardından açılıyor.
4. **Overlay geçişi:** 4–10 karelik ışık/doku katmanı "screen" karışım moduyla kesimin üstüne konuyor.
5. **Siyaha dip:** Hızlı bölümden yavaş bölüme fade-out → siyah → fade-in ile geçiliyor.

### Matt Loui — "Typography Motion Graphics Animation in CapCut"
https://www.youtube.com/watch?v=Shgr6TkJTDI
- **Kelime kelime yazı:** Her kelime ayrı bir katman, her birinin animasyonu farklı (zıplama, büyüme, daktilo).
- **Vurgu:** Önemli kelime çok büyük yazılıyor.
- **Kamera hareketi:** Katmanlar birleşik klip yapılıp ölçek ve konum anahtar kareleriyle kaydırılıyor, eğri "Auto curve" ile yumuşatılıyor.
- **Vurgu çıkartmaları:** Ok gibi vurgu çıkartmaları kullanılıyor.

### pycapcut ile karşılıkları
- **Geçişler:** `TransitionType` içinde 1.137 geçiş var: 推近 (push in), 横向模糊 / 竖向模糊 (whip benzeri), 叠化 (çözülme), White_Flash ve diğerleri.
- **Yazı animasyonları:** `TextIntro` / `TextOutro`: 逐字 (harf harf), 打字机 (daktilo), 弹入 (zıplama), 向右滑动 / 向左模糊 (kayma, bulanık giriş), 渐显 (beliriş).
- **Açılış ve kapanış:** `VideoSceneEffectType`: 渐显开幕 / 渐隐闭幕; 电视关机 (TV off) da var.
- **Hız eğrisi kalıpları** (flash in/out, bullet) pycapcut'ta yok. Sabit hız ve anahtar kare (ölçek, konum) var. Eğri gerekiyorsa CapCut'ta elle uygulanmalı.

## Araştırma 2026-11-05 (YouTube altyazıları, uygulama içi tarayıcıdan)

### Cory Malveaux — "Edit Property Tours using ONLY FREE CapCut Features (2026)"
https://www.youtube.com/watch?v=G8M3KGSTGcc — tamamen ücretsiz CapCut ile ilan videosu.
- **Müzik:** "Auto mark beats → Beats 1" (seyrek vuruş; odalar okunabilsin). Müziğin patladığı an (drop) eve giriş anına
  (kapıya yaklaşma) denk getirilir. Sonda müzik ses noktası sürüklenerek fade-out.
- **Kesim:** her klipte "en erken/en geç kullanırım" giriş-çıkış noktası (I/O), hepsi 0.5x hız (4K60 çekim), kesimler
  vuruş işaretlerine; bazen tek, bazen iki vuruş.
- **Yatay klip → dikey:** klip ikiye çoğaltılır; alttaki ekranı doldurur + Blur efekti %40, üstteki sığdırılır.
- **Renk (klip klip):** Adjust → Basic: gölgeler +, pozlama +, highlights − (pencere patlamasın). Sarı oda:
  HSL damlalıkla sarıyı seç, doygunluğu biraz düşür (odalar arası ton tutarlı olsun).
- **Genel renk:** tüm projeye ayarlama katmanı (adjustment layer) + hafif S-eğrisi; siyahlar KALDIRILMAZ (emlakta doğal görünüm).
- **Geçişler sadece iki yerde:** kapıda "Pull in" (zoom), alt kat→üst kat "Down" (aşağı kayma = yukarı çıkıyormuşuz).
- **Yazı:** adres, Instagram güvenli alanında (kenarlardan uzak), hazır stil + ücretsiz giriş/çıkış animasyonu.
- **Dışa aktarma:** 4K, 30 fps.

### "How to Make Viral Minimal Reel Edits in CapCut"
https://www.youtube.com/watch?v=MJHpo7pOaLg — "beyaz minimal" stilin CapCut tarifi.
- **Üç yapı:** nesne-merkezli (ortada tek nesne), karakter-merkezli, metin-merkezli (ortada büyük kelime + çevresinde destek).
- **Zemin:** beyaz düz arka plan; Adjust "white −40" + şerit (filmstrip) maske ters, feather 75 → yumuşak gölgeli kenar.
  İsteğe: ızgara overlay %10 opaklık + daire maske feather 40; gölge overlay %10.
- **Nesne gölgesi:** katmanı çoğalt → curves ile tamamen siyah → alta koy → blur maksimum (×2) → opaklık %50–60.
- **Şekiller:** nesnenin arkasında koyu gri daire, ölçek %50→%205, 1 sn, "variable speed animation" eğrisiyle yumuşak.
  Kare/yuvarlak köşeli (corner 25) gradyan kutu; karakter kutudan taşar (pop-out), dikdörtgen maske corner 10.
- **Tipografi:** koyu gri (#333 civarı), kalın sans (SF Pro Display Bold ~30); ikinci kelime koyu gri kutu içinde beyaz,
  kutu "slide right" ile gelir, kelime "type" animasyonu; 15 kare sonra üçüncü kelime. Süs: küçük çizgiler (— — —)
  eğik/kavisli, ince fontlu çok satırlı küçük metin (boyut ~5), kalemle çizilmiş kavisli çizgi (%40–50 opaklık,
  maskeyle 1 sn'de açılır). Arkada dev kelime: stroke 1, boyut ~200, italik, opaklık %20.
- **Sahne kamerası:** tüm katmanlar birleşik klip → ilk 20 karede blur 20→0, ölçek 130→100 + dönme 10→0
  (cubic ease) ya da ölçek 125/120→100 cubic out, 2–3 sn. Hafif "chromatic" bozulma + wide-angle %20 = 3D derinlik.
- **Kural:** abartma — tek odak ortada, destek öğeler çevrede, animasyon az ve yumuşak.

## Efekt çeşitliliği kuralları (ilan-video-edit için)
1. **Bir efekt bir kez:** Aynı geçiş arka arkaya iki kez kullanılmaz. 7 planlık videoda en fazla 3–4 farklı geçiş olur, kalanı düz kesme.
2. **Geçiş türünü planlar arasındaki ilişki seçer:**
   - Aynı mekânda geniş plandan detaya → hareket içinde kesme ya da hızlı yaklaşma (punch-in).
   - Mekân değişimi (salon → mutfak) → whip / hareket eşleşmeli kesme.
   - Benzer şekil (pencere → pencere, kapı → koridor) → eşleşmeli kesme.
   - Açılış ve kapanış → siyahtan açılış / siyaha kapanış.
   - Tek bir vurgu anı → sert kesme ya da beyaz flaş (videoda bir kez).
3. **Tempo dalgası:** hızlı-hızlı-yavaş (nefes)-hızlı. Plan süreleri 2–4 vuruş arasında değişir, hep 3 vuruş değil.
4. **Hareket dili değişir, yön sürer:** yaklaşma, yörünge, yana kaydırma, yukarı/aşağı tilt sırayla. Kesimin iki yanında yön aynı kalır.
5. **Özne merkezde** (kullanıcı geri bildirimi). Kural bilinçli olarak yalnızca bir kez bozulabilir, o da açıklama planında.
6. **Motion blur** yalnızca hızlı hareketlerde; yavaş planlar net kalır.

## Bu projeye çıkarımlar
- Emlak videosu için bir storyboard kuralı: her plan tek bir özelliği anlatır
  (manzara → cam cephe planı, mutfak → mutfak planı) ve yazı o planla aynı anda gelir.
- Geçişlere hafif "whoosh" ses efekti, girişte vuruş; müzik vuruşuna göre kesme.
- Kalite kontrol adımı: karanlık/boş planları otomatik ele (parlaklık ölçümü).
- Beğenilen sürümden sonra `ilan-video-edit` skill'i yazılıp her ilanda aynı stil kullanılmalı.

## Bu projeye uygulanışı
- Kaynak: `gerçek_test_veri/`, müzik: `muzik/`, metinler: `metin/` (marka dahil).
- Geri bildirim 1: "düz, efekt yok" → efektli sürüm.
- Geri bildirim 2: "geçişler çok hızlı" → plan süreleri uzatıldı (~2,4 sn), geçişler
  yumuşak (0,6 sn çözülme/kayma), tek flaş, marka adı köşede, akıcı ritim.
- Eksik: logo ve marka renkleri dosyası yok; eklenirse videoya işlenebilir.
