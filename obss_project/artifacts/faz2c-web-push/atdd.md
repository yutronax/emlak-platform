---
task_slug: faz2c-web-push
jira_id: EML-101
threat_model: done
priority: medium
coverage_target: 80
performance_target: "cron çalışması < 10 sn (1000 abonelik)"
memory_target: null
test_strategy:
  unit: 70
  integration: 25
  e2e: 5
affected_modules:
  - supabase/migrations/0021_push_subscriptions.sql (+ .down.sql)
  - web/public/sw.js, web/public/manifest.webmanifest (+ ikonlar)
  - web/src/app/api/cron/push/route.ts
  - web/src/lib/push/*
  - web/src/app/agent/dashboard/ (bildirim aç/kapat bileşeni + server action)
  - web/vercel.json
  - web/package.json (web-push, @types/web-push)
  - .env.example (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, CRON_SECRET)
---

# ATDD — faz2c-web-push

## Jira Kaynağı
[EML-101 — Faz 2c: yeni ilan için tarayıcı bildirimi (Web Push)](https://kuyusuzyusuf123.atlassian.net/browse/EML-101)
Kaynak: `yol-haritasi.md` Faz 2 "Sonra: tarayıcı bildirimi (Web Push)".

## Persona
Aboneli emlakçı; çoğu mobilde (iPhone/Android), teknik seviyesi düşük. Paneli sürekli açık tutmuyor.

## Hedef (Neden)
Yeni ilan geldiğinde emlakçı paneli açmadan haberdar olsun; site içi zil yalnız panel açıkken işe yarıyor.

## User Story
As a aboneli emlakçı
I want yeni ilan gelince telefonuma bildirim almak
So that fırsatı kaçırmadan panele dönebileyim.

## Kullanıcı kararları (2026-10-30)
- `web-push` npm paketi eklenir (+ `@types/web-push`).
- Barındırma Vercel → 5 dakikalık Vercel Cron (`vercel.json`). Not: Hobby planda cron günde 1 kez çalışır; 5 dk için Pro gerekir (Assumptions).

## Acceptance Criteria
1. [Critical] **AC-1 İzin + kayıt:** Given aboneli emlakçı panelde "Bildirimleri aç"a basar ve izin verir, When abonelik oluşur, Then sunucuda kendi `agent_id`'siyle tek `push_subscriptions` satırı (endpoint UNIQUE) yazılır ve buton "Bildirimleri kapat"a döner. Otomatik izin istemi yoktur.
2. [Critical] **AC-2 Toplu gönderim:** Given son gönderimden sonra N≥1 yeni ilan onaylanmış, When cron (5 dk) çalışır, Then her aktif abonelik satırına tek bildirim gider: başlık "Yeni ilanlar", gövde "{N} yeni ilan geldi" (N>99 → "99+"), tıklama `/agent/dashboard`'a açar. Admin art arda 30 ilan onaylasa da pencere başına cihaz başına 1 bildirim.
3. [Critical] **AC-3 Erişim filtresi:** Bildirim yalnız erişimi olan (subscriptions active/trialing/past_due + current_period_end > now()) emlakçının cihazlarına gider; erişimi biten kullanıcının satırı silinmez, atlanır.
4. [High] **AC-4 Kapatma:** "Bildirimleri kapat" → tarayıcı aboneliği iptal + sunucu satırı silinir.
5. [High] **AC-5 iOS rehberi:** iOS'ta tarayıcı sekmesinde (standalone değil) buton yerine "Ana Ekrana Ekle" adım rehberi gösterilir. `manifest.webmanifest` (`display: standalone`, ikonlar) eklenir.
6. [High] **AC-6 Durumlar:** İzin `denied` → "Tarayıcı ayarlarından bildirime izin verin" + kısa talimat; tarayıcı desteklemiyor → "Bu tarayıcı bildirim desteklemiyor"; VAPID env yoksa bölüm hiç görünmez.
7. [High] **AC-7 Geçersiz abonelik:** Push servisi 404/410 → satır silinir (`removed++`). 429/5xx → log, satır tutulur, yeniden deneme yok.
8. [High] **AC-8 Onay izolasyonu:** Admin onay akışı (`approve_raw_listing`) değişmez; gönderim hatası onayı asla etkilemez (gönderim ayrı cron route'unda).
9. [Medium] **AC-9 Çoklu cihaz:** Bir emlakçının birden fazla cihazı ayrı satır; her birine ayrı gider.

### Güvenlik kriterleri (threat-model)
10. [Critical] **AC-S1 Kimlik sunucudan:** Kayıt action'ı `agent_id`'yi istemciden almaz, `auth.getUser()`'dan alır. RLS: `push_subscriptions` select/insert/delete yalnız `agent_id = auth.uid()`; A kullanıcısı JWT'siyle B'nin satırını okuyamaz/silemez/ekleyemez (0 satır / 42501). Update policy yok.
11. [Critical] **AC-S2 SSRF / endpoint allowlist:** Endpoint yalnız `https:` ve host `fcm.googleapis.com`, `*.push.apple.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com` ise kabul edilir; `http://169.254.169.254/...`, `https://evil.com/...`, `https://fcm.googleapis.com.evil.com/` → `{ok:false, error:"invalid_endpoint"}`, satır yazılmaz. p256dh/auth base64url ve makul uzunluk (≤ 200) doğrulanır.
12. [Critical] **AC-S3 Cron yetkisi:** `/api/cron/push` yalnız `Authorization: Bearer ${CRON_SECRET}` ile çalışır; başlık yok/yanlış → 401, hiçbir gönderim/DB yazımı yok. CRON_SECRET env yoksa → 401 (fail-closed).
13. [Critical] **AC-S4 İçerik sızıntısı yok:** Payload yalnız `{title, body, url}`; ilan başlığı, fiyatı, konumu, grup adı içermez (Faz 2b kilitli ilan + KVKK).
14. [High] **AC-S5 VAPID özel anahtarı:** `VAPID_PRIVATE_KEY` yalnız sunucu modüllerinde okunur; `NEXT_PUBLIC_` önekli hiçbir değişken özel anahtarı taşımaz; istemci bundle'ında geçmez (statik test: `src/` altında client bileşenlerinde `VAPID_PRIVATE_KEY` yok).
15. [High] **AC-S6 Service worker:** `sw.js` yalnız `push` ve `notificationclick` işler; tıklamada yalnız aynı origin'deki yolu açar (payload'daki mutlak dış URL yok sayılır, `/agent/dashboard`'a düşer).
16. [Medium] **AC-S7 Sınır:** Bir emlakçı en fazla 10 cihaz satırı; 11.'de en eski satır silinir (DoS/şişme).

## Threat Model
Çağrıldı (2026-10-30). Varlıklar: push abonelik anahtarları (cihaza bildirim gönderme yetkisi), VAPID özel anahtarı, cron tetikleyicisi. Sınırlar: tarayıcı → server action → DB; Vercel Cron → route → push servisleri (dış HTTP); route service_role ile DB.
- S: cron'u herkes tetikleyebilir → AC-S3.
- T: istemci agent_id / başka kullanıcının endpoint'i → AC-S1; endpoint ile iç ağa istek (SSRF) → AC-S2.
- R: cron özeti log `{sent, failed, removed, skipped}` → Davranış Sözleşmesi.
- I: payload'da kilitli ilan verisi → AC-S4; VAPID özel anahtar → AC-S5.
- D: cihaz satırı şişmesi → AC-S7; 30 onay → spam → AC-2 toplama.
- E: service_role yalnız cron route'unda; route sahiplik filtresi yerine tüm aktif satırları okur (tasarım gereği, yalnız gönderim) — okuma sonucu dışarı dönmez, yalnız sayaçlar döner.
service_role sorguları (zorunlu madde): cron route yalnız (a) `push_subscriptions` + `subscriptions` okuma, (b) 404/410 olan satırı `id = <o satır>` ile silme, (c) `last_notified_at` güncelleme yapar; istemci girdisi almaz.

## Davranış Sözleşmesi
Kayıt: server action `savePushSubscription({endpoint, keys:{p256dh, auth}})`. Kapatma: `deletePushSubscription({endpoint})`. Cron: `GET /api/cron/push`.

| # | Durum | Dönen değer | Yan etki | Kullanıcı / operatör ne görür | AC |
|---|---|---|---|---|---|
| 1 | Kayıt happy | `{ok:true}` | satır upsert (endpoint unique) | "Bildirimleri kapat" | AC-1 |
| 2 | Kayıt: endpoint allowlist dışı | `{ok:false, error:"invalid_endpoint"}` | yok | "Bildirimler açılamadı" | AC-S2 |
| 3 | Kayıt: oturum yok | `{ok:false, error:"unauthorized"}` | yok | girişe yönlendirme | AC-S1 |
| 4 | Kayıt: DB hatası | `{ok:false, error:"save_failed"}` + log `[push] save failed {code}` | yok | "Bildirimler açılamadı, tekrar deneyin" | AC-1 |
| 5 | Kapatma | `{ok:true}` (satır yoksa da) | satır silinir | "Bildirimleri aç" | AC-4 |
| 6 | Cron happy | 200 `{"sent":3,"failed":0,"removed":0,"skipped":null}` + `console.info` | last_notified_at güncellenir | bildirim | AC-2 |
| 7 | Cron: yeni ilan yok / abone yok | 200 `{"sent":0,"failed":0,"removed":0,"skipped":"nothing_new"}` veya `"no_subscribers"` | yok | log | AC-2 |
| 8 | Cron: VAPID env eksik | 200 `{"sent":0,"failed":0,"removed":0,"skipped":"disabled"}` + `console.warn` | yok | log | AC-6 |
| 9 | Cron: yetkisiz | 401 `{"error":"unauthorized"}` | yok | — | AC-S3 |
| 10 | Cron: push 404/410 | 200, `removed` artar | satır silinir | log | AC-7 |
| 11 | **Kısmi:** bazı cihazlar 5xx/429 | 200 `{"sent":2,"failed":1,...}` + `console.warn` | başarılı olanların last_notified_at güncellenir, başarısız olanınki **güncellenmez** (sonraki pencerede tekrar sayılır) | log | AC-7 |
| 12 | **Hiçbir şey yapılamadı ama hata yok:** DB okuma hatası | 500 `{"error":"db_failed"}` + `console.error` (sessiz 200 YOK) | yok | Vercel cron hatası görünür | — |
| 13 | İstemci: izin reddi / desteklenmeyen / iOS sekme | sunucuya istek yok | yok | AC-6 / AC-5 mesajları | AC-5, AC-6 |

"Yeni ilan" sayımı: satır başına `listings.created_at > coalesce(last_notified_at, push_subscriptions.created_at)`; approve action'a dokunulmaz (AC-8).
Boş ↔ hata ayrımı: `skipped` (iş yok) ile 500 `db_failed` (hata) ayrı.
Doğrudan tetikleme: AC-S1 canlı RLS probe; AC-S2 allowlist birim testi gerçek kötü URL'lerle; AC-S3 route testi başlıksız/yanlış/env-yok; AC-2 route testi `web-push` mock'u ile 30 ilan → 1 çağrı/cihaz; gerçek cihaz testi kullanıcıda.

## Test Strategy
Unit 70% — allowlist, payload kurucu, sayı formatı, cron özet hesaplama, buton durum makinesi.
Integration 25% — cron route (mock web-push + mock supabase), migration statik SQL, canlı RLS probe (verify).
E2E 5% — Browser pane: buton görünümleri (izin istemi otomatikleştirilemez).

## Benchmark / Başarı Ölçütü
Coverage 80%. Cron < 10 sn. Bildirim, onaydan en geç ~5 dk + cron gecikmesi sonra düşer (gerçek cihaz, kullanıcı doğrular).

## Kapsam Dışı
E-posta/SMS, filtre bazlı bildirim tercihleri, sessiz saatler, video teslim bildirimi, Faz 3 kişisel ilanlar, offline cache / tam PWA.

## Proje Ortamı Kısıtı
Arama `web/` ve `supabase/` ile sınırlı. Canlı DB `db query --linked`.

## Rollback Beklentisi
VAPID env silinirse özellik kapanır (buton gizli, cron `disabled`). Kod revert + `0021...down.sql`.

## Risks
- Vercel Hobby'de cron günde 1 → bildirim gecikir; Pro gerekebilir (kullanıcıya bildirilecek).
- iOS Web Push yalnız 16.4+ ve ana ekrana ekli PWA'da; hedef kitlede adım zorluğu (R6).
- `web-push` yeni bağımlılık (supply chain) — verify'da npm audit.

## Assumptions
- Yayın Vercel'de, cron 5 dk (Pro) — kullanıcı "Vercel" dedi, plan belirtilmedi.
- Gerçek cihaz testi kullanıcı tarafından yapılacak.

## Unknowns
- Vercel planı (Hobby/Pro).

## Sorular ve Cevaplar
0. Paket ve barındırma → `web-push` eklenir; Vercel (kullanıcı, AskUserQuestion).
1–12. Opus low alt-ajanı tarafından yanıtlandı: toplu 5 dk pencere; genel içerik; ayrı Vercel Cron + CRON_SECRET, approve'a dokunulmaz; push_subscriptions + RLS, service_role ile gönderim, çoklu cihaz; buton + iOS rehberi + denied/desteklenmiyor mesajları; gönderimde erişim filtresi; 404/410 sil, 429/5xx log; sözleşme tablosu; 70/25/5, gerçek cihaz kullanıcıda; kapsam dışı; env yoksa kapalı; güvenlik (auth.uid, allowlist, sw kapsamı, VAPID gizliliği, CRON_SECRET). Orkestratör eklemeleri: kuyruk tablosu yerine abonelik başına `last_notified_at` (approve'a sıfır değişiklik), kısmi başarıda başarısız cihazın sayacının ilerlememesi, DB hatasında 500, cihaz üst sınırı 10.

Notion mirror: atlandı.
