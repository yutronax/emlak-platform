# Frontend Verify Report — durum-ekranlari

**Durum: FRONTEND-PARTIAL** — 404 tarayıcıda doğrulandı; hata ve yükleme ekranları yalnız unit testlerle
(tarayıcıda tetiklenmedi). Servis yok, mock yok.

## Dosyalar
- `app/not-found.tsx` (metadata başlığı), `app/error.tsx`, `app/global-error.tsx` (kendi html/body + globals.css)
- `app/{agent,account,admin}/loading.tsx` → `components/status/page-skeleton.tsx`
- `components/status/{status-screen,error-screen}.tsx`; `auth-shell.tsx` dokusu `brandTexture` olarak dışa açıldı

## Gate'ler
| Gate | Sonuç |
|---|---|
| Yeni testler | PASS — 7 |
| Tüm testler | PASS — 93 dosya / 1190 test |
| tsc / eslint | PASS |
| Build | ÇALIŞTIRILMADI |

## Tarayıcı [`/boyle-bir-sayfa-yok`]
| Viewport | Sonuç |
|---|---|
| 1440×900 | taşma yok, "Ana sayfa" alt kenarı 562px (ilk ekran), sekme başlığı "Sayfa bulunamadı · Emlak Platformu" |
| 768×1024 | taşma yok |
| 390×844 | taşma yok, birincil aksiyon 539px |

## Notlar
- Hata ekranı mesajı göstermez; yalnız `digest` ("Hata kodu"). Odak başlığa taşınır.
- `global-error` Google fontlarını yüklemez (sistem fontu) — Next dokümanına göre kendi stillerini taşımalı.
- `loading.tsx` panel layout'unun `getUser` beklemesini kapsamaz (Next: layout'taki çalışma zamanı verisi
  fallback'i bloklar); yalnız sayfa verisi yüklenirken görünür.
