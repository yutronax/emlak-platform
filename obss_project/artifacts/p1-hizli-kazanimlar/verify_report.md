# Verify Report — p1-hizli-kazanimlar
_Reference: atdd.md, plan.md, test_diff.md · 2026-10-29_

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Dosya konumu | PASS | plan.md ile uyumlu; yeni: lib/nav/is-active-path.ts, components/header-nav.tsx (+testler) |
| 2 | Build | PASS | `npm run build` Compiled successfully |
| 3 | Supabase | N/A | DB değişikliği yok |
| 4 | Lint | PASS | 0 hata (5 uyarı önceki görevlerden) |
| 5 | Type check | PASS | tsc 0 (ara turda sifre-yenile JSX kırığı — takılan alt-ajan — düzeltildi) |
| 6 | Unit | PASS | 667/667 |
| 7 | E2E | PARTIAL | suite yok; Browser pane ölçümü (aşağıda) |
| 8 | Lighthouse | N/A | bağlı değil |
| 9 | Erişilebilirlik | PARTIAL | aria-current SSR HTML'de doğrulandı (/pricing → "Fiyatlar"); ikincil metin #475569 fog-50 (#F5F6F4) üstünde ≈7.2:1; axe yok |
| 10 | Güvenlik | N/A | sunum katmanı, threat_model not-applicable |
| 12 | Görsel ölçüm | PASS | aşağıda |
| 14 | İnsan onayı | PENDING | |

## Ölçümler (getBoundingClientRect / getComputedStyle)
| vw | Sayfa | Header h | Tek satır | logo↔başlık dx | scrollWidth |
|---|---|---|---|---|---|
| 320 | / , /pricing, /login | 56 | ✓ | 0 | 320 |
| 320 | /signup | 52 | ✓ | 0 | 320 |
| 375 | / | 56 | ✓ | 0 | 375 |
| 768 | / | 61 | ✓ | 0 | ≤vw |
| 768 | /signup | 53 | — | 168 (form bilinçli ortalı, AC-5) | 768 |
| 1280 | / , /pricing | 61 | ✓ | 0 | ≤vw |

- Nav 15px (mobil) / 16px (md+), logo 18 / 20px (AC-7 ✓). İkincil metin rgb(71,85,105) (AC-6 ✓).
- login/signup/sifremi-unuttum: main içinde img 0 (AC-5 ✓). / ve /pricing'deki img'ler kapsam dışı (undraw P2).
- AC-4: /login'de Giriş yok, /signup'ta Kayıt Ol yok (birim test + SSR).
- Önce/sonra (satır 8): logo dx 1280'de ~35px → 0; nav 14→16px; logo 18→20px; slate-500 #5B6B7A → #475569. Değişim var.

## Iterate turu 1
- 1280 /signup'ta fog-50 arka planı yalnız max-w-6xl şeridindeydi (yanlar beyaz). Form sayfalarında main tam genişlik bg-fog-50 + iç sarmalayıcıya çekildi; main 1280px genişlikte doğrulandı.

## Refactor adayı
Yok (değişiklikler küçük ve token tabanlı).
