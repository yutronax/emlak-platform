---
task_slug: faz3a-whatsapp-baglama
jira_id: EML-104
threat_model: done
priority: high
coverage_target: 80
performance_target: "QR panelde ≤ 10 sn (sidecar çalışırken)"
memory_target: "sidecar ≤ ~40 MB/oturum, varsayılan en fazla 50 oturum"
test_strategy:
  unit: 70
  integration: 25
  e2e: 5
affected_modules:
  - supabase/migrations/0023_wa_connections.sql (+ .down.sql)
  - scraper/sidecar/ (çoklu oturum yöneticisi, şifreli auth state, Supabase istek/durum döngüsü)
  - web/src/app/agent/whatsapp/ (yeni sayfa: onay, QR, durum, kes+sil)
  - web/src/lib/whatsapp/*
  - .env.example
---

# ATDD — faz3a-whatsapp-baglama

## Jira Kaynağı
[EML-104 — Faz 3a: emlakçının kendi WhatsApp'ını QR ile bağlaması ve oturum yönetimi](https://kuyusuzyusuf123.atlassian.net/browse/EML-104)

## Kullanıcı kararları (2026-10-31, yol-haritasi.md)
- Yalnız OKUMA: emlakçı numarasından hiçbir mesaj gönderilmez; bağlamadan önce ban riski metni gösterilir, onay alınır.
- KVKK: yalnız seçili gruplar işlenir (seçim 3b). **3a'da kişisel oturumlardan hiçbir mesaj işlenmez.** Oturum anahtarları şifreli. Emlakçı bağlantısını ve verilerini silebilir.
- Sidecar kullanıcının VPS'inde; web ↔ sidecar Supabase tabloları üzerinden.
- 3b: grup seçimi, kişisel ilan görünürlüğü, otomatik onay eşiği.

## Persona
Aboneli emlakçı; teknik seviyesi düşük, telefonundan WhatsApp kullanıyor, paneli çoğunlukla bilgisayarda/telefonda açıyor.

## Hedef (Neden)
Her emlakçının kendi gruplarından kendi ilanlarını görmesinin (Faz 3) ilk adımı: emlakçının hesabının sisteme güvenli biçimde bağlanması ve bağlantının yönetilmesi.

## User Story
As a aboneli emlakçı
I want WhatsApp hesabımı panelden QR ile bağlamak ve istediğimde bağlantıyı tamamen kaldırmak
So that ileride kendi gruplarımdaki ilanları görebileyim ve kontrol bende olsun.

## Acceptance Criteria
1. [Critical] **AC-1 Onay:** Given aboneli emlakçı `/agent/whatsapp`'ta, When ban riski metnini onaylamadan "Bağla"ya basmaya çalışır, Then istek yapılamaz; onaylayınca `wa_consent_accepted_at` + `wa_consent_version` kaydedilir. Metin: "WhatsApp resmi olmayan bağlantıları kısıtlayabilir; numaranız kapatılabilir. Sistem numaranızdan hiçbir mesaj göndermez, yalnızca seçtiğiniz gruplardaki ilanları okur. Riski anladım ve kabul ediyorum."
2. [Critical] **AC-2 Bağlama:** Onaylı emlakçı "Bağla" → `request_wa_action('connect')` → durum `pending` → sidecar (≤3 sn poll) oturum açar → `qr` → panel QR'ı 2 sn poll ile gösterir → telefonla taratınca `connected`, maskeli numara (`+90 5** *** **12`) görünür.
3. [Critical] **AC-3 Kes ve sil:** "Bağlantıyı kaldır" → `request_wa_action('disconnect')` → sidecar `logout()`, agent'ın şifreli auth klasörünü siler, `wa_connections` satırı silinir, `wa_connection_events`'e kayıt düşer; panel "Bağlı değil" gösterir.
4. [Critical] **AC-4 Mesaj işlenmez:** Kişisel oturumlarda `messages.upsert` dinleyicisi bağlanmaz; `syncFullHistory:false`, `markOnlineOnConnect:false`; hiçbir mesaj webhook'a/DB'ye gitmez. Ortak hesap oturumu bugünkü gibi çalışmaya devam eder.
5. [High] **AC-5 Telefondan çıkarma:** Telefonda "Bağlı cihazlar"dan çıkarılırsa (loggedOut) sidecar auth klasörünü siler, durum `logged_out`; panel "Bağlantı telefondan kaldırıldı, yeniden bağlayabilirsiniz".
6. [High] **AC-6 QR süresi:** QR 20 sn'de yenilenir; 5 yenilemede taratılmazsa `disconnected/qr_expired`, "Süre doldu, tekrar deneyin". QR bağlantı kurulunca/süre dolunca/iptalde null yapılır.
7. [High] **AC-7 Sidecar yanıt vermiyor:** `pending` 30 sn sürerse `error/sidecar_timeout`, panel "Servis şu an yanıt vermiyor, biraz sonra tekrar deneyin". 45 sn'de QR gelmezse `error/no_qr_generated`.
8. [High] **AC-8 Yeniden başlatma:** Sidecar açılışta `connected` satırları 2 sn arayla yeniden açar; kopmada üstel backoff (2 sn → 5 dk, jitter); `connectionReplaced` → `disconnected/replaced`, otomatik yeniden bağlanma yok.
9. [High] **AC-9 Abonelik:** Aboneliksiz/erişimsiz emlakçı `connect` isteyemez (`subscription_required`); erişimi biten emlakçının oturumu sidecar'ın 10 dk'lık kontrolünde kapatılır (`disconnected/subscription_inactive`, auth silinir).
10. [Medium] **AC-10 Kapasite:** `WA_MAX_SESSIONS` (varsayılan 50) dolduysa yeni bağlantı `error/capacity`, "Şu an yeni bağlantı açılamıyor".
11. [Medium] **AC-11 Özellik bayrağı:** `NEXT_PUBLIC_WA_LINK_ENABLED` yoksa panel bağlantısı/sayfa gizli; `WA_MULTI_SESSION=0` ise sidecar yalnız ortak oturumu çalıştırır.

### Güvenlik kriterleri (threat-model)
12. [Critical] **AC-S1 Sahiplik:** `wa_connections`, `wa_connection_events`: authenticated için yalnız `agent_id = auth.uid()` select; INSERT/UPDATE/DELETE policy yok (yalnız RPC). A, B'nin satırını okuyamaz/değiştiremez (0 satır / 42501). `request_wa_action` ve `get_my_wa_status` argüman olarak agent_id almaz.
13. [Critical] **AC-S2 QR gizliliği:** `qr` sütunu authenticated'a SELECT ile açık değil (column grant ya da ayrı tablo); yalnız `get_my_wa_status()` (security definer, auth.uid()) süresi dolmamış QR'ı döner. anon her şeyde 401/42501.
14. [Critical] **AC-S3 Auth state şifreli:** Diskteki her auth dosyası AES-256-GCM ile şifreli (rastgele IV, auth tag), anahtar `WA_AUTH_KEY` (32 bayt) env; anahtar yoksa kişisel oturumlar başlamaz. Klasör agent_id'den türetilir, path traversal yok (yalnız UUID kabul), izin 0700. Test: yazılan dosyada düz `noiseKey`/`signedIdentityKey` vb. JSON anahtarları geçmez; yanlış anahtarla okuma hata verir.
15. [High] **AC-S4 Hız sınırı:** Agent başına 10 dk'da en fazla 3 `connect` isteği; aşımda `rate_limited`, satır değişmez.
16. [High] **AC-S5 Log/PII:** Loglarda QR string, creds, tam telefon numarası geçmez (redaksiyon testi); telefon DB'de yalnız maskeli saklanır.
17. [High] **AC-S6 Sidecar yazma kapsamı:** Sidecar service_role ile yalnız durum alanlarını (`status, qr, qr_expires_at, phone_masked, error_code, last_seen_at`) ve events/heartbeat'i yazar; `requested_action` alanını yalnız "işlendi" olarak temizler; başka tabloya yazmaz (3a).
18. [Medium] **AC-S7 Onay kanıtı:** Onay kaydı sürüm + zaman; onaysız `connect` → `consent_required`.

## Threat Model
Çağrıldı (2026-10-31). Varlıklar: emlakçının WhatsApp oturum anahtarları (hesabı tamamen ele geçirme gücü), QR (bağlama yetkisi), telefon numarası (KVKK), sidecar service_role. Sınırlar: tarayıcı → RPC → DB; sidecar (VPS, service_role) ↔ DB; sidecar ↔ WhatsApp.
- S: başka agent adına istek → AC-S1 (agent_id argüman değil).
- T: istemcinin durum alanlarını yazması → AC-S1 (doğrudan yazma yok); sidecar'ın fazla yazması → AC-S6.
- R: her durum geçişi `wa_connection_events` + yapılandırılmış log.
- I: QR sızıntısı → AC-S2 + kısa ömür; auth state sızıntısı (VPS yedeği/disk) → AC-S3; loglar → AC-S5.
- D: QR spam → AC-S4; oturum şişmesi → AC-10.
- E: aboneliksiz bağlantı → AC-9.
Kabul edilen risk: QR'ı ele geçiren biri kendi hesabını emlakçının paneline bağlayabilir (emlakçı başkasının grup ilanlarını görür; emlakçının hesabı etkilenmez). Panelde maskeli numara gösterilerek görünür kılınır.
service_role (zorunlu): sidecar sorguları her zaman `agent_id = <işlenen satırın agent_id'si>` ile; istek alma sorgusu yalnız `requested_action is not null` satırları.

## Davranış Sözleşmesi
RPC: `request_wa_action(p_action text)` returns jsonb; `get_my_wa_status()` returns jsonb; `accept_wa_consent(p_version text)` returns jsonb.

| # | Durum | Dönen değer | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | connect happy | `{"ok":true,"status":"pending"}` | satır upsert, requested_action='connect', attempt_id yeni | "Hazırlanıyor…" | AC-2 |
| 2 | status (QR var) | `{"status":"qr","qr":"2@abc…","qr_expires_at":"…"}` | yok | QR görseli | AC-2, AC-S2 |
| 3 | status (bağlı) | `{"status":"connected","phone_masked":"+90 5** *** **12"}` (qr yok) | yok | "Bağlı: +90 5** *** **12" | AC-2 |
| 4 | onaysız connect | `{"ok":false,"error":"consent_required"}` | yok | onay kutusu | AC-1, AC-S7 |
| 5 | aboneliksiz | `{"ok":false,"error":"subscription_required"}` | yok | "Bu özellik için aktif abonelik gerekir" | AC-9 |
| 6 | zaten bağlı/bekliyor | `{"ok":true,"status":"connected"}` (değişiklik yok) | yok | mevcut durum | AC-2 |
| 7 | hız sınırı | `{"ok":false,"error":"rate_limited"}` | yok | "Çok fazla deneme, 10 dk sonra tekrar deneyin" | AC-S4 |
| 8 | disconnect | `{"ok":true,"status":"pending"}` → sidecar sonrası satır yok | logout + auth sil + event | "Bağlı değil" | AC-3 |
| 9 | sidecar kapalı (30 sn pending) | status `{"status":"error","error_code":"sidecar_timeout"}` | web RPC timeout'u satıra yazar ya da get_my_wa_status hesaplar | "Servis yanıt vermiyor" | AC-7 |
| 10 | QR üretilmedi (45 sn) | `{"status":"error","error_code":"no_qr_generated"}` | event | "Bağlantı başlatılamadı, tekrar deneyin" | AC-7 |
| 11 | QR süresi doldu | `{"status":"disconnected","error_code":"qr_expired"}` | auth klasörü silinir | "Süre doldu" | AC-6 |
| 12 | connectionReplaced | `{"status":"disconnected","error_code":"replaced"}` | yeniden bağlanma yok | "Bağlantı başka bir yerde açıldı" | AC-8 |
| 13 | loggedOut | `{"status":"logged_out"}` | auth sil, event | "Telefondan kaldırıldı" | AC-5 |
| 14 | **Kısmi:** bağlandı ama creds kaydı başarısız | `{"status":"error","error_code":"creds_persist_failed"}` | logout + auth sil + event + log | "Bağlantı kaydedilemedi, tekrar deneyin" | AC-S3 |
| 15 | **Hiçbir şey yapılamadı ama hata yok:** WA_AUTH_KEY yok | kişisel istekler `{"status":"error","error_code":"sidecar_misconfigured"}`; ortak oturum çalışır; açılışta tek `console.error` + heartbeat'te `misconfigured:true` | — | "Servis şu an kullanılamıyor" | AC-S3, AC-11 |
| 16 | kapasite dolu | `{"status":"error","error_code":"capacity"}` | event | "Şu an yeni bağlantı açılamıyor" | AC-10 |
| 17 | abonelik bitti | `{"status":"disconnected","error_code":"subscription_inactive"}` | logout + auth sil | "Aboneliğiniz aktif değil" | AC-9 |

Operatör görünürlüğü: her geçiş `wa_connection_events(agent_id, attempt_id, from_status, to_status, error_code, created_at)`; sidecar 30 sn'de bir `sidecar_heartbeat(id=1, last_beat_at, sessions_open, misconfigured, counters jsonb)`.
Doğrudan tetikleme: sidecar durum makinesi sahte Baileys soketiyle (connection.update olayları) birim testte; RLS/RPC canlı probe; gerçek QR taraması kullanıcıda.

## Test Strategy
Unit 70% — sidecar: oturum yöneticisi, şifreli auth state, backoff, istek işleme, log redaksiyonu, maskeleme (node --test, sahte soket); web: sayfa durumları, RPC istemci eşlemesi (vitest).
Integration 25% — migration statik SQL + canlı RLS/RPC probe (rolled-back tx).
E2E 5% — gerçek QR taraması ve telefondan çıkarma (kullanıcı, VPS/yerel sidecar ile).

## Benchmark
Coverage 80%. QR ≤ 10 sn. Sidecar açılışında 50 oturum ≤ 2 dk'da yeniden bağlanır.

## Kapsam Dışı
Grup listesi/seçimi, kişisel mesaj işleme, ilan görünürlüğü, otomatik onay (3b); mesaj gönderme; birden fazla numara; VPS kurulum otomasyonu (Docker/pm2 dosyası 3a'da yalnız örnek olarak).

## Proje Ortamı Kısıtı
Arama `web/`, `supabase/`, `scraper/sidecar/` ile sınırlı (node_modules hariç).

## Rollback Beklentisi
`NEXT_PUBLIC_WA_LINK_ENABLED` kaldır → panel gizli; `WA_MULTI_SESSION=0` → yalnız ortak oturum. `0023...down.sql` tabloları/RPC'leri düşürür. Ortak hesap akışı hiç etkilenmez.

## Risks
- WhatsApp ban riski (R1) — kullanıcı onayıyla kabul.
- Baileys 7 rc kararsızlığı; çok oturumda bellek.
- QR ele geçirme (kabul edilen risk, yukarıda).
- VPS'te `WA_AUTH_KEY` kaybı → tüm kişisel oturumlar yeniden QR gerektirir (kabul).

## Assumptions
- Sidecar mevcut bridge.js'in yanında ayrı bir modül (ör. `sessions.js`) olarak, aynı süreçte çalışır.
- Web, sidecar'ın durumunu yalnız Supabase üzerinden bilir (doğrudan HTTP yok).

## Unknowns
- VPS kaynakları (RAM) — 50 oturum varsayılanı buna göre ayarlanmalı.

## Sorular ve Cevaplar
0. Kullanıcı kararları yukarıda (AskUserQuestion, 2026-10-31).
1–12. Opus low alt-ajanı tarafından yanıtlandı: tablo + poll (sidecar 3 sn, web 2 sn); QR yalnız RPC ile, 20 sn ömür, kabul edilen QR riski; AES-256-GCM şifreli dosya auth, WA_AUTH_KEY; tek süreç Map, 50 sınır, backoff; kişisel oturumda mesaj dinleyicisi yok, grup listesi 3b; kes+sil ve loggedOut temizliği; abonelik bitince kapatma; sürümlü onay; durum/hata kodu tablosu; AC-S listesi; 70/25/5; kapsam dışı + iki bayrakla rollback.

Notion mirror: atlandı.
