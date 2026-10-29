# Test diff — p1-hizli-kazanimlar (red)
Jira: EML-96 (alt görev, parent EML-95).

| Dosya | AC |
|---|---|
| web/src/lib/nav/is-active-path.test.ts (yeni, 7 durum) | AC-3 |
| web/src/components/header-nav.test.tsx (yeni, 5 test) | AC-2, AC-4, AC-7 |
| web/src/components/site-header.test.tsx (+2) | AC-1 (px-4 md:px-6), AC-7 (logo md:text-xl) |
| web/src/app/(marketing)/login/page.test.tsx (+AC-5 bloğu) | AC-5 |
| web/src/app/(marketing)/signup/page.test.tsx (+AC-5 bloğu) | AC-5 |
| web/src/test/styles/contrast-token.test.ts (yeni) | AC-6 (vekil: token değeri) |

Red sonucu: yeni testler beklenen nedenle düşüyor (modül yok, px-3, md:text-lg, #5B6B7A, img/.bg-ink-900 var). Mevcut testlerde regresyon yok.
Sözleşme: `isActivePath(pathname, href)` named; `HeaderNav` named, props yok, `src/components/header-nav.tsx`.
Vekil: AC-1/6/7 gerçek kanıtı verify'da tarayıcı ölçümü.
