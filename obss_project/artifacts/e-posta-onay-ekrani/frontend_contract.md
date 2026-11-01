# Frontend Contract — e-posta-onay-ekrani

> Kaynak: sayfa listesi #7; "önce tasarımlar, sonra backend". atdd.md yok.
> Keşif: `auth/callback` yalnız şifre sıfırlamada kullanılıyor; kayıt onay bağlantısının dönüş adresi kodda yok
> (Supabase "Site URL" varsayılanı). Bağlama — `emailRedirectTo` → `/auth/callback?next=/e-posta-onay` ve
> hata yönlendirmesi `?durum=gecersiz` — backend aşamasına bırakıldı.

## Rota
`/e-posta-onay` (marketing grubu, giriş/kayıt ile aynı `AuthShell` sahnesi).
- `?durum=onaylandi` (varsayılan) → başarı
- `?durum=gecersiz` → bağlantı geçersiz/süresi dolmuş

## Ekranlar
**Onaylandı**
- Başlık "E-postanız onaylandı", metin "Hesabınız hazır."
- Sonraki adımlar (sıralı liste): WhatsApp'ı bağlayın → Takip edeceğiniz grupları seçin → İlanlar panelinize düşsün.
- **WhatsApp'ı bağla** (`/agent/whatsapp`, birincil) · Panele git (`/agent/dashboard`).

**Geçersiz**
- Başlık "Bu onay bağlantısı geçersiz", metin "Süresi dolmuş ya da daha önce kullanılmış olabilir."
- Servis varsa: e-posta + **Yeni bağlantı gönder**. Sonuç her zaman aynı genel metin:
  "{e-posta} ile kayıtlı bir hesap varsa yeni bağlantı gönderdik." (hesap varlığı açıklanmaz — signup AC-S3 ile tutarlı)
- Servis yoksa form gösterilmez; "Hesabınızı zaten onayladıysanız giriş yapın" + Giriş yap.
- Her durumda **Giriş yap** bağlantısı.

## Servis
```ts
interface ConfirmService { kind: "mock" | "real"; resend(email: string): Promise<{ status: "ok" } | { status: "error"; code: "network" | "rate_limited" }> }
```
Mock yalnız dev'de `NEXT_PUBLIC_CONFIRM_MOCK=1`; production'da hata fırlatır. `yavas@ornek.com` → rate_limited.

## Durumlar
idle · gönderiliyor (düğme "Gönderiliyor…") · gönderildi (role=status, form gizlenir) · hata (role=alert, e-posta korunur) ·
istemci doğrulaması (biçim hatası alana bağlı, servis çağrılmaz).

## Görsel kabul kriterleri
- V-1: 1440/768/390'da taşma yok, birincil aksiyon ilk ekranda.
- V-2: Dekor gizli; img/svg yok.

## Backend'e istekler
1. Kayıtta `emailRedirectTo` = `/auth/callback?next=/e-posta-onay`; callback hata dalı kayıt onayı için `/e-posta-onay?durum=gecersiz`'e gitsin (şu an `/sifremi-unuttum`).
2. Onay e-postasını yeniden gönderme (`auth.resend({ type: "signup" })`) ve oran sınırı.
