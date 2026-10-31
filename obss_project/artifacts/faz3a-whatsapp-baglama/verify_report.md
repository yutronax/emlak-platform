# Verify Report — faz3a-whatsapp-baglama
_2026-10-31 · Reference: atdd.md, plan.md, code_diff.md_

| # | Gate | Result | Evidence |
|---|---|---|---|
| 2 | Build | PASS | Compiled successfully, `○ /agent/whatsapp` |
| 3 | Supabase canlı | PASS | 0023 uygulandı (kullanıcı onayı); probe'lar aşağıda |
| 4 | Lint | PASS | 0 hata |
| 5 | Type check | PASS | tsc 0 |
| 6 | Unit | PASS | web 1019/1019; sidecar 96 pass / 1 skip (POSIX izin testi Windows'ta) |
| 7 | E2E | NOT RUN | Gerçek QR taraması: sidecar + WA_AUTH_KEY + telefon gerekir (kullanıcı) |
| 10 | Güvenlik | PASS | `npm audit --omit=dev` 0 (qrcode); canlı probe'lar |

## Canlı probe'lar (rolled-back tx, admin olmayan agent A; B'nin satırında QR var)
| Kontrol | Sonuç | AC |
|---|---|---|
| A `get_my_wa_status()` (satırı yok, B'nin QR'ı var) | `{"ok":true,"status":"none"}` — B'nin QR'ı görünmüyor | AC-S1, AC-S2 ✓ |
| authenticated doğrudan `select from wa_connections` | 42501 permission denied | AC-S1, AC-S2 ✓ |
| onaysız connect | `consent_required` | AC-1, AC-S7 ✓ |
| `accept_wa_consent('2026-10')` / `('1999')` | ok / `invalid_version` | AC-1 ✓ |
| aboneliksiz connect | `subscription_required` | AC-9 ✓ |
| trialing + onaylı connect | `pending`; tekrar connect → mevcut `pending` | AC-2 ✓ |
| disconnect | `pending` | AC-3 ✓ |
| geçersiz eylem | `invalid_action` | — |
| 10 dk'da 4. connect | `rate_limited` (1–3 pending) | AC-S4 ✓ |
| anon RPC | get_my_wa_status 401; diğerleri 404 (gövdesiz imza); `has_function_privilege(anon)` üçü de false | AC-S1 ✓ |
| anon `GET /rest/v1/wa_connections` | 42501 | AC-S2 ✓ |

## Doğrulanamayan
- Gerçek QR → connected akışı, telefondan çıkarma, connectionReplaced (Baileys gerçek soket) — sidecar testleri sahte soketle kapsıyor.
- sidecar_timeout / no_qr_generated canlıda zamanla denenmedi (SQL statik test + sidecar birim testi).
