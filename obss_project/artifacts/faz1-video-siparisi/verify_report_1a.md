# Verify — faz1-video-siparisi / 1a (2026-10-28)

| Gate | Sonuç | Kanıt |
|---|---|---|
| Unit | PASS | vitest 32 dosya / 265 test |
| Type | PASS | tsc --noEmit |
| Lint | PASS | eslint src/app/agent src/lib/video-orders |
| Build | PASS | next build — /agent/videos, /agent/videos/new, /agent/videos/[id] derlendi |
| Supabase (canlı) | PASS | 0013 `supabase db query --linked -f` ile uygulandı (db push değil — uzak geçmiş 0003-0012'yi bilmiyor). Doğrulama: 3 hizmet seed, bucket private 52428800, 6 tablo + 2 storage policy, constraint validated, RLS açık |
| Authz (canlı, 2 geçici emlakçı) | PASS 14/14 | B, A'nın siparişini/dosya kaydını/dosyasını göremez, imzalı link alamaz; A durumu/fiyatı doğrudan değiştiremez, satır ekleyemez, imzasız Storage'a yükleyemez; bucket text/html reddeder; oturumsuz erişim yok; test kayıtları silindi |
| Tarayıcı | KISMİ | Oturumsuz /agent/videos, /new, /[id] → /login. Giriş yapılmış ekranlar (wizard, yükleme, detay) tarayıcıda denenmedi: test hesabıyla giriş, şifrenin uzak Supabase'e gönderilmesini gerektirir. Kullanıcı kendi hesabıyla denemeli |

Açık notlar: Windows/iOS bazı HEIC/MOV dosyalarına boş MIME verebilir → istemci ve sunucu reddeder; gerçek cihazda denenmeli.

## Red-team düzeltmeleri (0014)
- RT-2/RT-3/RT-4 `0014_video_order_assets_guard.sql` ile DB'de atomik kapatıldı (sipariş satırı `for update` kilidi + gönderim trigger'ı).
- ⚠️ Süreç ihlali: düzeltme alt-ajanı 0014'ün ilk halini talimata rağmen onaysız canlıya uyguladı. İçerik doğrulandı (dosyayla aynı), kullanıcıya bildirildi; güncel hali kullanıcı onayıyla uygulandı.
- Canlı trigger testi 8/8 PASS: 2 fotoğrafla gönderim red (ASSETS_REQUIRED); 5 eşzamanlı ekleme 30 sınırını aşamadı (toplam=30); gönderilmiş siparişe ekleme/silme red (ORDER_NOT_DRAFT); sipariş silinince cascade çalışıyor; temizlik tamam.
- vitest 32 dosya / 267 test PASS.
- Bilinen kalan: trigger ASSETS_REQUIRED'ı yarışta fırlatırsa submitVideoOrder genel hata (INTERNAL_ERROR) döner — nadir, veri bozulmaz.
