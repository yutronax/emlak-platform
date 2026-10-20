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
