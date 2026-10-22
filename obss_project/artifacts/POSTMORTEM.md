# Postmortem — emlak-platform

## Koşum 1 — 2026-10-20
Görev sayısı: 8 (supabase-proje-kurulumu, agents-self-update-rls-yetki-yukseltme-acigi,
pricing-plans-sort-order-fix, eml-20-scraper-webhook-auth,
abonelik-plani-odeme-entegrasyonu, webhook-subscription-id-dogrulama,
agent-dashboard-auth-ve-ilan-akisi, admin-listings-defense-in-depth)
Toplam bulgu: 16 (3 medium, 13 low — hiç critical/high yok)

### Kategori dağılımı
| Kategori | Bulgu | Farklı görev |
|---|---|---|
| test-gap | 5 | 4 |
| reliability | 3 | 2 |
| other | 3 | 2 |
| scope | 2 | 1 |
| correctness | 2 | 2 |
| maintainability | 1 | 1 |

### Tekrar eden kategoriler (süreç kusuru adayları)
- **test-gap** (4 görev: agents-self-update-rls, eml-20-scraper-webhook-auth,
  pricing-plans-sort-order-fix, webhook-subscription-id-dogrulama) — en
  büyük sinyal, 8 görevin yarısında çıktı.
- **reliability** (2 görev: abonelik-plani-odeme-entegrasyonu,
  supabase-proje-kurulumu)
- **correctness** (2 görev: eml-20-scraper-webhook-auth, supabase-proje-kurulumu)

### Sıcak dosya
`web/src/app/api/webhooks/payment/route.ts` — 2 bulgu, 2 FARKLI görevde
(EML-5'in ilk yazımı + EML-30'un subscription_id doğrulaması). Aynı dosya
art arda iki kez PM incelemesinde bulgu aldı — mimari sinyal, "tek görevde
şanssızlık" değil.

### Verify gate notu
`AI code review` ve `İnsan onayı` her 8 görevde de PENDING — bu bir kalıp
DEĞİL, bu ikisi tasarımca her zaman son adıma kadar PENDING kalıyor (bkz.
`verify` skill'in kendi kuralı: "İnsan onayı her zaman son adım, asla done
yazılmaz"). Elendi, eyleme dönüştürülmedi.

### Önerilen somut eylemler

1. **`test-copilot` skill'ine madde:** Davranış Sözleşmesi tablosunda
   "ikinci seviye hata" satırı varsa (bir fallback'in KENDİSİ başarısız
   olursa ne olur — örn. AC-5'in "needs_review update'i de başarısız
   olursa" dalı, AC-3'ün "needs_review update'i başarısız olursa" dalı),
   bu satır için AYRI ve AÇIK bir test yazılmalı; "ana senaryo test
   edildiyse ikincisi de dolaylı kapsanır" varsayımı yapılmasın.
   Gerekçe: test-gap kategorisinin 5 bulgusunun en az 2'si (webhook
   görevlerinde) tam bu kalıptan çıktı — ikinci seviye hata dalları
   birincil testin "yanına" eklenmek yerine atlanıyordu.
   **Nereye:** `test-copilot` SKILL.md'nin "Davranış Sözleşmesi" bölümüne.

2. **`refactor` skill'ine aday işareti:** `web/src/app/api/webhooks/payment/route.ts`
   artık 2 farklı görevde PM bulgusu biriktirdi (sıcak dosya eşiği). Bir
   sonraki bu dosyaya dokunan görevde `verify`'ın "Refactor Aday Kontrolü"
   adımı bu dosyayı ÖZEL OLARAK değerlendirmeli (tek handler'da büyüyen
   if/else zinciri — AC-1/AC-S1/AC-3/AC-S2/AC-5/AC-6 hepsi aynı `POST`
   fonksiyonunda) — kullanıcıya `refactor` önerisi bu sefer somut bir
   dosya adıyla yapılmalı, genel bir "bakılsın" değil.
   **Nereye:** `verify` SKILL.md'nin Refactor Aday Kontrolü bölümüne bir
   not, ve bir sonraki webhook/payment görevinde doğrudan uygulanacak.

3. **Henüz kalıp sayılmayan:** `reliability`/`correctness` ikişer görevde
   çıktı ama 8 görevlik bir örneklemde bu eşik "henüz veri yetersiz"
   sınırında — üçüncü bir tekrar gelmeden ek bir kontrol listesi maddesi
   EKLENMEDİ (postmortem'in kendi kuralı: az veriden kalıp uydurma).

## Koşum 2 — 2026-10-22
Görev sayısı: 13 (Koşum 1'deki 8 + yeni: account-subscription-coklu-kayit-secimi,
checkout-reconciliation-job, login-role-aware-redirect,
scraper-dm-grup-filtresi, signup-agents-kaydi-olusturma)
Toplam bulgu: 22 (5 medium, 17 low — hiç critical/high yok)

### Kategori dağılımı
| Kategori | Bulgu | Farklı görev |
|---|---|---|
| reliability | 6 | 4 |
| test-gap | 6 | 5 |
| other | 3 | 2 |
| scope | 2 | 1 |
| correctness | 2 | 2 |
| maintainability | 2 | 2 |
| readability | 1 | 1 |

### Tekrar eden kategoriler (süreç kusuru adayları)
- **reliability** (4 görev — 2 yeni: checkout-reconciliation-job,
  scraper-dm-grup-filtresi; 2 Koşum 1'den devam eden: abonelik-plani-odeme-
  entegrasyonu, supabase-proje-kurulumu). 3 bulgu ortak bir kalıp paylaşıyor:
  beklenen/başarılı bir yol çalışıyor ama bunu operatörün gözlemlemesini
  sağlayan HİÇBİR log/sayaç/metrik yok (checkout-reconciliation-job'ta
  başarılı güncellemeler hiç loglanmıyor; scraper-dm-grup-filtresi'nde
  grup+boş-metin durumunda hiçbir sayaç artmıyordu; abonelik-plani-odeme-
  entegrasyonu'nda subscription_id bulunamayınca sadece console.warn,
  izlenebilir bir durum/sayaç yok). Üçü de "sessizce doğru ya da sessizce
  eksik" — ikisi ayırt edilemiyor.
- **test-gap** (5 görev, Koşum 1'den devam — sadece 1 yeni görev:
  scraper-dm-grup-filtresi). Koşum 1'in "ikinci seviye hata" düzeltmesi
  (zaten `test-copilot` SKILL.md'ye eklenmişti) farklı bir alt-kalıbı
  kapsıyordu; scraper-dm-grup-filtresi'nin bulgusu (sayaç DEĞERİ hiç assert
  edilmemiş, sadece dolaylı/fetch-call-count üzerinden) henüz 3 tekrara
  ulaşmadı — ayrı bir kontrol listesi maddesi olarak EKLENMEDİ, izlemede
  tutuluyor (az veriden kalıp uydurma yasak).

### Sıcak dosya
`web/src/app/api/webhooks/payment/route.ts` — Koşum 1'den bu yana yeni
bulgu almadı (bu koşumun 22 bulgusunun hiçbiri bu dosyada değil); Koşum
1'in eylemi (verify'ın refactor-aday kontrolüne özel not) hâlâ yürürlükte,
dosya bir sonraki dokunulduğunda tekrar değerlendirilecek.

### Verify gate notu
`AI code review` ve `İnsan onayı` yine her görevde PENDING — Koşum 1'deki
aynı gerekçeyle (tasarım gereği) elendi, eyleme dönüştürülmedi.

### Önerilen somut eylemler

1. **`atdd` şablonuna madde:** Davranış Sözleşmesi tablosunun her satırı
   artık "dönen değer/yan etki" ile birlikte **"operatör bunu nasıl fark
   eder"** sorusunu da düşünmeli — bir yol sessizce başarılı VEYA sessizce
   eksik kalabiliyorsa (log yok, sayaç yok, metrik yok), bu satırda açıkça
   bir log/sayaç/metrik taahhüt edilmeli ve `test-copilot` bunu test
   etmeli. Gerekçe: bu koşumun `reliability` bulgularının 3'ü (4 görevin
   3'ü) tam bu kalıptan çıktı — "çalışıyor ama görünmez" sessiz hata
   sınıfı, `atdd`'nin mevcut "kısmi başarı"/"hiçbir şey yapılamadı"
   satırlarıyla örtüşüyor ama onlardan farklı: burada hata YOK, sadece
   GÖRÜNÜRLÜK yok.
   **Nereye:** `atdd` SKILL.md'nin 4a adımındaki Davranış Sözleşmesi
   tablosu talimatına bir satır — "operatör görünürlüğü" sütunu/notu.

2. **Henüz kalıp sayılmayan:** scraper-dm-grup-filtresi'nin "sayaç DEĞERİ
   assert edilmemiş" test-gap bulgusu tek örnek — üçüncü bir tekrar
   gelmeden `test-copilot`'a yeni bir madde EKLENMEDİ.
