# 06 — Abonelik Detayı

**URL:** `/account/subscription` · **Dosya:** `web/src/app/account/subscription/page.tsx` · **Rol:** Emlakçı (auth zorunlu)
**Durum:** ⚠️ Fonksiyonel, çoklu-satır kırılganlığı düzeltildi, AMA tasarım sistemine geçmedi · **Route grubu:** yok

## Amaç / Persona

Emlakçının kendi abonelik durumunu (plan adı, durum, dönem sonu) görmesi ve
sorun varsa (gecikmiş ödeme) yönlendirilmesi.

## İçerik Yapısı

1. Başlık "Aboneliğim".
2. `isPastDue` ise `role="alert"` kırmızı banner: "Ödemeniz gecikti..." + [`/pricing`](02-fiyatlandirma.md) linki.
3. `<dl>` tablosu: Plan adı, Durum (Türkçe etiket), Dönem sonu (`tr-TR` tarih formatı, `Europe/Istanbul`).
4. Abonelik hiç yoksa: "Aboneliğiniz yok." + [`/pricing`](02-fiyatlandirma.md) linki.
5. Sorgu hatasında: genel hata mesajı.

## Çoklu-Satır Seçim Mantığı (`pickSubscription`)

Bir emlakçının birden fazla `subscriptions` satırı olabilir (örn. `failed` +
sonra `active`). Hangisi gösterilecek, öncelik sırasıyla belirlenir:

```
STATUS_PRIORITY = [active, trialing, past_due, pending, needs_review, failed, canceled]
```

İlk eşleşen status gösterilir (en "olumlu"/"aksiyon gerektiren" öncelikli) —
bilinmeyen bir status gelirse en yeni satır (`created_at DESC` zaten sıralı) fallback.

## Veri Kaynağı

- `subscriptions` + join `plans(name)`: `status, current_period_end, plan:plans(name)` — `agent_id` filtresiyle, TÜM satırlar (tek satır değil, `pickSubscription` client-side seçiyor).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/agent/dashboard`](05-emlakci-paneli.md) | "Abone olun" linki (erişim yoksa) |
| → | [`/pricing`](02-fiyatlandirma.md) | "Planları görüntüle" (abonelik yok) VEYA past_due banner'ı |
| → (oturumsuz) | [`/login`](03-giris.md) | `redirect("/login")` |

## Erişim Kuralı

`auth.user` yoksa `/login`'e redirect. Sadece kendi `agent_id`'sine ait satırlar (RLS).

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] **Tasarım sistemine geçiş** — aynı 05 sayfasındaki not, henüz eski Tailwind renkleri.
- [ ] İptal/plan değiştirme akışı — şu an YOK, sadece görüntüleme.
- [ ] Fatura geçmişi (`payment_events` tablosundan, opsiyonel ama beklenir).
- [ ] "past_due" banner'ında doğrudan ödeme güncelleme CTA'sı (şu an sadece `/pricing`'e genel link, spesifik "ödeme yöntemini güncelle" akışı yok).

## İlgili Görev/Jira

- Status filtresi/çoklu-satır düzeltmesi: EML-39 (tamamlandı)
- Tasarım sistemine geçiş: henüz Jira task yok.
- İptal akışı: henüz backlog'da yok, bu doküman öneriyor.
