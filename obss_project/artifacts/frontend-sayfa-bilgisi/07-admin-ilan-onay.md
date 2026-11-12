# 07 — Admin İlan Onay Paneli

**URL:** `/admin/listings` · **Dosya:** `web/src/app/admin/listings/page.tsx` + `actions.ts` · **Rol:** Admin (auth + `is_admin`)
**Durum:** ⚠️ MVP tamamlanmış, test yok, pagination/filtre yok · **Route grubu:** yok

## Amaç / Persona

Admin, scraper'ın WhatsApp'tan topladığı ve Gemini ile parse ettiği
`raw_listings` kayıtlarını (durum=`pending`) inceleyip onaylar/reddeder.
Onaylanan kayıt gerçek `listings` tablosuna geçer (bkz. [05-emlakçı-paneli](05-emlakci-paneli.md)'nin veri kaynağı).

## İçerik Yapısı

1. Başlık + "{N} incelenmemiş ilan" sayacı.
2. Her `raw_listings` satırı için kart: kaynak grup, kalite skoru, ham metin (`raw_text`, `whitespace-pre-wrap`), ayrıştırılmış alanlar (başlık/fiyat/oda/m²/konum), Onayla/Reddet butonları.
3. Boş durum: "İncelenmemiş ilan yok."

## Server Actions (`actions.ts`)

- `approveListing(formData)` — `raw_listing_id` alır, muhtemelen `raw_listings.status='approved'` + `listings` tablosuna INSERT yapar (detay `actions.ts`'te, bu dosya sadece sayfa akışını belgeliyor).
- `rejectListing(formData)` — `raw_listing_id` alır, `status='rejected'` yapar.

## Veri Kaynağı

- `raw_listings`: `id, source_group, raw_text, parsed (jsonb), quality_score, created_at` — `status='pending'` filtresi, `created_at ASC` (en eski önce — FIFO inceleme sırası).
- Yazma: `approveListing`/`rejectListing` → `raw_listings` + muhtemelen `listings` (approve'da).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/login`](03-giris.md) | Başarılı giriş sonrası (admin ise) |
| → (onaylanan ilan) | [`/agent/dashboard`](05-emlakci-paneli.md) | Dolaylı — `listings` tablosuna yazılan satır, emlakçı panelinde görünür |
| → (oturumsuz) | [`/login`](03-giris.md) | `requireAdmin()` reason="no-session" |
| → (oturum var ama admin değil) | [`/agent/dashboard`](05-emlakci-paneli.md) | `requireAdmin()` reason≠"no-session" |

## Erişim Kuralı

`requireAdmin()` (`web/src/lib/auth/requireAdmin.ts`) — RLS seviyesinde de
korunuyor, ama Server Action'larda (`approveListing`/`rejectListing`)
UYGULAMA seviyesi admin kontrolü YOK (sadece RLS'e güveniliyor) — bu bilinen
bir risk (bkz. Olmazsa Olmazlar).

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] **Server Action seviyesinde admin kontrolü** (defense-in-depth, P1-8) — şu an sadece RLS.
- [ ] Sayfalama (pending listesi büyüyünce — şu an TÜM pending satırlar tek seferde çekiliyor).
- [ ] Filtre/arama (şehir, tarih, skor).
- [ ] Düzenleme (onaylamadan önce başlık/fiyat düzeltme — şu an sadece onayla/reddet, veri düzeltilemez).
- [ ] Sayfa + action testleri.
- [ ] Hata mesajı sızıntısını kapat (`console.error` ile log'a yazılıyor, kullanıcıya genel mesaj dönüyor — bu zaten doğru yapılmış, backlog maddesi muhtemelen eski).
- [ ] **Tasarım sistemine geçiş** — eski `bg-green-600`/`bg-red-600` renkleri, EML-80 token sistemine geçmedi.

## İlgili Görev/Jira

- Ana MVP: önceki fazlardan (tarih bilinmiyor, bu doküman yazılmadan önce tamamlanmıştı).
- Server Action admin kontrolü: backlog #8, henüz Jira task yok.
