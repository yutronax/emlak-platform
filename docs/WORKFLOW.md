# Ekip İş Akışı

Son güncelleme: 31 Ekim 2026.

## İlan akışı

1. Emlakçı WhatsApp hesabını QR ile bağlar, gruplarını seçer.
2. Sidecar mesajı worker'a iletir; kişisel yolda grup seçimi doğrulanır, Gemini ayrıştırması yapılır.
3. Kişisel ilan DB kalite kararına göre onaylanır veya beklemeye alınır. Ortak ilanlar admin onayına gider.
4. Admin /admin/listings üzerinden bekleyen ilanları inceler.
5. Emlakçı /agent/dashboard üzerinden yetki ve plan limitleri içinde ilanları filtreler; okunmamış sayaç ve etkinleştirilmişse push bildirimi kullanır.

## Video hizmeti

1. Emlakçı /agent/videos/new üzerinden hizmet seçer; kaynak yükler veya yerinde çekim adresi/zaman notu bırakır.
2. Admin/editör /admin/videos ve sipariş detayından kuyruğu yönetir, gerektiğinde teklif verir.
3. Emlakçı ödeme bekleyen siparişi öder; webhook sonucuyla sipariş hazırlanma durumuna geçer.
4. Yerinde çekim gerekiyorsa kameraman kaynakları editöre verir; editör reklam videosunu hazırlar.
5. Admin tamamlanan videoyu sipariş detayından yükler ve teslim eder. Emlakçı kendi sipariş ekranından videoya erişir.

Kurgu insan eliyle yapılır. Mevcut admin ekranı yükleme ve teslimi destekler; bitmiş dosyanın geliştiriciye elle verilmesi gereken eski akış güncel değildir.

## Teknik devir

- Backend: webhook, ayrıştırma, oturum/grup yönetimi, dedup ve veri yazımı.
- Web: hesap, ilan akışı, admin incelemesi, sipariş, ödeme ve teslim arayüzleri.
- Ortak sözleşme: supabase/migrations/, RPC parametreleri ve Storage kuralları.
- Destek: [WhatsApp +90 531 840 77 44](https://wa.me/905318407744); tek kaynak web/src/lib/contact.ts.

Güncel görev atamaları iş panosunda tutulur. Tarihli artifact'ler geçmiş karar/test kanıtlarıdır; mevcut özellikler için [README](../README.md) ve [mimari](ARCHITECTURE.md) esas alınır.

