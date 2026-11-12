# 02 — Fiyatlandırma

**URL:** `/pricing` · **Dosya:** `web/src/app/(marketing)/pricing/page.tsx` + `buy-button.tsx` · **Rol:** Anonim + Emlakçı (auth)
**Durum:** ✅ Yeniden tasarlandı (EML-80), canlı veriyle çalışıyor · **Route grubu:** `(marketing)`

## Amaç / Persona

Hem anonim ziyaretçi hem de giriş yapmış ama henüz abone olmamış emlakçı
buraya gelir. İş: 3 planı (Temel/Pro/Kurumsal) karşılaştırmalı göster, Pro'yu
görsel olarak öne çıkar, satın alma akışını başlat.

## İçerik Yapısı

1. Başlık "Abonelik Planları" + açıklama.
2. `subscriptionError` varsa inline `Alert` (abonelik durumu yüklenemedi).
3. 3 kartlık grid (`md:grid-cols-3`) — Pro kartı `bg-ink-900` zemin + `md:-translate-y-2 md:shadow-lg` ile GERÇEKTEN yükseltilmiş (rozet değil, yüzey farkı).
4. Her kartta: plan adı, fiyat (`Intl.NumberFormat("tr-TR")`), ya "Mevcut planınız" rozeti ya da `BuyButton`.

## Veri Kaynağı (Supabase, canlı)

- `plans` tablosu: `id, name, price_minor_unit, sort_order` — `sort_order` ASC sıralı. **Not:** şu an sadece placeholder veri var ("Temel (placeholder)" / 99 TL, "Pro (placeholder)" / 299 TL, "Kurumsal (placeholder)" / 599 TL) — gerçek fiyatlandırma netleşince `UPDATE` edilecek (bkz. `../is-listesi-ve-sayfa-envanteri.md` madde #30).
- `subscriptions` tablosu (sadece auth varsa): `status, plan_id` — `activePlanId` hesaplamak için.
- Pro kart tespiti: plan adında `/pro/i` eşleşirse o kart, yoksa ortadaki index (`findHighlightIndex`).

## `BuyButton` Akışı (`buy-button.tsx`)

1. Tıklama → `POST /api/subscriptions/checkout` (`{plan_id}`).
2. `201 + checkout_url` → `window.location.href` ile ödeme sağlayıcısına (iyzico) yönlendirir.
3. Hata kodlarına göre Türkçe mesaj (`Alert variant="error"`): `401` giriş gerekiyor, `409` zaten bu plandasınız, `429` çok fazla istek, diğer → genel hata.
4. `variant: "primary"|"inverse"` prop'u — Pro kartında `inverse` (beyaz buton, lacivert zemin üstünde), diğerlerinde `primary` (terracotta). *(EML-80 red-team fix'i, bkz. [00-genel-bakış](00-genel-bakis.md)'ın tasarım sistemi notu.)*

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/`](01-ana-sayfa.md) | Header link + hero "Fiyatları Gör" CTA |
| ← | [`/account/subscription`](06-abonelik-detayi.md) | "Aboneliğiniz yok" / "past_due" durumunda "Planları görüntüle" linki |
| ← | [`/agent/dashboard`](05-emlakci-paneli.md) | `hasAccess=false` iken "Abone olun" linki |
| → | `/api/subscriptions/checkout` | `BuyButton` tıklaması (API, sayfa değil) |
| → (dolaylı) | ödeme sağlayıcısı (iyzico) | checkout_url redirect |

## Erişim Kuralı

Public — hem anonim hem auth kullanıcı görebilir. Satın alma denemesi anonimse
`401` döner, `BuyButton` bunu "Ödeme için önce giriş yapmanız gerekiyor" mesajına çevirir.

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] Gerçek plan fiyatlandırması (şu an "(placeholder)" etiketli) — iş kararı bekliyor.
- [x] ~~`sort_order` kolon hatası~~ — düzeltildi, canlıda kolon var.
- [x] ~~Anonim CTA mesajı~~ — `BuyButton`'ın 401 mesajı bunu karşılıyor.
- [ ] 502/504 senaryolarının gerçek canlı testi (kod var, `messageForStatus`'ta genel fallback'e düşüyor — ayrıştırılmamış).

## İlgili Görev/Jira

- Tasarım: EML-80 (`musteri-sayfalari-tasarim-yenileme`)
- RLS düzeltmesi: `plans-rls-anon-select-izni` (tamamlandı)
- Plan verisi: backlog #30 (insan eylemi bekliyor)
