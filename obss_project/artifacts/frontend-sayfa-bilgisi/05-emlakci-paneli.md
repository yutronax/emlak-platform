# 05 — Emlakçı Paneli

**URL:** `/agent/dashboard` · **Dosya:** `web/src/app/agent/dashboard/page.tsx` · **Rol:** Emlakçı (auth zorunlu)
**Durum:** ⚠️ Fonksiyonel, auth guard var, AMA tasarım sistemine geçmedi (eski `zinc`/`red` renkleri) · **Route grubu:** yok (kök `src/app/agent/`)

## Amaç / Persona

Abone emlakçının ana çalışma ekranı — kendi ilanlarını (WhatsApp'tan toplanıp
onaylanmış) burada görür. Ürünün asıl değerinin teslim edildiği sayfa.

## İçerik Yapısı

1. Başlık "Emlakçı Paneli" + abonelik durum rozeti (`trialing`/`active`/`past_due`/`canceled`/"Aboneliğiniz yok").
2. Erişim yoksa (`hasAccess=false`): "İlanları görmek için aktif abonelik gerekir" + [`/account/subscription`](06-abonelik-detayi.md) linki.
3. Erişim varsa: `listings` tablosundan son 20 kayıt, basit liste (başlık/fiyat/konum/oda-m²).
4. Boş durum: "Şu an gösterilecek ilan yok."

## Erişim Mantığı (`hasAccess` hesaplaması)

```
auth.user yok? → redirect("/login")
      │ var
      ▼
subscriptions'tan AÇIK durum ara (trialing/active/past_due, en yeni)
bulunamazsa → herhangi bir en yeni satırı al (rozet için)
      │
      ▼
hasAccess = status ∈ {active, trialing}
            VE current_period_end var
            VE current_period_end > şu an
      │
   ┌──┴──┐
   ▼     ▼
 true   false → "Abone olun" linki + ilan listesi GÖSTERİLMEZ
```
Not: Bu UX amaçlı bir karardır — **gerçek veri erişimi RLS'te** zaten
zorunlu kılınıyor (kod yorumunda açıkça belirtilmiş), burası sadece
kullanıcıya doğru mesajı göstermek için.

## Veri Kaynağı

- `subscriptions`: `status, current_period_end` (iki ayrı sorgu: önce açık durum, yoksa en yeni).
- `listings`: `id,title,price,currency,rooms,area_m2,city,district` — `created_at DESC LIMIT 20`, SADECE `hasAccess=true` ise sorgulanır.

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/login`](03-giris.md) | Başarılı giriş sonrası (emlakçı ise) |
| ← | [`/signup`](04-kayit.md) | Başarılı kayıt + anında oturum sonrası |
| → | [`/account/subscription`](06-abonelik-detayi.md) | "Abone olun" linki (erişim yoksa) |
| → (oturumsuz) | [`/login`](03-giris.md) | `redirect("/login")` |

## Erişim Kuralı

`auth.user` yoksa `/login`'e redirect. Admin de bu sayfaya erişebilir (role
kontrolü yok, sadece oturum kontrolü) — admin'in burada göreceği abonelik
rozeti muhtemelen "Aboneliğiniz yok" olacaktır (admin'in kendi aboneliği yok varsayımıyla).

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] **Tasarım sistemine geçiş** — şu an `text-zinc-600`/`border` gibi eski Tailwind varsayılanları kullanıyor, EML-80'in token sistemine (`ink-900`/`fog-50`/vb.) geçmedi. Bu doküman setinin önerdiği bir sonraki iş (bkz. [00-genel-bakış](00-genel-bakis.md)).
- [ ] Sayfalama/filtre (ilan sayısı büyüyünce — şu an sabit `LIMIT 20`, "daha fazla göster" yok).
- [ ] İlan detay sayfası/modalı (şu an liste satırına tıklanamıyor).
- [ ] `listingsError` durumunda sadece "İlanlar yüklenemedi" — retry butonu yok.

## İlgili Görev/Jira

- Auth guard + listings bağlama: EML-33 (tamamlandı)
- Tasarım sistemine geçiş: henüz Jira task yok, bu doküman öneriyor.
