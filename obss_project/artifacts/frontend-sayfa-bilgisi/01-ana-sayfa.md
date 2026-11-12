# 01 — Ana Sayfa (Landing)

**URL:** `/` · **Dosya:** `web/src/app/(marketing)/page.tsx` · **Rol:** Anonim ziyaretçi
**Durum:** ✅ Yeniden tasarlandı (EML-80, 2026-10-27) · **Route grubu:** `(marketing)`

## Amaç / Persona

İlk temas noktası. Ziyaretçi genelde bir emlakçı (teknoloji meraklısı olmayabilir,
mobilde çok vakit geçirir) ya da ürünü merak eden bir ev arayan kişi. Sayfanın
tek işi: ürünün ne yaptığını ("WhatsApp'tan ilana, dakikalar içinde") 3 saniyede
anlatmak ve iki yöne yönlendirmek — kayıt ol (emlakçı) veya fiyatları gör.

## İçerik Yapısı

1. **Header** (`SiteHeader`, bkz. [bileşenler](#bileşenler)) — logo, Fiyatlar/Giriş linkleri, Kayıt Ol CTA.
2. **Hero** (asimetrik split, sol hizalı): başlık + açıklama + 2 CTA (sol) / "mesaj balonu → ilan kartı" motifi (sağ, `aria-hidden`).
3. **"Nasıl çalışır" şeridi**: 1-2-3 numaralı gerçek sıra (WhatsApp'a ilan at → Video ile hazırlanır → Vitrine çıkar).
4. **Footer** (`SiteFooter`).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| → | [`/signup`](04-kayit.md) | Hero "Kayıt Ol" CTA + header CTA |
| → | [`/pricing`](02-fiyatlandirma.md) | Hero "Fiyatları Gör" CTA + header link |
| → | [`/login`](03-giris.md) | Header "Giriş" linki |

Gelen trafik: doğrudan/organik, paylaşılan link, reklam (varsayım — analytics yok).

## Veri Kaynağı

Yok — tamamen statik içerik, Supabase sorgusu yapmıyor. (Gelecekte P3 backlog
#24'teki public video galerisi eklenirse bu sayfa `property_videos`/`properties`
tablolarını anon RLS ile okuyacak.)

## Bileşenler

- `SiteHeader` (`web/src/components/site-header.tsx`) — `(marketing)/layout.tsx` üzerinden tüm 4 sayfada ortak.
- `SiteFooter` (`web/src/components/site-footer.tsx`) — aynı şekilde ortak.
- Inline SVG motif (ayrı component değil, sayfanın kendi JSX'i).

## Erişim Kuralı

Public, auth gerekmiyor. `(marketing)/layout.tsx` sadece header/footer sarıyor,
hiçbir guard yok.

## Erişilebilirlik / Tasarım Notları

- `font-display` (Sora) başlıklarda, `font-body` (Inter) gövde metninde.
- Token sistemi: `bg-fog-50 text-ink-900`, terracotta SADECE buton zemini (`terracotta-600`), metin/stroke rengi `terracotta-700`.
- Mobilde (`<768px`) hero tek sütuna düşer, motif görsel sütun altta kalır.
- `prefers-reduced-motion` saygılı (şu an karmaşık animasyon yok, sade).

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] Public video galerisi (P3, backlog #24) — `property_videos` anon RLS policy'si gerekiyor.
- [ ] Boş durum (henüz video yoksa) mesajı — galeri eklenince gerekecek.
- [ ] Gerçek sosyal kanıt/müşteri logosu (bilinçli olarak bu görevde kapsam dışı bırakıldı).

## İlgili Görev/Jira

- Tasarım: EML-80/82/83 (`obss_project/artifacts/musteri-sayfalari-tasarim-yenileme/`)
- Video galerisi: backlog #24 (`../is-listesi-ve-sayfa-envanteri.md`), henüz Jira'da task açılmadı.
