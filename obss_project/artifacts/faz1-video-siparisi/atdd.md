---
task_slug: faz1-video-siparisi
priority: high
threat_model: required   # dosya yükleme + ödeme + emlakçılar arası veri izolasyonu
affected_modules: [supabase/migrations, web/src/lib/payments, web/src/app/api, web/src/app/agent, web/src/app/admin/videos]
test_strategy: unit (vitest/RTL) + gerçek Supabase'e migration doğrulaması (supabase-check) + canlı tarayıcı
delivery: 3 commit — 1a (şema + emlakçı siparişi/yükleme), 1b (admin kuyruğu + teslim), 1c (ödeme)
---
# ATDD — Faz 1: Reklam videosu siparişi

Referans: `obss_project/artifacts/yol-haritasi.md` §1B, §3 Faz 1.

## Kullanıcı kararları (2026-10-28)
| Konu | Karar |
|---|---|
| Ödeme zamanı | Siparişte peşin (iyzico). Ödeme gelmeden editör kuyruğuna düşmez. |
| Teslim sözü | Ödemeden itibaren **2 iş günü** (Cmt/Paz sayılmaz). Tek sabitte tanımlı. |
| Ham video sınırı | Dosya başı **500 MB**, sipariş başı **en fazla 5** dosya. |
| Yerinde çekim | Sadece **talep** alınır: adres + uygun zaman notu. Admin uygunsa fiyat verir, değilse reddeder. |
| Fiyatlar | Mock — sunucuda tek yerde (DB), istemciden gelen fiyat asla kullanılmaz. |

## Persona
Teknolojiyle arası iyi olmayan emlakçı, çoğunlukla telefondan. Editör/admin: masaüstü.

## Akış
- **Fotoğraftan / ham videodan:** emlakçı hizmet seçer → mülk bilgisi (başlık, adres) → dosyaları yükler → özet (fiyat + "ödemeden sonra 2 iş günü içinde teslim") → öder → sipariş editör kuyruğuna düşer → editör bitmiş videoyu yükler → emlakçı izler/indirir.
- **Yerinde çekim:** emlakçı hizmet + mülk + adres + uygun zaman notu girer → "fiyat teklifi bekleniyor" → admin fiyat verir (ödeme bekleniyor) ya da reddeder (iptal, gerekçeli) → emlakçı öder → kuyruk → teslim.

## Durumlar
`draft` (dosya yükleniyor) → `awaiting_payment` → `in_progress` (ödendi, `due_at` hesaplandı) → `delivered`
Yerinde çekim: `quote_pending` → `awaiting_payment` | `canceled`
Ödeme hatası: `awaiting_payment` → `payment_failed` (tekrar ödenebilir)
Geçersiz geçişler reddedilir.

## Acceptance Criteria

### 1a — Şema + emlakçı siparişi/yükleme
- **AC-1** Migration: `video_services` (kod, ad, `price_minor_unit` — onsite için null), `video_orders`, `video_order_assets`, `property_videos.order_id`, `payment_events.video_order_id` (subscription_id veya video_order_id'den tam biri dolu), private bucket `video-order-assets` (izinli MIME: jpeg/png/webp/heic + mp4/quicktime/webm). Mock fiyatlar seed edilir. Gerçek Supabase projesine uygulanır ve doğrulanır.
- **AC-2** `/agent/videos`: emlakçının siparişleri (durum rozeti, mülk başlığı, tarih, varsa teslim tarihi), "Yeni video siparişi" butonu. Boş durumda ne yapacağını anlatan mesaj.
- **AC-3** `/agent/videos/new`: adım adım form — hizmet seçimi (3 kart) → mülk başlığı + adres → (fotoğraf/video) dosya yükleme veya (yerinde) uygun zaman notu → özet (sunucudan gelen fiyat, teslim sözü) → "Siparişi gönder". Mobilde rahat kullanılır.
- **AC-4** Yükleme: tarayıcıdan doğrudan Storage'a (Server Action gövdesinden geçmez), her dosya için ilerleme, kopunca hata + tekrar dene. Fotoğraf: en fazla 30, tanesi 20 MB. Ham video: en fazla 5, tanesi 500 MB. Yükleme bitmeden "devam" pasif.
- **AC-5** `/agent/videos/[id]`: durum, yüklenen dosyalar, (yerinde çekimde) teklif/red gerekçesi, (teslimde) video oynatıcı + indir.
- **AC-6** Dashboard ve agent navigasyonundan `/agent/videos`'a link.

### 1b — Admin kuyruğu + teslim
- **AC-7** `/admin/videos` sipariş kuyruğuna dönüşür: `Teklif bekleyen` / `Hazırlanacak` (in_progress, `due_at`'e göre, gecikenler vurgulu) / `Teslim edilen` / `İptal`. Mevcut "mülk seç → video yükle" ekranı sipariş detayıyla değiştirilir.
- **AC-8** Sipariş detayı: emlakçı + mülk bilgisi, dosyaları indir (kısa ömürlü imzalı link), yerinde çekim için "fiyat ver" / "reddet (gerekçe)", "bitmiş videoyu yükle" (doğrudan Storage'a) → `delivered`, `delivered_at`.
- **AC-9** Teslim videosu emlakçıya sadece sahiplik kontrolünden sonra kısa ömürlü imzalı URL ile verilir.

### 1c — Ödeme
- **AC-10** `POST /api/video-orders/[id]/checkout`: sadece sahibi, sadece `awaiting_payment`/`payment_failed`; tutar DB'den; iyzico oturumu, `checkout_url` döner. iyzico fonksiyonu plan'a bağımlı olmaktan çıkarılıp tutar/sepet parametresi alır — abonelik davranışı DEĞİŞMEZ, mevcut testler geçer.
- **AC-11** Webhook: olay `video_order_id` taşıyorsa — `PAYMENT_SUCCESS` → `in_progress`, `paid_at`, `due_at` = 2 iş günü sonrası; `PAYMENT_FAILED` → `payment_failed`. Aynı imza doğrulaması ve idempotency. Abonelik yolu aynen çalışır.
- **AC-12** Özette "Öde" → iyzico; dönüşte sipariş detayında güncel durum.

## Güvenlik kriterleri (threat-model)
- **AC-S1 (IDOR):** Emlakçı başka emlakçının siparişini, dosyasını, teslim videosunu göremez/değiştiremez — RLS + Storage yolu `${agent_id}/${order_id}/...` + sunucu sahiplik kontrolü. İki farklı emlakçı ile testlenir.
- **AC-S2 (fiyat):** Fiyat hiçbir istekte istemciden alınmaz.
- **AC-S3 (yükleme):** Yol sunucuda üretilir; imzalı yükleme URL'si tek dosya, kısa ömürlü, sadece kendi `draft` siparişine; MIME/uzantı izinli listesi; boyut ve sayı sınırı sunucuda zorlanır.
- **AC-S4 (durum):** Emlakçı sadece `draft → awaiting_payment` (gönder) ve `quote_pending` oluşturabilir; `in_progress`/`delivered`/fiyat yazamaz. Admin aksiyonları `requireAdmin` + RLS.
- **AC-S5 (webhook):** İmza DB'den önce; tekrar eden olay no-op; bilinmeyen sipariş → log, state değişmez.
- **AC-S6 (teslim):** Teslim videosu ve hammaddeler sadece ≤10 dk ömürlü imzalı URL ile.

## Davranış sözleşmesi
| Durum | Beklenen |
|---|---|
| Oturumsuz `/agent/videos*` | `/login`'e yönlendirme |
| Başkasının sipariş id'si | 404 (varlığı sızdırılmaz) |
| Checkout yanlış durumda | 409 `INVALID_STATE` |
| Yerinde çekim fiyatsızken checkout | 409 `QUOTE_PENDING` |
| 6. video / 31. fotoğraf | Sunucu reddeder, form açık hata gösterir |
| Desteklenmeyen dosya türü | Yükleme başlamadan reddedilir |
| iyzico zaman aşımı | 504, sipariş `awaiting_payment` kalır |
| Aynı webhook iki kez | İkincisi no-op |

## Kapsam dışı
Video siparişi için abonelik şartı (varsayım: giriş yeterli), para iadesi, ayrı editör rolü (admin = editör), e-posta bildirimi, revizyon talebi, public galeri.

## Risks / Assumptions / Unknowns
- **Karar (2026-10-28): 50 MB ile başla.** Önceki unknown: Supabase projesinin planı. Ücretsiz planda dosya başı üst sınır 50 MB; 500 MB için Pro plan + proje ayarından limit yükseltme gerekir. Doğrulanana kadar bucket limiti 50 MB kurulur; limit tek sabitten 500 MB'a çıkarılır.
- Büyük dosyalar için Supabase resumable (TUS) yükleme gerekir; standart yükleme birkaç MB üstünde güvenilmez.
- Webhook gövde şeması projeye özel (`event_id`, `event_type`, `subscription_id`); `video_order_id` aynı sözleşmeye eklenir.
- Mock fiyatlar: fotoğraftan 750,00 ₺, ham videodan 750,00 ₺, yerinde çekim teklifle.

## Rollback
Her alt faz ayrı commit; migration yeni tablo + nullable sütun ekler, mevcut veriye dokunmaz.
