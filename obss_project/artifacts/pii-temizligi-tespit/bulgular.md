# PII Temizliği — Tespit Bulguları (#23)

Tarih: 2026-10-25

## Soru
EML-51 düzeltmesinden (bridge.js'in DM'leri grup mesajlarından ayırması,
commit `b811871`, 2026-10-22 20:42) ÖNCE `raw_listings` tablosuna sızmış
olabilecek DM (PII) kayıtları var mı?

## Kesin Ayraç
`b811871` öncesi bridge.js, grup/DM ayrımı yapmadan her mesajı
`{id, text, group: remoteJid}` şeklinde orchestrator'a POST ediyordu.
`orchestrator.py:67` bu `group` alanını birebir `source_group` kolonuna
yazıyor. Sonuç: bir satırın `source_group` değeri gerçek bir grup JID'i
(`...@g.us`) DEĞİLSE, o alanın içeriği **doğrudan gönderenin telefon
numarasıdır** (`...@s.whatsapp.net`) — yani sızıntının kendisi
`source_group` kolonunda görünür hâlde durur.

Sorgu: `raw_listings` tablosunda `source_group` değeri `@g.us` ile
BİTMEYEN her satır bir DM sızıntısıdır.

## Sonuç (canlı Supabase'e karşı doğrulandı, service_role ile)
- `raw_listings` tablosundaki TOPLAM satır sayısı: **1**
- Bu 1 satır: `source_group = "905551234567-1111@g.us"` (grup JID'i,
  `source_message_id = "race-26196"` — muhtemelen `fingerprint-unique-
  constraint` görevinin canlı race-condition testinden kalan bir test
  kaydı), `created_at: 2026-10-22T18:17:29Z`.
- `source_group` değeri `@g.us` ile bitmeyen (DM şüpheli) satır sayısı:
  **0**.

## Değerlendirme
Şu an canlı veritabanında **hiç DM/PII sızıntısı kaydı yok**. `raw_listings`
tablosu approve/reject akışında hiçbir satırı silmiyor (migration'larda
`DELETE` yok) — yani bu, "silinmiş olabilir" değil, "hiç var olmamış veya
zaten temiz" anlamına geliyor. Olası açıklamalar:
1. Faz A'daki canlı WhatsApp testinde (EML-65) test numarasına kimse DM
   göndermedi — sadece grup mesajları işlendi.
2. Tablo bir noktada elle temizlenmiş olabilir (bu oturumda doğrulanamadı).

## Karar
Teknik olarak temizlenecek bir PII kaydı YOK. Kullanıcı kararı bekleniyor:
bu bulguyu kabul edip #23'ü kapatalım mı, yoksa ek bir doğrulama (örn.
`listings`/`properties` tablolarında da aynı kontrolü yapmak, ya da WhatsApp
sidecar'ının kendi log dosyalarını — varsa — tarihsel olarak incelemek)
isteniyor mu?
