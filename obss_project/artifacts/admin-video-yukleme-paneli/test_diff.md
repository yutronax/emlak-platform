# Test Diff — admin-video-yukleme-paneli

## Oluşturulan Dosyalar
- `web/src/test/admin-video-rls.test.ts` (yeni, gerçek Supabase'e karşı — `agents-self-update-rls.test.ts` deseni, mock yok, service key yoksa skip)
- `web/src/app/admin/videos/actions.test.ts` (yeni, unit testler — `vi.mock` ile `requireAdmin`/`next/cache`/`next/navigation`)
- `web/src/app/admin/videos/page.test.tsx` (yeni, mock'lu render testleri — `admin/listings/page.test.tsx` deseni)

## AC → Test eşlemesi
| AC | Test dosyası / fonksiyon |
|---|---|
| AC-1 (happy path upload) | `actions.test.ts` (format/boyut/property geçerliyken hata fırlatmama) |
| AC-2 (yayınla, idempotent) | `actions.test.ts::publishVideo` |
| AC-3 (geçersiz format) | `actions.test.ts` — `.exe`/`.txt` → `toThrow("Sadece MP4, WebM veya MOV yükleyebilirsiniz")` |
| AC-4 (boyut limiti) | `actions.test.ts` — 50MB+1 byte → `toThrow("Dosya 50MB sınırını aşıyor")` |
| AC-5 (geçersiz property) | `actions.test.ts` — `toThrow("Geçersiz mülk")` |
| AC-6 (admin olmayan erişimi) | `page.test.tsx` (no-session→`/login`, not-admin→`/agent/dashboard`) + `actions.test.ts` (action seviyesinde) |
| AC-S1 (path manipülasyonu — artık tasarım garantisi) | `actions.test.ts::buildVideoStoragePath` — 3 farklı propertyId + path-traversal girdisiyle fuzz testi |
| AC-S2 (RLS reddi + anon SELECT 200+[]) | `admin-video-rls.test.ts` — authz_test.md satır 1-8 (canlı Supabase) |
| AC-S3 (admin herhangi bir property'ye yazabilir) | `admin-video-rls.test.ts` satır 1-2 |
| AC-9 (owner regresyonu) | `admin-video-rls.test.ts` satır 5 |
| AC-12 (kısmi başarı, compensating delete) | `actions.test.ts` (DB INSERT fail senaryosu mock'lanarak) |
| AC-13 (sessiz başarı yasak) | `actions.test.ts` (upload reject senaryosu) |

AC-S4 (private bucket + signed URL) ve AC-11 (imzasız erişim reddi) bu red-step'te KAPSANMADI — migration henüz yazılmadı, Storage URL erişim testi `code-copilot` sonrası `verify` adımına bırakıldı (authz_test.md satır 10-11).

## Doğrulama (red step)
`npm run test -- --run` → **3 dosya fail, 9 test fail** (page.tsx hâlâ placeholder, actions.ts/migration henüz yok — beklenen), **132 mevcut test regresyonsuz PASS**.

## Önemli düzeltme (canlı doğrulama sonucu)
`admin-video-rls.test.ts`'in ilk taslağı anon SELECT için 401/403 bekliyordu — canlı Supabase'e sorulduğunda gerçek davranışın `200+[]` (RLS'in normal, sessiz filtrelemesi) olduğu görüldü. Test düzeltildi: artık service_role ile satırın varlığını kanıtlayıp, ardından anon'un aynı sorguda `[]` gördüğünü gösteriyor (kontrast kanıtı). atdd.md ve authz_test.md da bu gerçek davranışa göre güncellendi.

## Sınırlama
AC-S4/AC-11 (signed URL) bu red step'te test edilmedi — migration + Storage policy'leri yazılmadan anlamlı bir test üretilemez, `verify` adımında ele alınacak.
