# Verify Report — faz2-ilan-akisi-bildirim
_Reference: atdd.md, code_diff.md, test_diff.md · 2026-10-28_

CI workflow dosyası yok → komutlar `web/package.json` script'lerinden (build/lint/test).

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | `git status --short`: 0016 up/down, lib/listings-feed/*, dashboard/{actions,notification-bell,listing-card,feed-filters}.tsx, page.tsx(M), testler mevcut |
| 2 | Build | PASS | `npm run build` tamamlandı, route tablosu üretildi |
| 3 | Supabase canlı | PASS | 0016 `db query --linked -f` ile uygulandı; information_schema: 2 kolon, pg_proc: mark_listings_seen=1, pg_indexes: 2. REST anon `POST /rpc/mark_listings_seen` → 200 `0` (auth.uid null → 0 satır, AC-17 kalıbı). `GET /listings?select=id,source_group_name` → 200 `[]` (kolon var, abonesiz satır görmüyor). Canlıda listings 0 satır → backfill/admin kopyası gerçek veriyle denenemedi |
| 4 | Lint | PASS | `npm run lint`: 0 hata, 5 uyarı (1'i yeni: query.test.ts:97 kullanılmayan `consoleError`). Formatter yapılandırılmamış → format N/A |
| 5 | Type check | PASS | `tsc --noEmit` 0 hata |
| 6 | Unit testler | PASS | `vitest run` 520/520 (46 dosya) |
| 7 | E2E | INCONCLUSIVE | E2E suite yok; Playwright akışı aktif abonelikli emlakçı oturumu ister, test hesabı bu turda kurulmadı |
| 8 | Lighthouse | INCONCLUSIVE | aynı sebep (korumalı sayfa) |
| 9 | Erişilebilirlik | INCONCLUSIVE | aynı sebep; birim testte zil `aria-label` doğrulandı |
| 10 | Güvenlik taraması | PASS | security-scan exit 0: secrets PASS; python/node gate'leri N/A. Bu IDOR'u kanıtlamaz → authz-test/red-team |
| 11 | AI code review | PENDING (red-team) | |
| 12 | Görsel regresyon | INCONCLUSIVE | vision-test çalıştırılmadı (oturum gerekli) — 375px kriteri doğrulanmadı |
| 13 | DAST (ZAP) | N/A | ZAP MCP bu oturumda bağlı değil; AC-S'ler PostgREST üzerinden authz-test ile denenmeli |
| 14 | İnsan onayı | PENDING | |

## AC -> Test Mapping
test_diff.md tablosu geçerli; tüm listelenen dosyalar yeşil. Canlıda doğrulanmayan: AC-S2 (A'nın JWT'siyle B'nin agents satırına PATCH), AC-12 admin onayı kopyası (veri yok).

## Coverage / Quality Notes
- Coverage ölçülmedi (`--coverage` script yok).
- page.test.tsx mock'u bu turda düzeltildi (abortSignal + sorgu başına builder), assertion'lar değişmedi.

## ECC Danışman Bulguları
Koşul var (AC-S) ama ecc-security-reviewer çağrılmadı; bulgular red-team'e devredildi.

## Refactor adayı
Aday: `web/src/lib/listings-feed/unread.ts` — kullanılmayan `_agentId` parametresi (test imzası yüzünden). Küçük; refactor yerine red-team kararına bırakılıyor. Başka ölçülebilir aday görülmedi (dosyalar satır satır incelenmedi).
