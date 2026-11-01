# Frontend Contract — kullanici-profili

> Kaynak: kullanıcı kararları (2026-11-01): bölümler Şirket · İletişim · Güvenlik · Bildirimler;
> `/account/profile`, sekmeli; hesap silme yok. atdd.md yok — görev doğrudan `frontend-pipeline`'dan.
> Backend'e bakılmadı. Gerçek servis yok → **FRONTEND-READY / MOCKED** hedefi.

## Tasarım yönü
- Giriş/kayıt ile aynı dil, ama uygulama içi olduğu için sakin: `fog-50` zemin, beyaz bölüm kartı,
  tek vurgu `terracotta-600`. Koyu marka sahnesi yalnız sayfa başlığı bandında (ince, 1 satır şirket adı + e-posta).
- ≥1024px: solda dikey sekme listesi (200px), sağda içerik (max 640px). <1024px: üstte yatay kaydırılabilir sekmeler.
- Sekme URL'de: `?tab=sirket|iletisim|guvenlik|bildirimler` (paylaşılabilir, geri tuşu çalışır).
- Her bölüm kendi formu ve kendi **Kaydet** düğmesi; değişiklik yoksa Kaydet pasif.
  Kaydedilmemiş değişiklikle sekme değiştirilirse onay sorulur.

## UI modeli
```ts
type Profile = {
  companyName: string; contactName: string; city: string; district: string;
  logoUrl: string | null;
  email: string; pendingEmail: string | null;    // onay bekleyen yeni adres
  whatsappPhone: string | null;                   // +90XXXXXXXXXX
  notifications: { newListingPush: boolean; newListingEmail: boolean; videoOrderEmail: boolean; weeklySummaryEmail: boolean };
};
```

## Servis arayüzü
```ts
interface ProfileService {
  load(): Promise<{ status: "ok"; profile: Profile } | { status: "error" }>;
  updateCompany(i: { companyName; contactName; city; district }): Promise<SaveResult>;
  uploadLogo(file: File): Promise<SaveResult>;          // png/jpg/webp, ≤2 MB (istemcide de kontrol)
  removeLogo(): Promise<SaveResult>;
  updateWhatsapp(phone: string): Promise<SaveResult>;
  requestEmailChange(newEmail: string): Promise<SaveResult>;      // ok → profile.pendingEmail dolu
  changePassword(i: { current: string; next: string }): Promise<SaveResult>;
  updateNotifications(n: Profile["notifications"]): Promise<SaveResult>;
  signOut(scope: "this" | "all"): Promise<{ status: "ok"; redirectTo: string } | SaveError>;
}
type SaveResult = { status: "ok"; profile: Profile } | SaveError;
type SaveError = { status: "error"; code: "wrong_password" | "invalid" | "too_large" | "unsupported_type" | "network" | "unknown"; field?: string; message?: string };
```

## Durumlar
| Durum | Ekranda |
|---|---|
| loading | Bölüm iskeleti (`aria-busy`), sekmeler görünür |
| load error | "Profil yüklenemedi" + **Tekrar dene**; boş form gösterilmez |
| saving | Kaydet "Kaydediliyor…", alanlar kilitli |
| saved | Bölüm altında "Kaydedildi" (`role=status`), form yeni değerle "temiz" |
| save error (alanlı) | Hata alanın altında, `aria-describedby`, odak o alana |
| save error (alansız) | Bölümde `role=alert`; girilen değerler korunur |
| e-posta değişikliği | "{yeni} adresine onay bağlantısı gönderildi; onaylanana kadar {mevcut} geçerli" — "değişti" denmez |
| şifre değişti | Alanlar temizlenir, "Şifreniz güncellendi" |
| wrong_password | "Mevcut şifre hatalı." mevcut şifre alanında |
| logo | Önizleme + Değiştir/Kaldır; tip/boyut hatası yükleme yapılmadan gösterilir |

## Doğrulama (istemci)
şirket adı 2–100; yetkili 2–80; şehir zorunlu; WhatsApp TR cep (`phone.ts`); e-posta biçimi ve mevcuttan farklı;
yeni şifre en az "Orta" ve mevcuttan farklı, tekrarı eşleşmeli.

## Görsel kabul kriterleri
- V-1: 1440/768/390'da yatay taşma yok; 390'da sekmeler yatay kaydırılır, sayfa kaymaz.
- V-2: Sekmeler `role=tablist`, ok tuşlarıyla gezilir, aktif sekme `aria-selected` + görsel işaret (renk tek başına değil).
- V-3: Uzun şirket adı (fixture: 90 karakter) başlık bandında kırpılmadan sarılır.
- V-4: Tüm hata metinleri alana bağlı; Kaydet çift tıklamayla iki kez gönderilmez.

## Backend'e istekler / sorular
1. Yetkili adı, şehir/ilçe, logo ve WhatsApp numarası nerede saklanacak?
2. Logo için depolama ve boyut/tip limiti?
3. E-posta değişikliği onay akışı (Supabase e-posta değiştirme onayı?) ve `pendingEmail` okunabilir mi?
4. Şifre değişiminde mevcut şifre sunucuda doğrulanabilir mi?
5. Bildirim tercihleri nerede tutulacak; push tercihi cihaz aboneliğinden bağımsız mı?
6. "Tüm cihazlardan çıkış" (global sign-out) desteklenecek mi?
