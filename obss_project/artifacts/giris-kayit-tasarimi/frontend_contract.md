# Frontend Contract — giris-kayit-tasarimi

> **Plan aşaması revizyonu (2026-11-01):** `confirm_email` → `check_email` olarak uygulandı ve dili kesin değil
> ("hesabınız varsa…"); `email_taken`/`weak_password`/`invalid_phone`/`terms_required` sunucu kodları UI'dan
> çıkarıldı — signup AC-S3 (e-posta varlığı açıklanmaz) gereği ve son üçü istemcide doğrulandığı için.
> Google düğmesi yalnız `service.capabilities.google` true ise görünür (gerçek adaptörde false).

> Durum: TASLAK — kullanıcı onayı bekliyor. Backend'e bakılmadan, UI ihtiyacından yazıldı.
> Keşif: yalnızca kod okuması (`(marketing)/login/page.tsx`, `(marketing)/signup/page.tsx`, `globals.css`).
> Tarayıcı açılamadı (`npm` PATH'te yok) → **görsel olarak doğrulanmadı**.

## Tasarım yönü (kullanıcı kararı: "Tam sayfa marka")
- **Sahne:** `ink-900` zemin üzerinde tam sayfa. Arka planda büyük, kırpılmış Sora tipografi
  ("ilan." / "müşteri." / "satış." kelimeleri, %6 opaklık) + ince harita/parsel çizgisi dokusu (SVG, saf CSS).
- **Form:** `fog-50` kart, sayfa üzerinde yüzer; masaüstünde sola hizalı (sol 8/12 kolonda başlık mesajı, sağda kart),
  768px altında kart tam genişlik, mesaj kartın üstünde 2 satır.
- **Vurgu:** tek renk `terracotta-600` (birincil buton, focus halkası, aktif adım). Başarı `moss-700`, hata `brick-700`.
- **Tipografi:** başlıklar Sora 700, gövde Inter 400/500; başlık ölçeği 40/28/20.
- **Hareket:** kart girişi 200ms fade+8px; adımlar arası 160ms kayma; `prefers-reduced-motion`'da hepsi kapalı.
- Kaçınılan: mor gradient, glassmorphism, stok ev fotoğrafı.

## Ekranlar ve UI modeli

### Giriş (`/login`)
| Alan | Tip | Doğrulama (istemci) | Hata metni |
|---|---|---|---|
| email | string | boş değil, e-posta biçimi | "Geçerli bir e-posta girin." |
| password | string | boş değil; göster/gizle düğmesi | "Şifrenizi girin." |

Aksiyonlar: `signIn({email,password})`, `signInWithGoogle()`, "Şifremi unuttum" bağlantısı, "Ücretsiz deneyin" bağlantısı.

### Kayıt (`/signup`) — iki adım
**Adım 1 · Hesap:** email, password (+ güç göstergesi, göster/gizle), Google ile devam.
**Adım 2 · Şirket:** company_name, phone (WhatsApp, `+90 5xx xxx xx xx` maskesi), terms (zorunlu onay).
- Adım göstergesi: "1/2 Hesap · 2/2 Şirket", geri dönülebilir, adım 1 verisi korunur.
- Adım 1 → 2 geçişi yalnızca istemci doğrulaması; servis çağrısı sadece adım 2 sonunda.
- Google ile kayıt: adım 1 atlanır, kullanıcı dönüşte doğrudan adım 2'ye gelir.

**Şifre gücü:** 4 kural canlı gösterilir (≥8 karakter, harf, rakam, büyük/küçük harf ya da sembol).
Seviyeler: Zayıf / Orta / Güçlü. Gönderim için en az "Orta" gerekir. Renk tek başına bilgi taşımaz (metin + ikon).

## Servis arayüzü
```ts
export type AuthResult =
  | { status: "ok"; redirectTo: string }
  | { status: "confirm_email"; email: string }          // kayıt: e-posta onayı gerekli
  | { status: "error"; code: AuthErrorCode; field?: "email" | "password" | "phone" | "company_name" };

export type AuthErrorCode =
  | "invalid_credentials" | "email_taken" | "weak_password" | "invalid_phone"
  | "terms_required" | "rate_limited" | "oauth_cancelled" | "network" | "unknown";

export interface AuthService {
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: { email: string; password: string; companyName: string; phone: string; termsAccepted: true }): Promise<AuthResult>;
  signInWithGoogle(intent: "login" | "signup"): Promise<AuthResult>;
  completeProfile(input: { companyName: string; phone: string; termsAccepted: true }): Promise<AuthResult>; // Google sonrası adım 2
}
```
Component'ler yalnızca `AuthService` kullanır; Supabase/fetch component'e girmez.
Mock yalnızca `NODE_ENV !== "production"` ve açık `NEXT_PUBLIC_AUTH_MOCK=1` ile seçilir; production'da seçilirse hata fırlatır.

## UI durumları ↔ Davranış
| Durum | Ekranda | Not |
|---|---|---|
| idle | Form boş, buton etkin | |
| submitting | Buton "Giriş yapılıyor…"/spinner, alanlar `aria-busy`, çift gönderim yok | |
| ok | Kart "Yönlendiriliyorsunuz…" → `redirectTo` | rol farkı servisten gelen `redirectTo` ile |
| confirm_email | Kart yerine onay ekranı: "{email} adresine bağlantı gönderdik", "tekrar gönder" + "e-postayı değiştir" | **Başarı ama hesap aktif değil** — "kayıt tamam" denmez |
| error + field | Hata ilgili alanın altında, `aria-describedby`, focus o alana | |
| error, alansız | Form üstünde Alert (`role="alert"`) | |
| invalid_credentials | "E-posta veya şifre hatalı." (hangisinin yanlış olduğu söylenmez) | |
| email_taken | Adım 1'e dönülür, email alanında: "Bu e-posta kayıtlı. Giriş yapın?" + bağlantı | |
| rate_limited | "Çok fazla deneme. Biraz sonra tekrar deneyin." buton geçici pasif | |
| oauth_cancelled | Sessiz: form idle'a döner, yalnızca bilgi notu | hata değil |
| network/unknown | "Bağlantı sorunu, tekrar deneyin." form verisi korunur | boş form gösterilmez |

## Görsel kabul kriterleri (test edilebilir)
- V-1: 390×844, 768×1024, 1440×900'de yatay kaydırma yok; birincil buton ilk ekranda görünür (390'da klavye kapalıyken).
- V-2: Tüm kontroller klavyeyle sırayla erişilir; focus halkası 2px terracotta, zemin üzerinde ≥3:1 kontrast.
- V-3: Metin kontrastı ≥4.5:1 (kart içi ve koyu zemindeki mesaj).
- V-4: Hata mesajları alanla `aria-describedby` ile bağlı, düzeltip tekrar gönderilebilir.
- V-5: `prefers-reduced-motion: reduce` altında animasyon yok.
- V-6: Arka plan tipografisi ekran okuyucudan gizli (`aria-hidden`).

## Backend'e istekler / sorular
1. Kayıtta **telefon** alanı saklanabilir mi? Biçim/benzersizlik kuralı ne?
2. **Google OAuth** sağlayıcısı etkinleştirilecek mi? Google ile gelen kullanıcı şirket+telefon+şart onayını sonradan nasıl tamamlar?
3. Kayıt e-posta onayı gerektiriyor mu (`confirm_email` durumu)?
4. Hata kodları ayrıştırılabilir mi (email_taken / weak_password / rate_limited) yoksa tek metin mi dönüyor? → adaptör eşler.
5. Şifre politikası sunucuda hangi kurallarla doğrulanıyor? İstemci kuralları onunla aynı olmalı.
