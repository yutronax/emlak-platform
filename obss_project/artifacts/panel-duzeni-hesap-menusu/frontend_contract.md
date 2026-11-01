# Frontend Contract — panel-duzeni-hesap-menusu

> Kaynak: sayfa listesi #1 (kullanıcı "ilkinden başla", 2026-11-01). atdd.md yok.
> Keşif: `agent/*` ve `account/*` sayfalarının ortak layout'u yok; her sayfa kendi `<main>`'ini ve oturum
> kontrolünü yapıyor; çıkış akışı hiç yok; panel gezinmesi dashboard içindeki altı çizili bağlantılar.

## Tasarım yönü
- Tek, ince (56px) koyu `ink-900` üst çubuk — giriş/kayıt sahnesiyle aynı marka dili; içerik `fog-50` üzerinde.
- Sol: "Emlak Platformu" → `/agent/dashboard`. Orta: **İlanlar · WhatsApp · Videolar**. Sağ: hesap düğmesi
  (baş harfler rozeti + e-posta md+ ekranda).
- Aktif bölüm: `aria-current="page"` + alt çizgi (terracotta) + kalın yazı — renk tek başına değil.
- <768px: üst çubukta logo + hesap düğmesi; bölümler çubuğun altında tam genişlik 3 eşit sekme (yatay kaydırma yok).
- Hesap menüsü: Profil · Abonelik · ayırıcı · Çıkış yap.

## UI modeli / servis
```ts
type AppUser = { email: string | null };   // layout sunucuda getUser ile verir; yoksa null
signOut(): server action → oturumu kapatır, /login'e yönlendirir (JS olmadan da form ile çalışır)
```
- "Profil" yalnız profil servisi mevcutsa görünür (aksi halde 404'e götürür).

## Durumlar
| Durum | Ekranda |
|---|---|
| e-posta var | Rozet: e-postanın ilk harfi; menü başlığında e-posta |
| e-posta yok (mock/dev) | Rozet "?" , başlık "Hesabım" |
| menü açık | `aria-expanded=true`, ilk öğeye odak; Esc/dışarı tık kapatır, odak düğmeye döner |
| çıkış gönderiliyor | "Çıkış yapılıyor…", çift gönderim yok |

## Görsel kabul kriterleri
- V-1: 1440/768/390'da yatay taşma yok; 390'da 3 bölüm sekmesi tek satır.
- V-2: Menü klavyeyle açılır (Enter/Space/↓), ↑/↓ ile gezilir, Esc kapatır.
- V-3: Aktif bölüm renge ek olarak alt çizgi + `aria-current` ile belirtilir.

## Backend'e sorular
1. Admin kullanıcı için menüde "Yönetim" bağlantısı gösterilsin mi? (is_admin bilgisi layout'ta okunmalı)
