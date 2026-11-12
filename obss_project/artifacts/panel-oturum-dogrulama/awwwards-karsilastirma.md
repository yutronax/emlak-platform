**Jüri hükmüm: Paletinizin karakteri var; hareketinizin henüz imzası yok.** Referanslar sahne kuruyor, panel ise elemanları sırayla görünür yapıyor. Aradaki farkı lacivert ekleyerek veya bütün süreleri 420ms yaparak kapatamazsınız.

Değerlendirme, gönderdiğiniz kareler, verdiğiniz hareket ölçümleri ve okuduğum kod üzerinden yapıldı. Karelerden sürekli parallax, scroll’a birebir bağlı animasyon veya referansların hover davranışını doğrulayamam. Bunları gözlemmiş gibi sunmuyorum. Dosya değiştirmedim.

**1) Palet: doğru renkler, zayıf yüzey ayrımı**

| Konu | Stellar | Concrete | Bizim panel |
|---|---|---|---|
| Kontrast stratejisi | Doygun lacivert açılıştan hareketli fotoğrafa, sonra beyaz alana geçiş | `#141416` kömür zeminden büyük fotoğraf yüzeylerine geçiş | Koyu yeşil başlık altında büyük ölçüde krem sürekliliği |
| Koyu/açık ritmi | Kare dizisinde belirgin sahne değişimi var | Açılış–fotoğraf geçişinde belirgin | Dashboard’da üst şeritte başlayıp bitiyor |
| Vurgu | Açılışta zemin bizzat vurgu; sonraki karelerde fotoğraf öne çıkıyor | Nötr çerçeve, fotoğrafın renklerine alan açıyor | Terakota avatar, sekme çizgisi, rozet noktası ve kart çizgisinde dağılıyor |
| Fotoğraf ilişkisi | Mavi su/gökyüzü ile sıcak şehir ve iç mekân tonları karşılaşıyor | Kömür zemin, bej iç mekânların sıcaklığını büyütüyor | Gösterilen kartta taş renkli yer tutucu var; fotoğraf kaynaklı renk çeşitliliği yok |

**Bizim temel kusurumuz “fazla krem” değil, kremin karşısındaki yüzeylerin yeterince farklı görevler üstlenmemesi.** Sayfa `#F6F3EC`, kart `#FFFEFA`, yer tutucu ve kapsüller `#EAE5D9`. Bunlar uyumlu; fakat gönderdiğiniz dashboard’da sonuç biraz fazla aynı tonda. Başlık şeridi güçlü, devamı soluk.

Kodda `--color-fog-50` ile `--color-cream-50` aynı değere, `--color-mist-200` ile `--color-stone-200` aynı değere bağlanmış. İsimler çeşitlilik vaat ediyor; ekranda aynı yüzeyleri üretiyor. Diğer agent ekranlarında kullanılan saf `bg-white` da karttaki sıcak beyazla tutarlı değil.

Terakotanın alanı küçük ama kullanıldığı yer sayısı fazla. Her açık kartın tepesindeki çizgi tekrarlandıkça vurgu olmaktan çıkıp kart şablonunun süsüne dönüşür. Referansların gücü daha çok renk kullanmaları değil, büyük renk alanlarına net roller vermeleri.

Önerdiğim değerler **yeni tasarım hedefleridir**:

| Rol | Hex | Kullanım |
|---|---|---|
| Ana zemin | `#F6F3EC` | Koruyun |
| Ana yüzey | `#FFFEFA` | Kartlar, menüler, form yüzeyleri; dağınık `bg-white` yerine |
| İkincil yüzey | `#EAE5D9` | Filtre içi, yer tutucu, küçük kapsüller |
| Standart sınır | `#DED8CC` | Koruyun |
| Belirgin sınır | `#C8C0B2` | Hover veya seçili yüzey çevresi; her karta sürekli uygulamayın |
| Ana mürekkep | `#26332D` | Koruyun |
| Derin zemin | `#1B2621` | Video önizleme çevresi ve sınırlı koyu yüzeyler; mevcut token’dan yararlanın |
| Vurgu | `#B85C3B` | Koruyun; kalıcı dekorasyon yerine belirgin vurgu anlarına ayırın |
| Vurgu hover | `#9C482E` | Mevcut koyu terakotayı koruyun |
| Vurgu yumuşak zemin | `#F1E1D7` | Gerektiğinde seçili yüzey; bütün kartların zemini değil |

Dashboard için yaklaşık **%80–85 açık yüzey, %12–17 koyu/nötr alan, %2–3 terakota** bir başlangıç hedefi olur. Bu, karelerden ölçülmüş oran değil; sanat yönetimi önerisi.

Stellar’ın lacivertini veya Concrete’in kömürünü ayrıca eklemeyin. Yeşil mürekkep zaten sizin ayrışma noktanız. Referanslardan alınması gereken, renk kodları değil **renk alanlarının kararlılığı**.

Fotoğraflar geldiğinde hepsine sepya filtre uygulamayın. Sıcak palet, fotoğrafın doğal mavi ve yeşillerine karşı daha iyi çalışır. Video çevresinde koyu yeşil kullanmak, fotoğrafı krem kutunun içine sıkıştırmaktan daha güçlü olur. Nitekim `agent/videos/page.tsx` içinde koyu bölüm zaten var; “panelin hiçbir yerinde koyu/açık ritmi yok” demek yanlış olur.

**2) Hareket: kısa olmak sorun değil; her şeyi aynı şekilde başlatmak sorun**

Verdiğiniz ölçümlerde Stellar’ın `420 / 620 / 1200 / 1320ms`, Concrete’in `420 / 800 / 820ms` katmanları var. Bu süreler, hareketin büyüklüğü ve sahnenin rolüyle anlam kazanıyor.

Bizde `120 / 180 / 240 / 320ms` iyi bir araç arayüzü tabanı. Fakat `cubic-bezier(.22,1,.36,1)` çok erken hızlanıp uzun süre yerleşiyor. Küçük bir 4–8px hareketle birleşince hareketin çoğu göz açıp kapayana kadar bitiyor; geriye hafif bir belirme kalıyor.

**Daha uzun süre tek başına daha zarif değildir.** Referanslarda perde, logo dönüşümü ve medya gibi büyük değişimler var. Bizde aynı dramatik süreyi küçük bir kenarlık değişimine vermek yalnızca hantallık üretir.

Kodun hareket kapsamı verilen özetten daha geniş:

- Aktif sekme çizgisi soldan açılıyor.
- Menü 160ms giriş yapıyor.
- WhatsApp durumları fade ile değişiyor.
- Skeleton, spinner ve çizilen onay işareti var.
- Filtre açılımı destekleyen tarayıcılarda yükseklik ve opaklıkla gerçekleşiyor.
- Kart hover’ında sınır rengi değişiyor.

Eksik olan, bu küçük hareketleri birleştiren **yön, süreklilik ve belirgin bir yüzey geçişi**.

Ayrıca ilk altı kartın stagger’ı zaten sınırlı. Masaüstünde altıncı kart `80 + 5×40 = 280ms` sonra başlıyor ve 320ms sonra bitiyor: toplam **600ms**. Dolayısıyla mevcut sistem bütünüyle “çok kısa” da değil; süre elemanlar arasında dağıtılmış.

| Hareket alanı | Eksik | Panele uygun karşılığı |
|---|---|---|
| Marka açılışı | Hatırlanabilir başlangıç yok | Gerekirse başlık içindeki marka işaretine tek seferlik 320–420ms açılım |
| Perde/maske | Yalnızca fade-up baskın | Video önizleme gibi tek bir medya alanında 420–520ms maske |
| Sayfa geçişi | Bölümler arasında görsel devamlılık yok | Başlık sabit, yalnız içerik alanında 180–240ms geçiş |
| Scroll hareketi | Özel koreografi yok | Uzun listede eklemek zorunlu değil; varsa medya alanında tek seferlik reveal |
| Yumuşak kaydırma | Lenis yok | Panelde eksiklik saymam |
| Medya hareketi | Karelerde gösterilen dashboard’da yok | Gerçek medya varsa açılış veya hover’da kontrollü küçük ölçek değişimi |
| Hover | Renk değişimleri var ama süre dili dağınık | Gerçek etkileşimli yüzeylerde ortak 160–180ms geçiş |

**3) Referanslardan ne alınmalı, ne alınmamalı?**

**Alınmalı:** Tek bir belirgin geçiş eğrisi, hareketler arasında süre hiyerarşisi, eski ve yeni yüzey arasında devamlılık, medya için kontrollü maske, daha kararlı koyu/açık yüzey ilişkisi.

**Alınmamalı:** Her girişte 2–3 saniyelik logo gösterisi, sekme değişiminde tam ekran perde, bütün kartlarda scroll reveal, sürekli parallax, arka planda dekoratif video, her yüzeyde hover zoom.

Stellar zamanı marka atmosferi kurmak için kullanıyor. Panelde aynı zamanın karşılığı daha sınırlı olmalı. **Açılış gösterisini değil, geçişlerin disiplinini alın.**

Concrete’in harf harf logo açılışını doğrudan taşımak da zayıf bir uyarlama olur. Panelin hareket imzası, tekrar tekrar görülen küçük geçişlerde kurulmalı.

**4) En etkili altı müdahale — öncelik sırasıyla**

**1. Yüzey paletini tek sisteme bağlayın.**

Dosyalar: `web/src/app/globals.css`, `web/src/app/agent/dashboard/listing-card.tsx`, agent altındaki form ve video bileşenleri.

`--color-panel-surface`, `--color-panel-surface-muted`, `--color-panel-border-strong` gibi görev token’ları tanımlayın. Tailwind tarafında `bg-panel-surface` ve `bg-panel-surface-muted` kullanın.

En yüksek getirili müdahale bu: Yeni renk icat etmeden mevcut paleti daha bilinçli gösterir. Bağımlılık gerekmez.

**2. Her açık karttaki terakota üst çizgiyi sorgulayın.**

Dosya: `web/src/app/agent/dashboard/listing-card.tsx`.

Genel kart sınırını taş renginde bırakın; terakotayı belirli vurgu durumlarına ayırın. `border-t-2 border-t-terracotta-600` bütün açık kartların varsayılanı olmamalı.

Karede zarif görünen tek çizgi, çok kartlı ekranda tekrarlanan dekorasyona dönüşür. Paletin vurucu rengini sıradanlaştırmayın. Bağımlılık gerekmez.

**3. Mikro hareket ile sahne hareketini ayırın.**

Dosyalar: `web/src/app/globals.css`, `web/src/app/agent/dashboard/page.tsx`, `listing-card.tsx`.

Önerilen süreler:

```css
--motion-fast: 120ms;
--motion-ui: 180ms;
--motion-panel: 260ms;
--motion-enter: 320ms;
--motion-scene: 420ms;
--ease-scene: cubic-bezier(.28, .11, .32, 1);
```

Mevcut hızlı eğriyi küçük tepkilerde koruyun; yeni eğriyi yalnızca daha büyük yüzey/medya geçişlerinde kullanın. Ana içerik girişiyle her kartın girişini üst üste bindirmeyin; üst kapsayıcı da çocukları da saydamlıktan başlatınca ilk kare gereğinden fazla silikleşebilir.

Bağımlılık gerekmez.

**4. Bölüm geçişine görsel devamlılık ekleyin.**

Dosyalar: `web/src/app/agent/layout.tsx`, `web/src/components/app-shell/app-header.tsx`; gerekirse yeni `web/src/components/app-shell/panel-transition.tsx`.

Hedef: Başlık yerinde kalsın, içerik 180–240ms içinde değişsin. Tam ekran perde kullanmayın.

Native **View Transitions API** adaydır; yeni paket zorunlu değildir. Artısı eski/yeni görünüm arasında geçiş kurabilmesi. Eksisi, tarayıcı desteğinin ve Next App Router gezinme entegrasyonunun ayrıca doğrulanması gerekmesi. Sadece CSS kuralı eklemek SPA geçişini otomatik kurmaz. [API belgesi](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)

**5. Hareketin gösterişli kısmını medyaya ayırın.**

Dosyalar: `web/src/app/agent/videos/page.tsx`, `web/src/app/agent/videos/[id]/page.tsx`, `web/src/app/globals.css`.

Gerçek önizleme varsa `overflow-hidden` içinde 420–520ms `clip-path: inset(...)` açılımı; gerçek etkileşimli medya yüzeyinde 240–320ms `scale(1.02)` hover deneyin. Video oynatıcısının tamamını ölçeklemeyin.

Dashboard’daki mimari yer tutucuyu zoom etmek kalite katmaz. Önce gerçek medya yüzeyi gerekir. CSS yeterli; bu kapsam için GSAP gerekmez.

**6. Hover ve küçük geçişlerin sürelerini toparlayın.**

Dosyalar: `web/src/components/app-shell/app-header.tsx`, `web/src/app/agent/whatsapp/wa-panel.tsx`, `web/src/app/agent/videos/new/order-wizard.tsx`, `listing-card.tsx`.

Hover renklerini ortak 160–180ms süreye bağlayın. Tailwind örneği:

```text
transition-colors duration-[var(--motion-ui)] ease-[var(--ease-ui)]
```

Gerçek düğmelerde basış sırasında `scale(.99)` düşünülebilir. `transition-all` kullanmayın. Tıklanmayan ilan kartına yükselme eklemeyin; mevcut sınır rengi değişimi yeterli. Bağımlılık gerekmez.

**Kütüphane kararı:** Bu altı müdahale için Lenis veya GSAP kurmazdım. Lenis, kaydırma yumuşatma ve senkronizasyon sağlar; karşılığında ek çalışma döngüsü ve kaydırma entegrasyonu getirir. Burada çözeceği belirgin bir sanat yönetimi ihtiyacı yok. [Lenis](https://github.com/darkroomengineering/lenis)

GSAP, çok aşamalı timeline ve ScrollTrigger koreografisi gerektiğinde güçlüdür; mevcut önerilerde CSS’in yapabileceği iş için ek bağımlılık ve yaşam döngüsü yönetimi getirir. [GSAP belgeleri](https://gsap.com/docs/v3/)

**Renk tarafı: revizyon gerekli. Hareket tarafı: daha fazla animasyondan önce daha seçici koreografi gerekli.**