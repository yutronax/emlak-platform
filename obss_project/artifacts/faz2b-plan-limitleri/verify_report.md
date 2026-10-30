# Verify Report — faz2b-plan-limitleri
_2026-10-30 · Reference: atdd.md, plan.md, code_diff.md_

| # | Gate | Result | Evidence |
|---|---|---|---|
| 2 | Build | PASS | Compiled successfully |
| 3 | Supabase canlı | PASS | 0020 uygulandı (kullanıcı onayı "Evet, uygula"); aşağıdaki probe'lar |
| 4 | Lint | PASS | 0 hata |
| 5 | Type check | PASS | tsc 0 |
| 6 | Unit | PASS | 729/729 |
| 7 | E2E | NOT RUN | Panel oturum gerektiriyor (tarayıcıda oturum kalıcı olmuyor); kilitli kart görsel kontrolü yapılmadı |
| 9 | Erişilebilirlik | PARTIAL | kilitli yer tutucu aria-hidden (birim test) |
| 10 | Güvenlik | PASS | canlı probe'lar aşağıda |
| 12 | Görsel | NOT RUN | bkz. 7 |

## Canlı probe'lar (rolled-back tx, `set local role authenticated` + jwt claims, admin olmayan agent)
Test verisi: bugün 12 ilan (6 Kadıköy, 6 Ataşehir), dün 3, mevcut 1; Temel (10) trialing abonelik.
| Kontrol | Sonuç | AC |
|---|---|---|
| Aboneli kullanıcı `select count(*) from listings` | **0** | AC-S1 ✓ |
| Admin aynı sorgu | 16 (admin policy korunuyor) | AC-S1 ✓ |
| `feed_listings('{}',1)` | limit 10, open_today 10, 16 öğe, 14 açık, 2 kilitli (bugünün 11-12.si) | AC-1 ✓ |
| Kilitli öğe anahtarları | yalnız id, city, district, created_at, locked | AC-S2 ✓ |
| `{"ilce":"Kadıköy","limit":9999,"agent_id":"x"}` | limit hâlâ 10, 9 öğe, 1 kilitli (filtre sıralamadan sonra) | AC-2 ✓, AC-S3 ✓ |
| `feed_unread_count(now()-2 gün)` | 15 (kilitliler dahil) | AC-7 ✓ |
| `feed_filter_options(null)` | yalnız il/ilçe/grup adları | AC-S7 ✓ |
| Aboneliksiz kullanıcı | `{"items":[],"limit":0,"locked_count":0,"reason":"no_subscription"}` | AC-S5 ✓ |
| `has_function_privilege` | anon=false (4 fonksiyon); feed_access authenticated=false | AC-S4 ✓ |
| anon REST `POST /rpc/feed_listings`, `feed_filter_options`, `feed_access` | 401; `feed_unread_count` 404 (gövde imzasız) | AC-S4 ✓ |
| anon `GET /rest/v1/listings` | `[]` | AC-S1 ✓ |
| `explain analyze feed_listings` | 5.3 ms (canlı veri küçük) | performans ✓ (büyük havuzda yeniden ölçülmeli) |

## Not
- İlk probe yanlışlıkla admin bir agent ile koşuldu (direct select 16) — admin policy'den; admin olmayanla tekrarlandı: 0.
- AC-6 sapması (plan.md): past_due erişimi yok, mevcut kural korundu.
- AC-10 (limit ≤ 0) canlıda denenmedi; statik SQL testi ve kod incelemesiyle.

## Iterate (2026-10-30, kullanıcı: "Evet, kendi planıyla")
- feed_access past_due'yu kabul ediyor; dashboard erişim kararı RPC `reason`'a dayanıyor (kural tek yerde). vitest 732/732, tsc 0.
- 0020 canlıya yeniden uygulandı (kullanıcı onayı). Probe: past_due Temel kullanıcı → limit 10, reason yok, akış dönüyor; doğrudan listings select 0; anon execute false.
- AC-10 canlı probe: max_listings=0 → limit 0, open_today 0, tümü kilitli, hata yok.
