# Plan — p1-hizli-kazanimlar
_Reference: atdd.md (EML-95)_

Frontend-pipeline: tetiklendi. Discover + Audit = `tasarim-elestirisi-2026-10-28/rapor.md`. Design direction değişmiyor (mevcut tokenlar). verify gate 12 aktif, 4 viewport.

## Keşif bulguları
- `site-header.tsx` server component, oturum dalı YOK → AC-8 N/A (varsayım doğrulandı). Yalnız `(marketing)/layout.tsx` kullanıyor.
- Header `max-w-6xl px-3 md:px-6`; landing hero `max-w-7xl px-6`; diğer bölümler `max-w-6xl px-6`; footer `max-w-6xl px-6`.
- login/signup: `grid md:grid-cols-2`, sol `bg-ink-900` panel (h1 + paragraf + `<img>` çizim), sağ form `max-w-sm`.
- `slate-500` Tailwind'in değil projenin token'ı: `globals.css` `--color-slate-500: #5B6B7A` (fog-50 üstünde ~5.3:1 ama raporda sınırda). 81 kullanım, marketing + dashboard + admin.

## Kararlar
- **Kontrast (AC-6):** token değeri `--color-slate-500: #475569` olarak değiştirilir (tek satır, global). Sınıf adları değişmez → 81 dosyaya dokunulmaz. Dashboard/admin metni de koyulaşır (atdd Risks'te kabul).
- **Aktif sayfa (AC-2/3/4):** `src/lib/nav/is-active-path.ts` saf fonksiyon. Header iki parçaya ayrılır: server `SiteHeader` kabuğu + `"use client"` `HeaderNav` (`usePathname`). Client component SSR'da da render edildiği için `aria-current` HTML'de bulunur.
- **Container (AC-1):** header `px-4 md:px-6`; hero `max-w-6xl`; footer/bölümler zaten `max-w-6xl px-6` → mobilde `px-4 md:px-6`'ya hizalanır (header ile aynı).
- **Form üstte (AC-5):** login/signup'ta sol panel tamamen silinir; `main` = `mx-auto max-w-6xl px-4 md:px-6 pt-10 md:pt-16 pb-12` içinde `max-w-sm mx-auto` form kartı. sifremi-unuttum/sifre-yenile aynı dış yapıya alınır (min-h + justify-center kaldırılır).

## Files to Modify
| File | Why | Risk |
|---|---|---|
| web/src/app/globals.css | AC-6 token | low (global) |
| web/src/components/site-header.tsx | AC-1 padding, AC-7 logo, HeaderNav kullanımı | low |
| web/src/app/(marketing)/page.tsx | AC-1 hero 6xl, bölümler px-4 md:px-6 | low |
| web/src/app/(marketing)/pricing/page.tsx | AC-1 padding | low |
| web/src/app/(marketing)/login/page.tsx, signup/page.tsx | AC-5 | medium (testler) |
| web/src/app/(marketing)/sifremi-unuttum/page.tsx, sifre-yenile/page.tsx | AC-1/5 dış yapı | low |
| web/src/components/site-footer.tsx | AC-1 padding | low |
| ilgili testler | metin/yapı | low |

## New Files
| File | Purpose |
|---|---|
| web/src/lib/nav/is-active-path.ts (+test) | AC-3 |
| web/src/components/header-nav.tsx (+test) | AC-2/4/7 client nav |

## Migration Required?
Hayır.

## Risks
atdd Risks + `public/illustrations/{welcome,secure-login}.svg` kullanılmaz hale gelir — silinmez (kapsam dışı, başka yerde kullanım olabilir).

## Open Questions
Yok.
