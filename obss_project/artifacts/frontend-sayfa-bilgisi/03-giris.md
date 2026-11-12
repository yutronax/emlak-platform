# 03 — Giriş

**URL:** `/login` · **Dosya:** `web/src/app/(marketing)/login/page.tsx` + `actions.ts` · **Rol:** Anonim
**Durum:** ✅ Tasarım yenilendi (EML-80), rol-aware redirect ZATEN kodda var (backlog'daki P1-13 notu güncel değil — aşağıda düzeltildi) · **Route grubu:** `(marketing)`

## Amaç / Persona

Daha önce kayıt olmuş emlakçı veya admin buradan giriş yapar.

## İçerik Yapısı

Split panel (desktop `md:grid-cols-2`, mobilde ink-900 panel üstte ince şerit + form altta):
- Sol/üst panel (`bg-ink-900 text-white`): kısa başlık "Emlak Platformu" + ürün cümlesi.
- Sağ/alt panel (`bg-fog-50`): form — gerçek `<label htmlFor>` + `<input autoComplete="email"/"current-password">`, hata `<Alert variant="error">`, submit `<Button isPending={isPending}>`.

## Server Action (`actions.ts` — EML-80'de İÇERİĞİ DEĞİŞMEDİ, sadece JSX taşındı)

`login(formData)` → Supabase Auth `signInWithPassword` → başarılıysa
`agents.is_admin` okunur (yoksa `company_name` metadata'sıyla `ensureAgentRow`
ile satır oluşturulur) → `isAdmin` ise `/admin/listings`, değilse
`/agent/dashboard`'a redirect eder. **Rol-bazlı yönlendirme zaten kodda var**
(EML-42 kapsamında eklenmiş görünüyor, backlog dosyasındaki P1-13 maddesi
güncellenmemiş — bu doküman gerçek koddan doğrulandı).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/`](01-ana-sayfa.md), [`/pricing`](02-fiyatlandirma.md), [`/signup`](04-kayit.md) | Header "Giriş" linki (her sayfada) |
| → (başarılı giriş) | `/admin/listings` (SABİT, yanlış) | Olması gereken: role-aware (bkz. aşağı) |
| → (başarısız giriş, `redirect("/login")`) | [`/agent/dashboard`](05-emlakci-paneli.md), [`/admin/listings`](07-admin-ilan-onay.md), [`/admin/videos`](08-admin-video-onay.md), [`/account/subscription`](06-abonelik-detayi.md) | Bu 4 sayfanın hepsi oturumsuz erişimde buraya redirect eder |
| → | `/signup` | (henüz bu sayfada "Hesabın yok mu?" linki YOK — eksik) |

## Rol-Bazlı Yönlendirme (gerçek akış)

```
login başarılı
      │
      ▼
  agents.is_admin oku (login/actions.ts içinde, requireAdmin'den BAĞIMSIZ ayrı bir sorgu)
      │
   ┌──┴──┐
   ▼     ▼
 admin  değil
   │     │
   ▼     ▼
/admin  /agent/dashboard
/listings
```
Not: Bu kontrol `web/src/lib/auth/requireAdmin.ts`'teki guard'dan AYRI, kendi
`agents` sorgusunu yapıyor — iki yerde benzer mantık var (hafif tekrar, ama
davranış doğru). İleride ortak bir `getUserRole()` helper'ına birleştirilebilir
(backlog'da yok, bu doküman bir gözlem olarak not düşüyor).

## Erişim Kuralı

Public. Zaten giriş yapmış kullanıcı tekrar `/login`'e gelirse şu an
redirect YOK (giriş formu tekrar gösterilir) — küçük bir UX eksikliği.

## Olmazsa Olmazlar (henüz kapanmamış)

- [x] ~~P1-13: Role-aware redirect~~ — kodda zaten var, backlog dosyası bu doküman yazılırken güncellendi.
- [ ] Şifre sıfırlama akışı — hiç yok, link bile yok.
- [ ] Çıkış (logout) butonu — bu sayfada değil ama genel olarak hiçbir sayfada yok.
- [ ] "Hesabın yok mu? Kayıt ol" linki eksik.
- [ ] Zaten oturum açıkken `/login`'e gelirse otomatik redirect.

## İlgili Görev/Jira

- Tasarım: EML-80 (`musteri-sayfalari-tasarim-yenileme`)
- Kayıt akışı: EML-42 (tamamlandı — `agents` satırı oluşturma)
- Rol-aware redirect: backlog #13, henüz Jira task yok.
