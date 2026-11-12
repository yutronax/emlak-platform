# Red Team UX notları (Codex, 2026-11-03)

Panel şu haliyle bitmiş bir ürün değil, stil verilmesi yarım kalmış bir yönetim formu izlenimi veriyor. En büyük sorun süs eksikliği değil: kullanıcı neye öncelik vereceğini, sistemin hangi durumda olduğunu ve sonraki adımını yeterince açık göremiyor.

Masaüstü görselleri burada küçültülmüş gösteriliyor; bu yüzden kesin piksel ölçüsü veya kontrast oranı iddia etmiyorum. Aşağıdaki değerlendirme görünen düzen ve içerik üzerinden.

### 1. Dashboard — 320 px mobil

1. **Görsel hiyerarşi:** Filtreler ekranı ele geçirmiş. Kullanıcı ilk ekranın neredeyse tamamını geçmeden ilana ulaşamıyor. “Video siparişlerim”, “WhatsApp’ını bağla” ve “Deneme sürümü” aynı bölgede, farklı biçimlerde yarışıyor. Sayfanın ana işi belirsizleşiyor. **Düzeltme:** Önce ilan sayısı ve sonuçlar; filtreleri “Filtrele” düğmesiyle açılan bir alana taşı. Hesap ve bağlantı işlemlerini ayrı bir bölüme al.

2. **Boşluk, hizalama, tipografi:** Başlık sola yaslıyken WhatsApp bağlantısının içeriden başlaması hizalama hatası gibi görünüyor. Büyük ölçüde eşit ağırlıktaki metinler, başlık–yardımcı bilgi ayrımını zayıflatıyor. **Düzeltme:** Tek bir sol hizalama çizgisi kullan; başlık, alan etiketi ve yardımcı metin için belirgin bir tipografi ölçeği oluştur.

3. **Mobil uyum ve taşma:** Görünen bölümde belirgin yatay taşma yok. Ancak alanların tek sütuna dizilmesi tek başına iyi mobil deneyim sağlamamış: yedi filtre ve düğme, sonuçları aşağı itiyor. **Düzeltme:** Aktif filtreleri kısa etiketlerle göster; ayrıntıları açılır filtre panelinde tut.

4. **Erişilebilirlik:** Üstteki metin bağlantıları ve küçük “Deneme sürümü” hedefi dokunmak için sıkışık. Bildirim simgesinin çevresindeki tıklanabilir alan görüntüden doğrulanamıyor. **Düzeltme:** Etkileşimli alanları en az 44 × 44 CSS piksel olacak şekilde tasarla; ikona erişilebilir ad ve belirgin odak görünümü ekle.

5. **Güven ve profesyonellik:** Sol alttaki kırmızı “1 Issue” geliştirme göstergesi doğrudan kartın üzerine biniyor. “Bilinmeyen grup”, “Fiyat belirtilmemiş” ve eksik konum birlikte veri kalitesine güvensizlik yaratıyor. **Düzeltme:** Kullanıcıya sunulan ortamdan geliştirme göstergesini kaldır; eksik veriyi açıklayan tutarlı kart tasarımı kullan.

6. **Boş durum / eksik içerik:** “Bugün 0/10 ilan açık” anlaşılır değil: kota mı, bugün açılan ilan mı, mevcut aktif ilan mı? **Düzeltme:** Gerçek anlama göre “Bugün açılan ilan: 0 / 10” gibi açık yaz; sonuç sayısını bundan ayrı göster.

### 2. Dashboard — 1280 px masaüstü

1. **Görsel hiyerarşi:** İçerik üstte dar bir adaya sıkışıyor; ekranın geri kalanı işlevsiz. Filtreler yine sonuçlardan baskın. **Düzeltme:** Daha geniş, ortalanmış bir içerik alanında belirgin sayfa başlığı, sonuç özeti ve ilan listesi oluştur.

2. **Boşluk, hizalama, tipografi:** Küçültülmüş görüntüde metinler çok cılız görünüyor. Filtrelerin üç sütun olması düzen getiriyor, fakat bölüm ayrımları ve başlık ölçeği zayıf. **Düzeltme:** Gerçek boyutta okunaklı metin ölçülerini doğrula; filtreleri ayrı yüzeyde grupla, sonuç bölümünü başlık ve boşlukla ayır.

3. **Mobil uyum ve taşma:** Masaüstü alanı verimli kullanılmıyor; tek ilan kartı küçük bir köşede kalıyor. **Düzeltme:** İçeriğe uygun bir azami genişlik belirle; ilanları okunabilir genişlikte liste veya uyarlanabilir kart ızgarasında sun.

4. **Erişilebilirlik:** İnce, küçük görünen etiketler ve yardımcı bilgiler taramayı zorlaştırıyor. Turuncu düğme üzerindeki beyaz yazının kontrastı ölçülmeli. **Düzeltme:** Normal metinde en az 4,5:1 kontrast sağla; alan sınırlarını ve klavye odağını belirginleştir.

5. **Güven ve profesyonellik:** Küçük içerik bloğu, geniş beyaz boşluk ve geliştirme rozeti birleşince demo sayfası hissi oluşuyor. **Düzeltme:** Tutarlı bir uygulama kabuğu, gezinme düzeni ve hesap alanı kur; deneme durumunu anlaşılır bir hesap bilgisi olarak sun.

6. **Boş durum / eksik içerik:** Tek kartın neden bu kadar eksik olduğu ve kullanıcının onunla ne yapabileceği görünmüyor. **Düzeltme:** Kartta kaynak, alınma zamanı, veri eksikleri ve açık bir “İlanı incele” eylemi göster. İçerik gerçekten azsa bunu açıklayan bir başlangıç yönlendirmesi ekle.

### 3. WhatsApp — 320 px mobil

1. **Görsel hiyerarşi:** “WhatsApp”, “WhatsApp bağlantısı”, risk kutusu, “Onayla”, “Bağlı değil” ve “Bağla” peş peşe geliyor; işlem akışı parçalanıyor. **Düzeltme:** Tek akış kur: bağlantı durumu → kısa açıklama → risk kabulü → bağlantıyı başlatma.

2. **Boşluk, hizalama, tipografi:** Risk metni uzun ve yoğun bir paragraf. Kritik bilgiyle işlem talimatı birbirine karışıyor. **Düzeltme:** “Hesap kısıtlama riski”, “Sistem ne okur?” ve “Sistem ne gönderir?” bilgilerini kısa, taranabilir satırlara böl.

3. **Mobil uyum ve taşma:** Görünen bölümde yatay taşma yok; kutu ekran genişliğine uyuyor. Ancak içerik bittikten sonraki geniş boşluk ve arka planın kesilmesi sayfayı yarım bırakılmış gösteriyor. **Düzeltme:** Sayfa yüzeyini ekran boyunca tutarlı sürdür; bağlantı adımlarını ve yardım içeriğini aynı akışta göster.

4. **Erişilebilirlik:** Onay kutusu küçük görünüyor; etiketin tamamının tıklanabilir olup olmadığı bilinmiyor. Soluk düğmelerin devre dışı mı yoksa normal mi olduğu açık değil. **Düzeltme:** Tüm onay satırını dokunulabilir yap; devre dışı düğmenin nedenini yanında yaz ve durumunu programatik olarak bildir.

5. **Güven ve profesyonellik:** “Numaranız kapatılabilir” ciddi bir uyarı; ardından gelen belirsiz süreç güveni daha da azaltıyor. “Resmî olmayan bağlantı” açıklanıyor ama veri erişiminin kapsamı görünmüyor. **Düzeltme:** Bağlantı yöntemini, hangi verilere erişildiğini, oturumun nasıl sonlandırılacağını ve desteğe nasıl ulaşılacağını açıkla.

6. **Boş durum / eksik içerik:** “Bağlı değil” yalnızca bir etiket. Bağla’ya basınca QR kod mu çıkacak, telefon mu gerekecek, bilinmiyor. **Düzeltme:** “Telefonunuzdan QR kodu okutarak bağlanacaksınız” gibi gerçek sonraki adımı anlat; hata ve yeniden deneme durumlarını da tasarla.

### 4. WhatsApp — 1280 px masaüstü

1. **Görsel hiyerarşi:** Küçük bir form bloğu geniş ekranın ortasında kayboluyor. Ana eylem görsel olarak etkisiz. **Düzeltme:** Okunabilir genişlikte bir bağlantı kartı ve açık adım sıralaması kullan; bağlantı durumunu kartın başına taşı.

2. **Boşluk, hizalama, tipografi:** Risk açıklaması küçültülmüş görünümde neredeyse dipnot gibi. Oysa kullanıcının kararını etkileyen temel içerik bu. **Düzeltme:** Uyarıyı gövde metni boyutunda tut; metin uzunluğunu sınırlayıp bölüm aralıklarını belirginleştir.

3. **Mobil uyum ve taşma:** Masaüstü için anlamlı bir yerleşim uyarlaması görünmüyor. **Düzeltme:** Yer uygunsa bağlantı adımlarını ve QR alanını yan yana düzenle; mobilde aynı sırayla alt alta getir.

4. **Erişilebilirlik:** Soluk eylemler ve küçük onay satırı durum ayrımını güçleştiriyor. **Düzeltme:** Etkin, devre dışı, yükleniyor ve hata durumlarını yalnız renkle ayırma; görünür metin ve erişilebilir durum bildirimi ekle.

5. **Güven ve profesyonellik:** Hassas bir hesap bağlantısı ekranında yardım, veri açıklaması ve bağlantıyı kesme bilgisi görünmüyor. Geliştirme rozeti de güveni zedeliyor. **Düzeltme:** Kısa bir veri kullanımı açıklaması, yardım bağlantısı ve oturum yönetimi bilgisi sun.

6. **Boş durum / eksik içerik:** Bağlantı sonrası ne kazanılacağı belirsiz. Grup seçiminin nerede yapılacağı da açıklanmıyor. **Düzeltme:** “Bağlandıktan sonra ilan okunacak grupları seçeceksiniz” gibi sonraki aşamayı göster; bağlı durumda hesap ve seçili grup özetini sun.

### En kritik 5 sorun — öncelik sırasıyla

| Öncelik | Sorun | Somut düzeltme |
|---|---|---|
| **1** | **WhatsApp bağlantı akışı ve risk kabulü belirsiz.** Kullanıcı ciddi bir riski kabul ediyor ama sonraki adımı bilmiyor. | Tek bağlantı akışı oluştur. Risk, veri kapsamı ve bağlantı yöntemi açık olsun. Kabul sonrası tek ana eylem kullan; bağlantıyı kesme yolunu göster. |
| **2** | **Mobil dashboard sonuçları filtrelerin altına gömüyor.** | İlk ekrana sonuç özeti ve ilanları getir. Filtreleri düğmeyle aç; aktif filtreleri görünür tut ve “Temizle” ekle. |
| **3** | **Eksik veri ve muğlak durum metinleri ürünü güvenilmez gösteriyor.** | Kotayı, sonuç sayısını ve bağlantı durumunu ayrı yaz. Eksik ilan alanlarını açıklayıcı ifadelerle göster; her karta net bir sonraki eylem ekle. |
| **4** | **Etkileşimlerin erişilebilirliği zayıf ve durumları belirsiz.** | Kontrastı ölçerek düzelt; 44 × 44 CSS piksel dokunma hedefleri, tıklanabilir onay etiketi ve görünür klavye odağı sağla. Devre dışı eylemlerin nedenini açıkla. |
| **5** | **Masaüstü yerleşimi ve geliştirme göstergeleri tamamlanmamış ürün hissi veriyor.** | Tutarlı bir uygulama kabuğu ve içerik genişliği belirle. Başlık–bölüm–gövde ölçeğini kur; kullanıcı ortamından “1 Issue” göstergesini kaldır. |
