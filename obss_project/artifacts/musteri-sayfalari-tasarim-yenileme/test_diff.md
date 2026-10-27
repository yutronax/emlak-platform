# Test Diff — musteri-sayfalari-tasarim-yenileme

## Oluşturulan Dosyalar
- `web/src/components/ui/button.test.tsx`
- `web/src/components/ui/alert.test.tsx`

## Kapsam Notu
Bu görevin E2E/multi-viewport/accessibility doğrulaması (atdd.md'nin %50 E2E + %30 görsel ağırlığı) bir commit'e giren test dosyası DEĞİL — proje Playwright framework'ü kullanmıyor, yeni eklenmedi. Bu kontroller `verify` adımında Playwright MCP ile canlı yapılacak (ekran görüntüsü + `vision-test` + axe), sonuçlar `verify_report.md`'ye yazılacak.

## AC → Test eşlemesi
| AC | Test dosyası |
|---|---|
| AC-4 (login hata banner, `role="alert"`) | `alert.test.tsx` (component seviyesinde) |
| AC-5 (signup başarı banner, `role="status"`) | `alert.test.tsx` (component seviyesinde) |
| AC-6 (form submit disabled/aria-busy) | `button.test.tsx` |
| AC-8/AC-9 (viewport/Lighthouse a11y) | `verify` adımında Playwright MCP (bu dosyaların kapsamında değil) |

## Doğrulama (red step)
`npx vitest run src/components/ui/button.test.tsx src/components/ui/alert.test.tsx` → **2 dosya fail** (import hatası: `./button`/`./alert` henüz yok) — beklenen red durum.

## Varsayımlar (alt-ajandan)
- `Button` prop adları: `variant` (`"primary"`|`"secondary"`), `disabled`, `isPending`, `onClick`.
- `Alert` prop adları: `variant` (`"error"`|`"success"`), `children`; `role` kökte.
- Token kontrolleri (`toContain("terracotta"|"ink"|"brick"|"moss")`) kasıtlı esnek — tam class adı icat edilmedi.
