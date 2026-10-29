# Verify Report — p0-vitrin-guven
_Reference: atdd.md, code_diff.md, test_diff.md · 2026-10-29_

| # | Gate | Result | Evidence / Reason |
|---|---|---|---|
| 1 | Dosya konumu | PASS | git status: 0019 up/down, yeni route'lar (sifremi-unuttum, sifre-yenile, auth/callback), cta-state, değişen sayfalar |
| 2 | Build | PASS | `npm run build` "Compiled successfully", /auth/callback ƒ, /sifre-yenile ○, /sifremi-unuttum ○ |
| 3 | Supabase canlı | PASS | 0019 uygulandı. has_function_privilege anon=false, authenticated=true; anon REST `POST /rpc/start_trial` → 401 42501; `{"days":365}` → 404 (parametre yok). Rollback'li tx: authenticated doğrudan `insert into subscriptions` → 42501 RLS (AC-S3); trial'sız kullanıcıda start_trial → tek `trialing` satır, 14 gün; mevcut kullanıcıda → false; 6/6 agents trial_started_at dolu (backfill) |
| 4 | Lint | PASS | 0 hata, 5 uyarı (önceki görevden); formatter yok |
| 5 | Type check | PASS | tsc 0 hata |
| 6 | Unit testler | PASS | 626/626 (alt-ajan 2 koşum). Orkestratör koşumunda 4 düşüş yalnız canlı DB'ye bağlanan admin-video-rls / agents-self-update-rls timeout'u; tek başına 16/16 |
| 7 | E2E | PARTIAL | Suite yok; Playwright MCP yerine Browser pane JS ölçümü yapıldı (aşağıda). Kayıt/sıfırlama akışları gerçek e-posta ile denenmedi |
| 8 | Lighthouse | N/A | Lighthouse MCP bağlı değil |
| 9 | Erişilebilirlik | INCONCLUSIVE | axe kurulu değil; aria-label/aria-describedby birim testte doğrulandı, kontrast ölçülmedi |
| 10 | Güvenlik taraması | PASS | security-scan exit 0 (secrets PASS) |
| 11 | AI code review | PENDING (red-team) | |
| 12 | Görsel ölçüm | **FAIL (2 madde)** | bkz. aşağı |
| 13 | DAST | N/A | ZAP bağlı değil |
| 14 | İnsan onayı | PENDING | |

## Görsel ölçümler (Browser pane, JS getBoundingClientRect)
| Viewport | Sayfa | Header yükseklik | scrollWidth ≤ vw | Destek butonu kesişimi (üst / en alt) |
|---|---|---|---|---|
| 320 | / | 53 | 320/320 ✓ | yok / yok |
| 320 | /pricing | 53 | ✓ | yok / yok |
| 320 | /signup | 53 | ✓ | **"Ücretsiz Deneyin" gönder butonu** / yok |
| 320 | /login | 53 | ✓ | yok / yok |
| 375 | /signup | 53 | ✓ | yok (tüm kaydırma boyunca) |
| 768 | / | **69** | ✓ | — |
| 1280 | / | **69** | ✓ | — |

- **AC-1 FAIL:** ≥768px header 69px (AC sınırı ≤64px). Mobilde 53px ✓, tek satır ✓.
- **AC-14 FAIL:** 320px /signup ilk görünümde destek butonu kayıt butonunun üstünde.
- Not: 375px /pricing'de kaydırma sırasında sabit buton geçici olarak fiyat/CTA metinlerinin üstünden geçiyor — sabit (fixed) buton için kaçınılmaz; AC-14 metni "dinlenme konumunda (sayfa üstü ve en alt)" olarak yorumlandı, en altta padding sayesinde kesişim yok.

## Iterate turu 1 (2026-10-29)
- AC-1: header md:py-3 → 768 ve 1280px'te **61px** ✓ (mobil 53px aynı).
- AC-14: signup mobilde tanıtım paragrafı gizlendi, py-6. 320x700 ilk görünümde destek butonu artık gönder butonunu değil **"Giriş yap" linkini** ("Zaten hesabınız var mı?") örtüyor → hâlâ FAIL. Frontend-pipeline kuralı: ikinci tur otomatik değil, kullanıcıya soruldu.
- vitest: 626/626 test geçti; admin-video-rls dosyası canlı DB hook timeout'u (önceden bilinen, ilgisiz).

## Iterate turu 2 (2026-10-29, kullanıcı: "Butonu yukarı al")
- Form sayfalarında mobil `bottom-24` (MarketingSupportButton, usePathname) + 80px alt boşluk. vitest 89/89 (components+marketing), tsc 0.
- 320x700 ölçüm: en altta kesişim yok (signup/login/sifremi-unuttum). İlk görünümde: /signup → **"Ücretsiz Deneyin" gönder butonu**, /login → **"Giriş yap" butonu**, /sifremi-unuttum → yok. Landing: yok.
- Sonuç: AC-14 hâlâ FAIL. Kısa viewport'ta sabit buton nereye konsa form öğesinden birine denk geliyor; konum ayarı çözüm değil. Seçenek: form sayfalarında mobilde yüzen butonu gizlemek (destek linki sayfa içinde/footer'da kalır).

## Iterate turu 3 (2026-10-29, kullanıcı: "Evet, gizle")
- Form sayfalarında (login/signup/sifremi-unuttum/sifre-yenile) mobilde yüzen buton `hidden md:flex`; yerine akış içinde `md:hidden` "Yardım mı lazım? WhatsApp destek" linki. `raised` kaldırıldı. vitest 94/94 (components+marketing), tsc 0.
- Ölçüm: 320 /signup ve /login → buton display:none, link görünür, scrollWidth 320; 320 / → buton flex, link yok; 1280 /signup → buton flex, link gizli, header 61px.
- **AC-1 PASS, AC-14 PASS** (form sayfalarında kesişim yüzeyi kalmadı). Gate 12 → PASS.

## Refactor adayı
signup/login'deki `ensureAgentRow` try/catch artık ölü (fonksiyon throw etmiyor) — red-team'e bırakıldı.
