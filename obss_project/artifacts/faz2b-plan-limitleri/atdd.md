---
task_slug: faz2b-plan-limitleri
jira_id: EML-98
threat_model: done
priority: high
coverage_target: 85
performance_target: "feed_listings p95 < 300ms (20'lik sayfa)"
memory_target: null
test_strategy:
  unit: 60
  integration: 30
  e2e: 10
affected_modules:
  - supabase/migrations/0020_feed_daily_limit.sql (+ .down.sql)
  - web/src/lib/listings-feed/query.ts
  - web/src/lib/listings-feed/unread.ts
  - web/src/app/agent/dashboard/page.tsx
  - web/src/app/agent/dashboard/listing-card.tsx
  - web/src/app/(marketing)/pricing/page.tsx
---

# ATDD — faz2b-plan-limitleri

## Jira Kaynağı
[EML-98 — Faz 2b: plan bazlı günlük ilan görüntüleme limiti (max_listings)](https://kuyusuzyusuf123.atlassian.net/browse/EML-98)
Kaynak: `yol-haritasi.md` Faz 2 "Plan farkları (max_listings) bu fazda uygulanabilir".

## Persona
Aboneliği (deneme dahil) olan emlakçı; ilan akışını panelden takip ediyor.

## Hedef (Neden)
Planlar bugün yalnız fiyatla ayrışıyor; `plans.max_listings` (Temel 10, Pro 50, Kurumsal null) hiçbir yerde uygulanmıyor. Kullanıcı kararı (2026-10-30): plan farkı = günlük ilan görüntüleme. Limit sunucuda uygulanmalı, çünkü bugün `listings_subscriber_select` RLS'i her aboneye tüm ilanları doğrudan PostgREST ile veriyor.

## User Story
As a aboneli emlakçı
I want planımın günlük ilan hakkını ve aşan ilanların varlığını görmek
So that hangi planın bana yettiğine karar vereyim.

## Acceptance Criteria
1. [Critical] **AC-1 Gün başına N:** Given planın limiti N (Temel 10, Pro 50), When akış açılır, Then her İstanbul günü (Europe/Istanbul 00:00–23:59) için o gün gelen ilanlardan **en yeni N tanesi açık**, o günün geri kalanı kilitli döner. Geçmiş günler aynı kuralla (gün başına N) hesaplanır.
2. [Critical] **AC-2 Filtreden önce:** Açık küme filtresiz havuzdan hesaplanır; filtre (il/ilçe/grup/fiyat/oda) bu sonuç üzerinde çalışır. Filtre değiştirerek kilitli ilan açılamaz.
3. [Critical] **AC-3 Sınırsız:** `max_listings` null olan planda hiçbir ilan kilitli değildir, gösterge gizlenir.
4. [High] **AC-4 Kilitli kart:** Kilitli satır yalnız `{id, city, district, created_at, locked:true}` taşır; kartta il/ilçe + geliş zamanı, bulanık yer tutucu ve "Planı yükselt" → `/pricing` görünür.
5. [High] **AC-5 Gösterge:** Limitli planda üstte "Bugün X/N ilan açık" (X = bugün açık ilan sayısı, en fazla N) ve bugün kilitli ilan varsa "Planı yükselt" linki.
6. [High] **AC-6 Plan çözümü:** trialing → kaydın plan_id'si (deneme Temel ile açılıyor → 10). active/past_due → kendi planı. plan_id bulunamaz → en düşük limit (10) + sunucu logu `feed_plan_missing`.
7. [High] **AC-7 Filtre seçenekleri ve zil:** il/ilçe/grup seçenekleri ve okunmamış sayısı RPC üzerinden çalışmaya devam eder; zil kilitliler dahil bugünkü tüm yeni ilanları sayar. `mark_listings_seen` değişmez.
8. [Medium] **AC-8 Fiyat sayfası:** Her planda "Günde 10 ilan" / "Günde 50 ilan" / "Sınırsız ilan" satırı (`max_listings`'ten okunur).
9. [Medium] **AC-9 Hata:** RPC hatası/zaman aşımı (5 sn) → "İlanlar yüklenemedi" + "Tekrar dene"; doğrudan `listings` select'ine **fallback yok**.
10. [Medium] **AC-10 Geçersiz limit:** `max_listings` 0 veya negatif → 0'a sabitlenir, tüm ilanlar kilitli, hata gösterilmez, log `feed_limit_clamped`.

### Güvenlik kriterleri (threat-model)
11. [Critical] **AC-S1 Doğrudan okuma kapalı:** Aboneli bir kullanıcının JWT'siyle `GET /rest/v1/listings?select=*` → 0 satır (RLS) döner; admin JWT'siyle tüm satırlar döner (admin policy korunur).
12. [Critical] **AC-S2 Kilitli veri sızmaz:** `feed_listings` yanıtında `locked:true` olan satırda `title, price, currency, rooms, area_m2, source_group_name` anahtarları **hiç bulunmaz** (null değil, yok).
13. [Critical] **AC-S3 Kimlik istemciden gelmez:** RPC'ler argüman olarak agent_id/plan_id/limit almaz; hepsi `auth.uid()` + DB'den çözülür. `p_filters` içine `{"limit":9999}` veya `{"agent_id":"<başkası>"}` konursa yok sayılır, sonuç değişmez.
14. [High] **AC-S4 Anon kapalı:** `feed_listings`, `feed_filter_options`, `feed_unread_count` için `has_function_privilege('anon', ..., 'execute') = false`; anon REST çağrısı 401.
15. [High] **AC-S5 Aboneliksiz:** Açık aboneliği olmayan authenticated kullanıcı RPC çağırırsa `{"items":[],"locked_count":0,"limit":0,"reason":"no_subscription"}` döner, hiçbir ilan alanı dönmez.
16. [High] **AC-S6 Sayfalama/DoS:** `p_page` < 1 veya > 500 ya da sayı değilse 1'e/sınıra sabitlenir; sayfa boyutu sunucuda sabit 20 (istemci değiştiremez).
17. [Medium] **AC-S7 Seçenek sızıntısı:** `feed_filter_options` yalnız il/ilçe/grup adlarını döner (ilan alanı yok); aboneliksiz kullanıcıya boş döner.

## Threat Model
Çağrıldı (2026-10-30). Varlık: onaylı `listings` (ücretli içerik). Sınır: tarayıcı (kullanıcı JWT) → PostgREST/RPC → DB.
- S: Supabase JWT, değişiklik yok — atlandı.
- T: istemciden gelen limit/plan/agent_id → AC-S3. Filtreyle kilit atlatma → AC-2.
- R: plan çözülemedi / limit sabitlendi logları → AC-6, AC-10 (kritik işlem değil, okuma).
- I: doğrudan REST okuma → AC-S1; kilitli satırda alan sızıntısı → AC-S2; seçenek RPC'si → AC-S7.
- D: sınırsız sayfa/boyut → AC-S6.
- E: limit yalnız UI'da → AC-S1 + RPC; anon → AC-S4; aboneliksiz → AC-S5.
`authz-test` verify'da canlı probe olarak çalıştırılacak (AC-S1, S4, S5).

## Davranış Sözleşmesi
RPC: `feed_listings(p_filters jsonb, p_page int) returns jsonb` (security definer, `set search_path = public`).

| # | Durum | Dönen değer | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Limit altında | `{"items":[{"id":"…","title":"Kadıköy 3+1","price":2450000,"currency":"TRY","rooms":"3+1","area_m2":120,"city":"İstanbul","district":"Kadıköy","source_group_name":"Kadıköy Emlakçılar","created_at":"…","locked":false}],"locked_count":0,"limit":10,"open_today":7}` | yok | Normal kartlar, "Bugün 7/10 ilan açık" | AC-1, AC-5 |
| 2 | Limit aşıldı | `{"items":[…açık…, {"id":"…","city":"İstanbul","district":"Ataşehir","created_at":"…","locked":true}],"locked_count":4,"limit":10,"open_today":10}` | yok | Kilitli kartlar + "Planı yükselt" | AC-1, AC-4, AC-S2 |
| 3 | Sınırsız plan | `{"items":[…],"locked_count":0,"limit":null,"open_today":23}` | yok | Gösterge yok | AC-3 |
| 4 | Aboneliksiz | `{"items":[],"locked_count":0,"limit":0,"reason":"no_subscription"}` | yok | Bugünkü abonelik ekranı (değişmez) | AC-S5 |
| 5 | anon | 401 (PostgREST, execute yok) | yok | — | AC-S4 |
| 6 | DB/RPC hatası | sunucu `{ ok:false, code:"<pg code>" }` | log `[dashboard] feed rpc failed` | "İlanlar yüklenemedi" + Tekrar dene | AC-9 |
| 7 | Zaman aşımı 5 sn | `{ ok:false, code:"TimeoutError" }` | aynı log | aynı | AC-9 |
| 8 | Kısmi: plan_id yok | limit 10 ile satır 1/2 şekli | log `feed_plan_missing` | Temel gibi | AC-6 |
| 9 | Hiçbir şey yapılamadı ama hata yok: limit ≤ 0 | `{"items":[…hepsi locked…],"locked_count":N,"limit":0,"open_today":0}` | log `feed_limit_clamped` | Tümü kilitli, hata yok | AC-10 |
| 10 | Filtre sonucu boş | `{"items":[],"locked_count":0,…}` (reason yok) | yok | "Filtreye uyan ilan yok" (mevcut boş durum) | AC-2 |

Boş sonuç ↔ hata ayrımı: aboneliksiz `reason:"no_subscription"`; filtre boş `reason` yok; hata `ok:false`.
Nullable alanlar (açık kartta price/rooms/area_m2/city/district/source_group_name null olabilir): mevcut `format.ts` davranışı korunur ("Fiyat belirtilmemiş", alan gizlenir, "Bilinmeyen grup"). Kilitli kartta city/district null → "Konum belirtilmemiş".
Doğrudan tetikleme: AC-S1/S4/S5 canlı REST probe ile (vekil değil); AC-1/2/10 SQL fonksiyonu gerçek DB'de rolled-back tx içinde örnek veriyle; AC-S2 RPC yanıt JSON'unun anahtar kümesiyle.
Kombinasyon satırı: "Temel plan + il filtresi + bugün 15 ilan (5'i filtreye uyuyor, 3'ü açık kümede)" → filtre sonucu 3 açık + 2 kilitli.

## Test Strategy
Unit 60% — sunucu tarafı yanıt eşleme (query.ts), kart/gösterge render, fiyat metni, hata/timeout dalları.
Integration 30% — migration statik SQL testi (definer, search_path, revoke public+anon, argüman listesi) + canlı rolled-back tx probe'ları (verify'da).
E2E 10% — Browser pane: kilitli kart + CTA görünümü (verify).

## Benchmark / Başarı Ölçütü
Coverage 85%. feed_listings p95 < 300 ms (verify'da `explain analyze` ile kaba ölçüm). Görsel: kilitli kart bulanık yer tutucu 320/1280'de taşmaz.

## Kapsam Dışı
Plan değiştirme/yükseltme ödeme akışı (CTA `/pricing`'e gider), web push, Faz 3 kişisel ilanlar, ilan detay sayfası, admin paneli, kullanıcı bazlı görüntüleme sayacı tablosu, bildirimlerde limit.

## Proje Ortamı Kısıtı
Arama `web/` ve `supabase/` ile sınırlı. Canlı DB erişimi `npx supabase db query --linked` ile çalışıyor (önceki görevlerde doğrulandı).

## Rollback Beklentisi
`0020_feed_daily_limit.down.sql`: `listings_subscriber_select` geri oluşturulur, RPC'ler drop edilir; frontend commit revert. Sıra: migration ile RPC + policy drop aynı dosyada; frontend aynı commit'te — canlıya uygulama frontend deploy'u ile aynı anda yapılmalı (aksi halde eski frontend 0 satır görür).

## Risks
- Policy kaldırılınca `fetchFilterOptions` ve `unread.ts` kırılır → aynı migration'da RPC'ye taşınıyor (AC-7).
- Uygulama sırası: migration canlıya uygulanıp frontend deploy edilmezse mevcut site akışı boş görünür. Henüz canlı kullanıcı yok (kabul edilen risk).
- Gün sınırı: 23:59/00:01 İstanbul testleri zorunlu.
- Pencere fonksiyonu (row_number over partition by gün) havuz büyüdükçe yavaşlar → `created_at desc` indeksi var, ölçülecek.

## Assumptions
- "Günlük" = İstanbul günü başına en yeni N (Opus cevabı; kullanıcı "günlük ilan görüntüleme" dedi). Varsayım.
- Kilitli kartta il/ilçe göstermek kabul edilebilir bilgi (yükseltme teşviki).

## Unknowns
- Yok.

## Sorular ve Cevaplar (ham kayıt)
0. Plan farkı ne? → Günlük ilan görüntüleme; Temel 10 / Pro 50 / Kurumsal sınırsız (kullanıcı mesajından).
1–12. Opus low alt-ajanı tarafından yanıtlandı: gün başına en yeni N (İstanbul); limit filtreden önce; trialing → kaydın planı (Temel); past_due → kendi planı, plan yoksa 10; listings_subscriber_select kaldırılıp definer RPC'ler; kilitli satır yalnız id/city/district/created_at; zil kilitliler dahil sayar; fiyat sayfası + "X/N" göstergesi; sözleşme tablosu; p95<300ms, 60/30/10; kapsam dışı liste; riskler (filtre seçenekleri ve sayaç RPC'ye taşınır). Orkestratör düzeltmesi: "used_today" → `open_today` (bugün açık ilan sayısı), feature flag önerisi alınmadı (tek commit revert yeterli).

Notion mirror: atlandı (Jira yeterli).
