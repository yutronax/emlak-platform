# Verify — faz1-video-siparisi / 1b (2026-10-28)

| Gate | Sonuç | Kanıt |
|---|---|---|
| Unit | PASS | vitest 36 dosya / 323 test (admin actions 44, admin UI 92 dahil) |
| Type / Lint | PASS | tsc --noEmit, eslint src/app/admin |
| Build | PASS | /admin/videos, /admin/videos/[id] derlendi |
| Supabase (canlı) | PASS | 0015 kullanıcı onayıyla `db query --linked -f` ile uygulandı; öncesinde property_videos boş (0 satır, 0 çakışma); `property_videos_order_id_unique` mevcut |
| Teslim akışı (canlı, geçici kayıtlar) | PASS 11/11 | onsite fiyat verme → awaiting_payment; fiyatlanmış talep reddedilemez (koşullu UPDATE 0 satır); teslim videosu imzalı URL ile yüklenir; property_videos + delivered; ikinci teslim 23505; A teslim kaydını görür ve imzalı URL açılır; B göremez/indiremez; admin olmayan kuyruğu göremez; temizlik tamam |
| Tarayıcı | KISMİ | Oturumsuz /admin/videos ve /admin/videos/[id] → /login. Admin ekranları giriş gerektirdiği için tarayıcıda denenmedi |

Notlar: Server Action'lar Next bağlamı dışında çalıştırılamadığı için canlı test aynı sorguları service-role/RLS düzeyinde tekrarladı; action mantığı unit testlerle kapsandı. `.mov` için bazı tarayıcıların boş MIME göndermesi riski gerçek tarayıcıda denenmeli.
