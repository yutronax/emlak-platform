# Plan — giris-kayit-tasarimi
_Reference: frontend_contract.md (kullanıcı onaylı). atdd.md yok — görev doğrudan `frontend-pipeline` dalından başlatıldı; contract kabul kriterlerinin kaynağıdır._

Frontend-pipeline: tetikleyici VAR (sayfa bileşenleri) — Discover/Design Direction/Contract adımları tamam, bu plan onların çıktısını kullanır.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/(marketing)/login/page.tsx | Tam sayfa marka düzeni, AuthService, göster/gizle, Google | medium | frontend |
| web/src/app/(marketing)/login/page.test.tsx | AC-5 (p1-hizli-kazanimlar) testleri yeni karara göre güncellenir | low | frontend |
| web/src/app/(marketing)/signup/page.tsx | İki adımlı kayıt, şifre gücü, telefon, Google | high | frontend |
| web/src/app/(marketing)/signup/page.test.tsx | İki adımlı akışa göre yeniden yazılır | medium | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/lib/auth-ui/types.ts | `AuthService`, `AuthResult`, hata kodları | frontend |
| web/src/lib/auth-ui/password-strength.ts (+test) | 4 kural, Zayıf/Orta/Güçlü | frontend |
| web/src/lib/auth-ui/phone.ts (+test) | TR cep numarası maske/normalize/doğrulama | frontend |
| web/src/lib/auth-ui/messages.ts | Hata kodu → Türkçe metin | frontend |
| web/src/lib/auth-ui/service.ts (+test) | Servis seçimi; production'da mock → throw | frontend |
| web/src/lib/auth-ui/mock-service.ts | Fixture'lı mock (yalnız dev/test) | frontend |
| web/src/lib/auth-ui/server-action-service.ts | Mevcut `login`/`signup` server action'larını saran adaptör | frontend |
| web/src/components/auth/auth-shell.tsx | Koyu marka sahnesi + kart | frontend |
| web/src/components/auth/password-field.tsx | Göster/gizle + opsiyonel güç göstergesi | frontend |

## Dependencies
- `@/components/ui/button`, `@/components/ui/alert` (değişmez).
- `login(formData)` başarıda `redirect()` atar, hata `{error}` döner. `signup(formData)` `{message}` (genel) veya `{error}` döner. Adaptör bu şekilleri `AuthResult`'a çevirir; action'lara dokunulmaz.
- Testler `vi.mock("./actions")` kullanıyor — adaptör aynı modülü import ettiği için mock geçerli kalır.

## Migration Required?
Hayır. Telefon kalıcı saklanmıyor (backend sorusu #1); form `phone` alanını gönderir, action şu an yok sayar.

## Risks
- **Önceki karar çakışması:** `p1-hizli-kazanimlar` AC-5 "dekoratif panel/görsel yok, koyu sol panel yok" diyordu. Kullanıcı 2026-11-01'de "Tam sayfa marka"yı seçti → yeni karar eskisini geçersiz kılar. Korunanlar: sayfada `img`/`svg` yok (doku CSS gradyanı), form üstte (dikey ortalama yok).
- **Enumeration (signup AC-S3):** Sunucu e-postanın kayıtlı olup olmadığını bilerek gizliyor. Contract'taki `email_taken` durumu UI'da **kullanılmaz**; kayıt sonucu her zaman genel "e-postanızı kontrol edin" ekranıdır. "{email} adresine gönderdik" gibi kesin dil kullanılmaz.
- **Google:** gerçek sağlayıcı yok. Servis `capabilities.google` bildirir; gerçek adaptörde `false` → buton gizli (production'da çalışmayan buton gösterilmez). Mock'ta `true`.
- Doğrulama: ortamda node/npm yok → testler ve görsel kontrol çalıştırılamadı.

## ECC Danışman Notları
Koşul yok (tek alan: frontend; yeni dış entegrasyon/migration yok).

## Open Questions
Yok — çakışma ve enumeration kararları yukarıda gerekçeli; kullanıcı "devam et" dedi.

Not: UI dosyaları değiştiği için `verify` gate 11 (`vision-test`) aktif.
