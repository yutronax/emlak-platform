# HANDOFF — emlak-platform

Son güncelleme: 31 Ekim 2026. Mevcut kod ve yerel inceleme özetidir; canlı servis veya Jira durumu doğrulaması değildir.

## Mevcut kapsam

- Müşteri sayfaları, hesap, şifre yenileme ve rol yönlendirmesi.
- Ortak WhatsApp köprüsü ve kişisel QR bağlantısı, grup seçimi, oturum yönetimi.
- Gemini ayrıştırma, kalite puanı, DB dedup, admin incelemesi.
- Filtreli ilan akışı, kişisel kapsam, günlük plan limitleri, deneme/şartlar, okunmamış sayaç, web push.
- Video siparişi, kaynak yükleme, yerinde çekim talebi, teklif, ödeme ve özel teslim.
- Abonelik/video checkout, ortak ödeme webhook'u; uzlaştırma ve push cron'ları.
- Migration dosyaları 0024'e kadar mevcut. Anonim plan okuma: 0010; video siparişi: 0013–0015; kişisel WhatsApp: 0023–0024.

Eski devir notundaki eksik video/grup seçimi/bildirim ve anonim plan erişimi açıklamaları artık kodu yansıtmıyor. Dosyaların mevcut olması canlı DB'ye uygulandıklarının kanıtı değildir.

## Son doğrulama

31 Ekim 2026 yerel inceleme kaydı:

| Kontrol | Sonuç |
|---|---|
| Web | 82 dosya, 1.073 başarılı test |
| Python | 155 başarılı, 11 atlandı |
| Sidecar | 139 başarılı, 1 atlandı |
| TypeScript | Hata yok |
| ESLint | 0 hata, 5 uyarı |

Production build, tarayıcıda görsel kontrol, canlı ödeme/WhatsApp/push ve Supabase RLS/Storage bu incelemede doğrulanmadı. Atlanan testler başarılı sayılmamalıdır.

## Takip edilecek işler

- Scraper kuyruğu ve executor bekleyen işleri için kapasite, geri basınç ve kalıcılık.
- Gerçek servislerle ödeme/webhook, WhatsApp/grup seçimi, dosya erişimi ve push teslim doğrulaması.
- Migration dağıtımında *.down.sql dosyalarının ileri migration olarak alınmadığının kontrolü.
- Gerçek fiyat ve ticari metinlerin kontrolü.
- Önceki notlarda geçen geçmiş kişisel veri temizliği konusunun ayrıca değerlendirilmesi; bu incelemede canlı veri kontrolü veya silme yapılmadı.

## Destek ve belgeler

Destek **+90 531 840 77 44**, [WhatsApp](https://wa.me/905318407744). Tek kaynak web/src/lib/contact.ts.

[Kurulum](README.md) · [Mimari](docs/ARCHITECTURE.md) · [Ekip akışı](docs/WORKFLOW.md)

Tarihli artifact ve yol haritası geçmiş bağlam olarak okunmalı; kodla karşılaştırılmadan açık iş kabul edilmemelidir. Kullanıcının önceden mevcut çalışma alanı değişikliklerini yeni işlerle birlikte istemeden commit etmeyin.

