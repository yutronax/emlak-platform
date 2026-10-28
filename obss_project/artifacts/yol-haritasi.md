# Yol Haritası — Emlak Platformu

_Tarih: 2026-10-27 · Kaynak: kullanıcıyla yapılan ürün netleştirmesi + koddan doğrulanan mevcut durum._
_Bu belge "ne satıyoruz, bugün ne var, ne eksik, hangi sırayla yapacağız" sorusunun tek cevabıdır. Her faz kendi ATDD görevi olarak (atdd → plan → test → kod → verify → red-team → commit) yürütülür._

---

## 1. Ürün tanımı (kullanıcı kararı)

Emlakçıya iki şey satıyoruz:

### A. İlan akışı (abonelik — ana ürün)
- Emlakçı **kendi WhatsApp hesabını** sitemize bağlar.
- Üye olduğu gruplardan **hangilerinden ilan çekileceğini kendisi seçer**.
- Bu gruplara düşen ilanları yapay zekâ ile ayrıştırırız (fiyat, oda, m², konum).
- Emlakçı ilanları **kendi sitemizde**, "şu gruptan şöyle bir ilan geldi" diye, **formatlanmış ve filtrelenebilir** bir sayfada görür.
- Yeni ilan gelince **sitemizden bildirim** atarız (WhatsApp mesajı değil).

### B. Reklam videosu (ücretli ek hizmet)
- Emlakçı sitemizden bir ilan/mülk için video siparişi verir.
- Hammadde üç yoldan biri:
  1. **Fotoğraf yükler** → editörlerimiz fotoğraflardan video yapar.
  2. **Kendi çektiği ham videoyu yükler** → editörlerimiz düzenleyip reklam videosuna çevirir (emlakçının videosu hazır sonuç değil, hammaddedir).
  3. **Yerinde çekim** (uygunsa) → ekibimiz gidip çeker, sonra düzenler.
- Belirlenen ücreti öder, **videoyu insanlar (editörlerimiz) hazırlar** ve sitemizden teslim ederiz.

### C. Bot (sonraki aşama)
- Bize ait bir WhatsApp botu: emlakçı ilanı bota atar → bot anında ayrıştırır → emlakçının ilanı kendi gruplarında paylaşmasına ve WhatsApp durumu olarak yayınlamasına yardım eder.
- ⚠️ Bkz. Risk R1 — otomatik paylaşım yerine "hazırla + tek tıkla paylaş" ile başlanması öneriliyor.

### Şimdilik geçici (placeholder) kararlar
| Konu | Şimdilik | Açılıştan önce |
|---|---|---|
| Destek WhatsApp numarası | Açıkça sahte bir numara | Gerçek numara |
| Video / çekim fiyatları | Örnek (mock) fiyat | Gerçek fiyat listesi |
| Abonelik plan adları/fiyatları | "(placeholder)" yazan 3 plan | Gerçek plan + içerik |
| Marka adı | "Emlak Platformu" | Gerçek marka |

---

## 2. Bugün kodda ne var (doğrulandı)

| Parça | Durum | Not |
|---|---|---|
| Landing / fiyat / giriş / kayıt | ✅ Yeni tasarım + illüstrasyon | Metin **eski vaadi** anlatıyor ("ilanı atın, videolu sayfa hazır olsun") — yanlış |
| WhatsApp ilan çekme | ⚠️ **Tek ortak hesap** | `scraper/sidecar/bridge.js` tek oturum (`WHATSAPP_SESSION_DIR`), hesabın üye olduğu **tüm** gruplardan dinler. Emlakçı başına bağlama ve grup seçimi **yok** |
| Ayrıştırma | ✅ | Gemini (`scraper/parser.py`) → `raw_listings.parsed` |
| Kaynak grup bilgisi | ⚠️ Yarım | `raw_listings.source_group` + `source_group_name` var; onaylı `listings` tablosunda **yok** (sadece `raw_listing_id` üzerinden join ile bulunabilir) |
| Admin onayı | ✅ | `/admin/listings` — her ilan elle onaylanıyor |
| Emlakçı ilan sayfası | ⚠️ Basit | `/agent/dashboard` — düz liste, filtre yok, grup bilgisi yok, **herkes aynı ilanları görür** |
| Bildirim | ❌ Yok | |
| Abonelik ödemesi | ✅ | iyzico (`/api/subscriptions/checkout`, `/api/webhooks/payment`) |
| Plan farkları | ❌ | `plans.max_listings` var ama **hiçbir yerde uygulanmıyor** |
| Video | ⚠️ Admin-tek-taraflı | `properties` (emlakçıya bağlı, `agent_id`) + `property_videos` + private Storage bucket (50 MB). Sadece **admin** yükleyip yayınlıyor; emlakçı **yükleyemiyor, sipariş veremiyor, ödeyemiyor, teslim alamıyor** |
| Destek / iletişim / KVKK | ❌ Yok | Footer'da sadece telif satırı |

---

## 3. Fazlar

Sıra, "en hızlı değeri en az riskle" ilkesine göre. Her faz bağımsız commit edilebilir.

### Faz 0 — Vitrini gerçeğe uydur _(küçük, ~1 görev)_
Amaç: Sitede yanlış vaat kalmasın, Opus'un dış-göz eleştirisindeki en ucuz açıklar kapansın.
- [ ] Landing hero + "nasıl çalışır" metnini yeni ürüne göre yeniden yaz (ilan akışı ana ürün, video ek hizmet).
- [ ] Sabit **WhatsApp destek butonu** (tüm müşteri sayfalarında) — sahte numara, tek yerde sabit olarak tanımlı.
- [ ] Footer'ı genişlet: iletişim, (taslak) KVKK / gizlilik / kullanım şartları sayfa linkleri.
- [ ] SSS'yi yeni ürüne göre güncelle ("destek WhatsApp'tan" artık gerçekten bir linke gidecek).
- [ ] Fiyat sayfası: her plana "ne içerir" satırları + dönem ("aylık") — içerikler placeholder olabilir ama **boş olmamalı**.
- Kabul: Opus dış-göz testi tekrar koşulduğunda 1, 5, 8 numaralı bulgular kapanmış olmalı.

### Faz 1 — Video siparişi (ücretli hizmet) _(büyük, 2-3 görev)_
Amaç: İlk gelir getirecek, insan eliyle yürütülebilen ürün. WhatsApp riskine bağlı değil.

**1a. Sipariş + yükleme (emlakçı tarafı)**
- [ ] Yeni sayfa: `/agent/videos` — siparişlerim listesi + "yeni video siparişi".
- [ ] Sipariş formu: mülk bilgisi (başlık, adres) → hizmet seçimi (fotoğraftan / ham videodan / yerinde çekim) → dosya yükleme (fotoğraflar veya ham video) → örnek fiyat gösterimi.
- [ ] Yerinde çekim seçilirse dosya yükleme yerine adres + uygun zaman notu.
- [ ] Dosyalar private Storage'a, sadece sahibi ve admin erişebilir (RLS).

**1b. Admin/editör tarafı**
- [ ] `/admin/videos` → sipariş kuyruğuna dönüşür: gelen siparişler, hammaddeyi indirme, durum değiştirme, bitmiş videoyu yükleme.
- [ ] Durumlar: `beklemede → ödeme bekleniyor → hazırlanıyor → teslim edildi` (+ `iptal`).

**1c. Ödeme + teslim**
- [ ] Video siparişi için tek seferlik iyzico ödemesi (mevcut abonelik entegrasyonundan ayrı akış, aynı webhook altyapısı).
- [ ] Teslim: emlakçı `/agent/videos`'ta videoyu izler/indirir, paylaşım linki alır.
- [ ] Teslimde site içi bildirim (Faz 2'nin bildirim altyapısı hazırsa).

**Veri modeli önerisi** (kesinleşmesi 1a'nın plan adımında):
- `video_orders`: `id, agent_id, property_id, service_type (photos|raw_video|onsite), status, price_minor_unit, payment_id, notes, created_at`
- `video_order_assets`: `id, order_id, kind (photo|raw_video), storage_path, created_at`
- Mevcut `property_videos` teslim edilen sonucu tutmaya devam eder (`order_id` eklenir).

**Dikkat:**
- Ham video dosyaları büyük — mevcut bucket limiti 50 MB. Ham video için limit ve yükleme yöntemi (parçalı/resumable) planda kararlaştırılmalı.
- Mock fiyat tek bir yerde tanımlanmalı ki gerçek fiyata geçiş tek değişiklik olsun.

### Faz 2 — İlan akışı sayfası + bildirim _(orta, 1-2 görev)_
Amaç: Abonelik ürününün "görünen yüzü". Bugünkü ortak ilan havuzuyla bile çalışabilir; Faz 3 gelince kişiselleşir.
- [ ] `/agent/dashboard` → ilan akışı: kart görünümü, her kartta **kaynak grup adı**, fiyat, oda, m², konum, geliş zamanı.
- [ ] Filtreler: grup, fiyat aralığı, oda sayısı, il/ilçe.
- [ ] `listings` tablosuna kaynak grup bilgisinin taşınması (veya join ile okunması — planda karar).
- [ ] **Site içi bildirim** (zil simgesi, "N yeni ilan") — önerilen ilk adım.
- [ ] Sonra: **tarayıcı bildirimi** (Web Push). iPhone'da siteyi ana ekrana ekleme gerektirir; adım adım yönlendirme ekranı gerekir.
- Plan farkları (`max_listings`) bu fazda uygulanabilir.

### Faz 3 — Emlakçının kendi WhatsApp'ını bağlaması _(büyük, en riskli, 2-3 görev)_
Amaç: Her emlakçı kendi gruplarından kendi ilanlarını görür.
- [ ] "WhatsApp'ını bağla" ekranı: QR kod ile giriş (bugünkü sidecar'ın emlakçı başına oturum açan hali).
- [ ] Oturum yönetimi: emlakçı başına ayrı oturum, güvenli saklama, kopunca emlakçıya haber.
- [ ] Grup seçimi ekranı: bağlı hesabın grupları listelenir, emlakçı işaretler.
- [ ] Çekilen ilanlar sadece o emlakçıya görünür (`raw_listings`/`listings`'e `agent_id`, RLS).
- [ ] Admin onayı: emlakçı başına ilanlarda elle onay sürdürülebilir değil → kalite eşiğinin üstündekiler otomatik geçsin, altındakiler kuyruğa (planda karar).
- [ ] Altyapı: emlakçı sayısı kadar eşzamanlı WhatsApp oturumu → sunucu kaynağı ve yeniden bağlanma stratejisi.
- ⚠️ Başlamadan önce R1 ve R2 kullanıcıyla tekrar konuşulmalı.

### Faz 4 — Bot (ilan hazırlama + paylaşım yardımı) _(büyük)_
- [ ] Bize ait bot numarası: emlakçı ilanı atar → bot ayrıştırır → düzgün formatlı ilan metni + (varsa) video linkiyle geri döner.
- [ ] Önerilen ilk sürüm: bot **hazırlar**, emlakçı **tek tıkla kendisi paylaşır** (grup/durum). Otomatik paylaşım ancak R1 değerlendirmesinden sonra.

---

## 4. Riskler

| # | Risk | Etki | Öneri |
|---|---|---|---|
| R1 | **WhatsApp ban riski.** Resmi Business API gruba mesaj ve durum paylaşımını desteklemiyor; bunlar gayriresmi kütüphaneyle (Baileys) yapılıyor. Emlakçının **kendi iş numarasıyla** otomatik işlem yapmak o numarayı kapatabilir. | Çok yüksek — müşterinin ana iş hattı | Faz 3'te sadece **okuma** (ilan çekme), yazma yok. Faz 4'te otomatik paylaşım yerine "hazırla + tek tıkla paylaş". Kullanıcıya bu riski kayıt sırasında açıkça söyle. |
| R2 | Emlakçı başına WhatsApp oturumu = emlakçının tüm mesajlarına erişim. | KVKK + güven | Sadece seçilen grupları işle, diğerlerini hiç saklama; bunu gizlilik metninde yaz. Oturum anahtarlarını şifreli sakla. |
| R3 | Ham video dosyaları büyük, yükleme yavaş/kopuk. | Orta | Parçalı/devam ettirilebilir yükleme, net boyut limiti, mobilde ilerleme göstergesi. |
| R4 | Sahte destek numarası / mock fiyat canlıya kaçar. | Orta | Tek yerde tanımla, açılış kontrol listesine ekle (aşağıda). |
| R5 | Admin her ilanı elle onaylıyor; Faz 3'te hacim patlar. | Yüksek | Otomatik onay eşiği (mevcut `quality_score`). |
| R6 | Hedef kitle teknolojiyle arası iyi değil; QR ile bağlama, dosya yükleme, tarayıcı bildirim izni zor adımlar. | Yüksek (dönüşüm) | Her zor adımda ekran görüntülü yönlendirme + WhatsApp destek butonu. |

---

## 5. Açık sorular (fazı başlatmadan önce cevaplanmalı)

| Soru | Hangi faz |
|---|---|
| Bildirim: önce site içi mi, tarayıcı bildirimi mi? (öneri: site içi) | Faz 2 |
| Video siparişinde ödeme siparişte mi, teslimde mi alınır? | Faz 1 |
| Yerinde çekim hangi şehirlerde? Uygun değilse sipariş nasıl reddedilir? | Faz 1 |
| Teslim süresi ne kadar söz verilecek? | Faz 1 |
| Ham video için boyut/süre limiti? | Faz 1 |
| Abonelik planları neyle farklılaşacak? (bağlı grup sayısı? aylık ilan? dahil video?) | Faz 0 / Faz 2 |
| Faz 3'te ilanlar admin onayından geçmeye devam edecek mi? | Faz 3 |
| Marka adı | Faz 0 (sonra) |

---

## 6. Açılış öncesi kontrol listesi
- [ ] Sahte destek numarası → gerçek numara
- [ ] Mock video/çekim fiyatları → gerçek fiyatlar
- [ ] "(placeholder)" plan adları → gerçek planlar
- [ ] KVKK / gizlilik / kullanım şartları taslakları → hukuken kontrol edilmiş metinler
- [ ] iyzico test anahtarları → canlı anahtarlar

---

## 7. Önerilen başlangıç
**Faz 0** ile başla: küçük, hızlı, yanlış vaadi kaldırır ve siteyi bugünkü ürüne dürüst hale getirir. Ardından **Faz 1** (video siparişi) — WhatsApp riskinden bağımsız ve ilk geliri getirecek parça.
