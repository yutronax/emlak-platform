# 04 — Kayıt (Signup)

**URL:** `/signup` · **Dosya:** `web/src/app/(marketing)/signup/page.tsx` + `actions.ts` · **Rol:** Anonim
**Durum:** ✅ Tasarım yenilendi (EML-80), güvenlik sertleştirmesi var · **Route grubu:** `(marketing)`

## Amaç / Persona

Yeni emlakçı hesap oluşturur. Tek adım: e-posta + şifre + şirket adı.

## İçerik Yapısı

[Giriş](03-giris.md) sayfasıyla aynı split-panel deseni, ek olarak `company_name`
alanı (gerçek `<label>`, `autoComplete="organization"`). Hata `<Alert variant="error">`,
başarı/beklemede mesajı `<Alert variant="success">`.

## Server Action (`actions.ts` — EML-80'de İÇERİĞİ DEĞİŞMEDİ, sadece JSX taşındı)

1. `email`/`password` boşsa → hata.
2. `company_name` 2-100 karakter değilse → hata.
3. Supabase Auth `signUp({email, password, options: {data: {company_name}}})`.
4. **Güvenlik kararı (AC-S3, enumeration önleme):** `signUp` hata dönerse
   (örn. e-posta zaten kayıtlı) kullanıcıya GENEL bir mesaj gösterilir
   ("Kayıt alındı; hesabınız varsa e-postanızı kontrol edin veya giriş yapın.")
   — e-postanın zaten var olduğu AÇIKÇA söylenmez, bu bir saldırganın geçerli
   e-posta listesi çıkarmasını (enumeration attack) engeller.
5. Başarılı VE oturum hemen açıldıysa (`data.session`): `ensureAgentRow` ile
   `agents` tablosuna satır yazılır (idempotent — hata olursa login'de tekrar denenir),
   `/agent/dashboard`'a redirect.
6. E-posta doğrulama gerekiyorsa (session yok): aynı GENEL mesaj gösterilir (kayıt bekliyor durumu da enumeration'dan ayırt edilemez tutulur).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/`](01-ana-sayfa.md), [`/pricing`](02-fiyatlandirma.md), [`/login`](03-giris.md) | Header "Kayıt Ol" CTA (her sayfada) |
| → (başarılı + anında oturum) | [`/agent/dashboard`](05-emlakci-paneli.md) | `ensureAgentRow` sonrası |
| → (e-posta doğrulama bekliyor) | (yok — aynı sayfada mesaj kalır) | kullanıcı e-postasını kontrol edip sonra `/login`'e gelir |

## Veri Kaynağı

- Supabase Auth (`auth.users`) — `signUp`.
- `agents` tablosu — `ensureAgentRow` ile INSERT (id=auth user id, company_name).

## Erişim Kuralı

Public. Zaten giriş yapmış kullanıcı `/signup`'a gelirse redirect YOK (aynı
`/login` eksikliği burada da var).

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] Zaten oturum açıkken `/signup`'a gelirse otomatik redirect.
- [ ] E-posta doğrulama akışının kullanıcıya daha net anlatılması (şu an genel mesaj, hangi durumda olduğu belirsiz — bilinçli bir güvenlik/UX trade-off, bkz. yukarıda).
- [ ] Şirket adı validasyonu sadece uzunluk kontrolü yapıyor — kötüye kullanım/spam filtresi yok (düşük öncelik).

## İlgili Görev/Jira

- Tasarım: EML-80 (`musteri-sayfalari-tasarim-yenileme`)
- Kayıt akışı + enumeration koruması: EML-42 (tamamlandı)
