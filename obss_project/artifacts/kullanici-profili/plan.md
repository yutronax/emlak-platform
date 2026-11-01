# Plan — kullanici-profili
_Reference: frontend_contract.md (atdd.md yok; kapsam kullanıcı kararlarıyla netleşti)._

Frontend-pipeline: tetikleyici VAR — Discover (kod), kapsam kararları ve Contract tamam.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/components/auth/password-field.tsx | Profilde 3 şifre alanı için `id`/`label` prop'u (varsayılanlar korunur) | low | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/lib/profile-ui/types.ts | `Profile`, `ProfileService`, sonuç tipleri | frontend |
| web/src/lib/profile-ui/validation.ts (+test) | Bölüm doğrulamaları | frontend |
| web/src/lib/profile-ui/mock-service.ts | Fixture (uzun şirket adı) + hata tetikleyicileri | frontend |
| web/src/lib/profile-ui/service.ts (+test) | Seçim; production'da mock → throw; gerçek servis yok → `null` | frontend |
| web/src/app/account/profile/page.tsx | Oturum yoksa /login; servis yoksa `notFound()` | frontend |
| web/src/app/account/profile/profile-view.tsx (+test) | Sekmeler, yükleme/hata, bölümler | frontend |
| web/src/app/account/profile/sections.tsx | 4 bölüm formu | frontend |

## Dependencies
`components/auth/{field,password-field}`, `components/ui/{button,alert}`, `lib/auth-ui/{phone,password-strength,messages}`.
Oturum kontrolü mevcut `account/subscription` deseniyle (`createClient().auth.getUser()`).

## Migration Required?
Hayır (frontend-only; backend soruları contract sonunda).

## Risks
- Gerçek servis yok: production'da sayfa `notFound()` döner (sahte veri asla gösterilmez). Dev'de `NEXT_PUBLIC_PROFILE_MOCK=1`.
- Header'da oturum açmış kullanıcı menüsü yok; profile bağlantı eklemek bu kapsamın dışında (Open Question değil, not).

## ECC Danışman Notları
Koşul yok.

## Open Questions
Yok.

Not: UI dosyası → verify gate 11 aktif.
