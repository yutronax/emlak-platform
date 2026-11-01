# Frontend Verify Report — kullanici-profili

**Durum: FRONTEND-READY / MOCKED** — UI mock servisle tamam; gerçek profil servisi yok (backend soruları contract sonunda).
Production'da sayfa `notFound()` döner; mock bayrağı production'da hata fırlatır.

## Gate'ler
| Gate | Sonuç | Kanıt |
|---|---|---|
| Unit (yeni) | PASS | validation, service, profile-view: 32 test |
| Unit (tümü) | PASS | 88 dosya / 1140 test |
| tsc --noEmit | PASS | |
| eslint | PASS | 0 hata |
| Build | ÇALIŞTIRILMADI | |

## Tarayıcı [Browser pane, next dev, `NEXT_PUBLIC_PROFILE_MOCK=1`]
| Viewport | Sekme | Taşma | Not |
|---|---|---|---|
| 1440×900 | Şirket | yok (1425/1440) | 90 karakterlik şirket adı başlıkta 2 satıra sarıldı (V-3) |
| 390×844 | Güvenlik (`?tab=guvenlik`) | yok (390), tablist 390/390 | yanlış mevcut şifre → hata alanda, `aria-invalid`, odak alanda |
| 768×1024 | Bildirimler | yok, taşan öğe 0 | 4 switch |

Konsol hatası yok. 390px ekran görüntüsü sağdan kırpık görünüyor; `visualViewport.scale=1` ve taşan öğe sayısı 0 —
araç kırpması, sayfa sorunu değil. `vision-test` çalıştırılmadı.

## Bilinçli kararlar
- Mock açıkken (yalnız dev) oturum kontrolü atlanır ki tasarım oturumsuz görülebilsin; gerçek serviste kontrol yapılır.
- Header'da giriş yapmış kullanıcı menüsü yok → profile bağlantı eklenmedi (kapsam dışı).
- `web/.env.local`'a `NEXT_PUBLIC_PROFILE_MOCK=1` eklendi (yerel, commit edilmez).
