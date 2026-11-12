# Frontend Sayfa Bilgisi — Genel Bakış

Bu klasör, emlak-platform'un tüm frontend sayfalarını tek tek, ayrıntılı ve
birbirine bağlantılı şekilde belgeler. Her sayfa dosyası: amaç/persona, URL,
durum, veri kaynağı (Supabase tablosu), gelen/giden bağlantılar, bileşenler,
erişim kuralı ve olmazsa olmazları içerir.

Kaynak: `obss_project/artifacts/is-listesi-ve-sayfa-envanteri.md` (backlog),
gerçek kod (`web/src/app/`), `docs/ARCHITECTURE.md`. 2026-10-27 itibarıyla
gerçek koddan çıkarıldı.

## Site Haritası (rol bazlı)

```
                      ┌─────────────────────────────────────┐
                      │         ANONİM ZİYARETÇİ             │
                      └─────────────────────────────────────┘
                                      │
          ┌───────────────┬──────────┼──────────┬───────────────┐
          ▼               ▼          ▼          ▼               ▼
   [01] Ana Sayfa   [02] Fiyat-  [03] Giriş  [04] Kayıt      (gelecek:
        "/"         landırma      "/login"    "/signup"      parola sıfırlama)
                    "/pricing"
          │               │          │          │
          │               │          └────┬─────┘
          │               │               │ giriş/kayıt başarılı
          │               │               ▼
          │               │     ┌─────────────────────┐
          │               │     │   rol-bazlı yönlendirme  │  (login/actions.ts, agents.is_admin)
          │               │     └─────────────────────┘
          │               │        │                │
          │               │        ▼                ▼
          │               │  ┌───────────┐   ┌──────────────┐
          │               │  │  EMLAKÇI   │   │    ADMİN      │
          │               │  └───────────┘   └──────────────┘
          │               │        │                │
          │               ▼        ▼                ▼
          │        ┌──────────────────┐   ┌───────────────────┐
          │        │ [06] Abonelik     │   │ [07] İlan Onay     │
          │        │ Detayı            │   │ "/admin/listings"  │
          │        │ "/account/        │   └───────────────────┘
          │        │  subscription"    │             │
          │        └──────────────────┘             ▼
          │               ▲                 ┌───────────────────┐
          │               │                  │ [08] Video Onay    │
          │        ┌──────────────────┐      │ "/admin/videos"    │
          │        │ [05] Emlakçı      │      └───────────────────┘
          │        │ Paneli            │
          │        │ "/agent/          │
          │        │  dashboard"       │
          │        └──────────────────┘
          │
          └──► [01] Ana Sayfa'daki public video galerisi (P3, henüz yok) buradan beslenir
```

## Sayfa Listesi

| # | Sayfa | URL | Rol | Durum | Dosya |
|---|---|---|---|---|---|
| 01 | Ana Sayfa (Landing) | `/` | Anonim | ✅ Yeniden tasarlandı (EML-80) | [01-ana-sayfa.md](01-ana-sayfa.md) |
| 02 | Fiyatlandırma | `/pricing` | Anonim/Emlakçı | ✅ Yeniden tasarlandı (EML-80) | [02-fiyatlandirma.md](02-fiyatlandirma.md) |
| 03 | Giriş | `/login` | Anonim | ✅ Yeniden tasarlandı (EML-80), rol-aware redirect kodda zaten var | [03-giris.md](03-giris.md) |
| 04 | Kayıt | `/signup` | Anonim | ✅ Yeniden tasarlandı (EML-80) | [04-kayit.md](04-kayit.md) |
| 05 | Emlakçı Paneli | `/agent/dashboard` | Emlakçı (auth) | ⚠️ Fonksiyonel ama stilsiz, pagination/filtre yok | [05-emlakci-paneli.md](05-emlakci-paneli.md) |
| 06 | Abonelik Detayı | `/account/subscription` | Emlakçı (auth) | ⚠️ Fonksiyonel ama stilsiz, iptal/fatura akışı yok | [06-abonelik-detayi.md](06-abonelik-detayi.md) |
| 07 | Admin İlan Onay | `/admin/listings` | Admin (auth) | ⚠️ MVP, pagination/filtre/test yok | [07-admin-ilan-onay.md](07-admin-ilan-onay.md) |
| 08 | Admin Video Onay | `/admin/videos` | Admin (auth) | ⚠️ MVP (EML-?), önizleme oynatıcı yok | [08-admin-video-onay.md](08-admin-video-onay.md) |

## Henüz Sayfası Olmayan Akışlar (backlog'da var, kod yok)

- **Şifre sıfırlama** — `/login`'den bağlantı olacak, Supabase Auth'un kendi
  reset-password flow'u kullanılabilir. Ayrı bir task gerektirir.
- **Çıkış (logout)** — şu an hiçbir sayfada buton/aksiyon yok.
- **Public video galerisi** — `/` üzerinde, `property_videos`/`properties`
  anon RLS policy'si gerekiyor (P3, backlog #24).
- **Admin ilan düzenleme** — onaylamadan önce başlık/fiyat düzeltme (P1-8 ile ilişkili).

## Tasarım Sistemi Referansı

Müşteri-yüzü 4 sayfa (01-04) `obss_project/artifacts/musteri-sayfalari-tasarim-yenileme/design-direction.md`'deki
token sistemini kullanıyor (`ink-900`/`fog-50`/`terracotta-600/700`/`slate-500`/
`mist-200`/`moss-700`/`brick-700`, `font-display`=Sora/`font-body`=Inter).
Emlakçı/admin sayfaları (05-08) HENÜZ bu sisteme geçmedi — hâlâ eski
Tailwind varsayılan renkleri (`text-zinc-600`, `text-red-600` vb.) kullanıyor.
Bu, gelecekteki bir "iç panel tasarım yenileme" görevinin konusu olabilir
(şu an backlog'da yok, bu dokümanla birlikte önerilebilir).

## Bağlantılı Dosyalar

- Backlog/olmazsa olmazlar kaynağı: `../is-listesi-ve-sayfa-envanteri.md`
- Mimari dokümantasyon: `../../../docs/ARCHITECTURE.md` (proje kökünde)
- Tasarım yönü: `../musteri-sayfalari-tasarim-yenileme/design-direction.md`
