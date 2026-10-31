---
task_slug: faz3b-grup-secimi-kisisel-ilan
jira_id: EML-107
threat_model: done
priority: high
coverage_target: 80
performance_target: "eşiği geçen kişisel ilan mesajdan sonra p95 ≤ 2 dk akışta"
memory_target: null
test_strategy:
  unit: 60
  integration: 30
  e2e: 10
affected_modules:
  - supabase/migrations/0024_wa_groups_personal_listings.sql (+ .down.sql)
  - scraper/sidecar/ (grup listesi upsert, seçili grup filtresi, sayaçlar)
  - scraper/orchestrator.py, scraper/supabase_client.py (agent_id taşıma, eşik yönlendirme)
  - web/src/app/agent/whatsapp/ (grup seçimi bölümü)
  - web/src/app/agent/dashboard/ (feed: "Kendi gruplarım" filtresi + rozet)
  - web/src/app/admin/ (kuyrukta kişisel ilan etiketi, eşik ayarı)
---

# ATDD — faz3b-grup-secimi-kisisel-ilan

## Jira Kaynağı
[EML-107 — Faz 3b: WhatsApp grup seçimi, kişisel ilan görünürlüğü ve otomatik onay eşiği](https://kuyusuzyusuf123.atlassian.net/browse/EML-107)
Üst bağlam: EML-104 (Faz 3a).

## Kullanıcı kararları (yol-haritasi.md, 2026-10-31)
- Yalnız okuma; emlakçı numarasından mesaj gönderilmez.
- Yalnız seçili gruplar işlenir; seçilmeyen grup ve birebir (DM) mesajlar **işlenmez, saklanmaz**.
- Kalite eşiğini geçen kişisel ilan doğrudan emlakçıya; altındakiler admin kuyruğuna.
- Sidecar kullanıcının VPS'inde; web ↔ sidecar yalnız Supabase tabloları/RPC'ler üzerinden.

## Persona
WhatsApp'ını 3a ile bağlamış, teknik seviyesi düşük aboneli emlakçı. Ayrıca kuyruğu yöneten admin.

## Hedef (Neden)
Emlakçının kendi gruplarındaki ilanları, kimseyle paylaşılmadan, kendi akışında görmesi (Faz 3'ün asıl değeri). Admin yükü otomatik eşikle sınırlı kalır (R5).

## User Story
As a bağlı hesabı olan emlakçı
I want hangi WhatsApp gruplarımın okunacağını seçmek ve o gruplardan gelen ilanları akışımda görmek
So that kendi ağımdaki ilanları düzenli ve filtrelenebilir biçimde takip edebileyim.

## Acceptance Criteria
1. [Critical] Given bağlantı `connected`, When sidecar hesabın gruplarını okur, Then `wa_groups`'a (agent_id, group_jid, name, updated_at) upsert eder; emlakçı `get_my_wa_groups()` ile yalnız kendi gruplarını görür.
2. [Critical] Given emlakçı ≤20 grup seçer, When `set_my_wa_group_selection(p_group_jids text[])` çağrılır, Then seçim kaydedilir ve `{"ok":true,"selected":N}` döner.
3. [Critical] Given seçili gruptan ilan mesajı gelir, When parse edilir, Then `raw_listings`'e `owner_agent_id` ile yazılır; `quality_score ≥ eşik` ise otomatik `approved` + `listings.owner_agent_id` dolu kayıt oluşur.
4. [Critical] Given kişisel ilan (owner_agent_id = A), When emlakçı B akışı/RPC'leri/doğrudan REST ile okumayı dener, Then ilan B'ye hiçbir yoldan görünmez; ortak havuz (owner_agent_id null) akışına da girmez.
5. [Critical] Given seçilmemiş gruptan veya DM'den mesaj gelir, When sidecar alır, Then içerik hiçbir tabloya/log'a yazılmaz; yalnız `sidecar_heartbeat.counters` içinde `skipped_unselected` / `skipped_dm` artar.
6. [High] Given `quality_score < eşik` veya null, Then ilan `pending` kalır, admin kuyruğunda "Kişisel — <emlakçı>" etiketiyle görünür; onaylanırsa yalnız sahibine, reddedilirse kimseye görünmez.
7. [High] Given eşik `app_settings('personal_auto_approve_threshold')` (varsayılan 0.70), When admin değiştirir, Then sonraki ilanlara uygulanır; geçersiz değer (0-1 dışı) reddedilir.
8. [High] Given emlakçının akışı, When "Kendi gruplarım" filtresi seçilir, Then yalnız kişisel ilanlar, kaynak grup adı rozetiyle gösterilir; kişisel ilanlar plan günlük limitine **sayılmaz**.
9. [High] Given bir grubun seçimi kaldırılır, Then o gruptan yeni mesaj işlenmez; önceden gelen kişisel ilanlar akışta kalır.
10. [High] Given bağlantı `disconnected`/`logged_out`/`error`/`pending`/`qr`, Then seçim ekranı salt-okunur + "Yeniden bağlan" uyarısı; mevcut kişisel ilanlar görünmeye devam eder.
11. [Medium] Given aynı fingerprint aynı emlakçıda tekrar gelir, Then tek kayıt kalır; farklı emlakçıda veya ortak havuzda aynı fingerprint varsa her biri ayrı kayıt olur.
12. [Medium] Given 3a "bağlantıyı kes + verilerimi sil", Then `wa_groups`, seçimler ve emlakçının kişisel `raw_listings`/`listings` kayıtları da silinir.
13. [Critical] AC-S1 (E/I, doğrudan veri yolu): Emlakçı B'nin JWT'siyle `GET /rest/v1/listings?owner_agent_id=eq.<A>`, `GET /rest/v1/raw_listings`, `GET /rest/v1/wa_groups` → 0 satır veya 42501; `feed_listings`, `feed_filter_options`, `feed_unread_count` ve push gönderici A'nın kişisel ilanını B'ye hiç döndürmez/bildirmez (iki emlakçılı integration testi, her RPC ayrı).
14. [Critical] AC-S2 (T): `set_my_wa_group_selection` agent_id argümanı almaz, `auth.uid()` kullanır; B, A'nın grup JID'sini gönderirse `unknown_group` döner, A'nın seçimi değişmez. `wa_groups`/seçim tablosuna authenticated rolün doğrudan INSERT/UPDATE'i → 42501.
15. [Critical] AC-S3 (E, service_role): Sidecar `owner_agent_id`'yi yalnız mesajı alan oturumun `agent_id`'sinden türetir; raw_listings/listings yazımı, wa_groups upsert'i ve seçim okuması hep `agent_id = <oturum sahibi>` filtresi taşır. Test: A'nın oturumuna gelen mesaj B'nin seçili grubuyla aynı JID'ye sahip olsa bile kayıt yalnız A'ya yazılır; B'nin seçimi A'nın işlemesini etkilemez.
16. [Critical] AC-S4 (I, KVKK): Seçilmemiş grup ve DM mesajlarının metni, gönderen numarası veya JID'si hiçbir tabloya ve hiçbir log satırına yazılmaz (test: sahte mesaj → tüm tablolarda ve yakalanan log çıktısında içerik/numara aranır, bulunmaz). Kişisel ilanlarda gönderen numarası `parsed` içinde saklanmaz/maskelenir.
17. [High] AC-S5 (E): `app_settings` eşiği yalnız admin RPC'siyle değişir; emlakçı JWT'siyle çağrı veya doğrudan REST UPDATE → `forbidden`/42501, değer değişmez; 0-1 dışı değer → `invalid_value` (DB CHECK ile de).
18. [High] AC-S6 (T): Kişisel `listings.owner_agent_id` emlakçı tarafından değiştirilemez (doğrudan REST PATCH → 42501); admin onay RPC'si kişisel ilanı onaylarken owner_agent_id'yi korur, null yapıp ortak havuza taşımaz.
19. [Medium] AC-S7 (D): `set_my_wa_group_selection` dizisi >20 eleman veya >200 karakterlik JID → reddedilir; sidecar grup upsert'i hesap başına en fazla 500 grup yazar, fazlası atlanır + sayaç `groups_truncated`.
20. [Medium] AC-S8 (R): Seçim değişiklikleri `wa_connection_events`'e (veya ayrı olay tablosuna) içeriksiz kayıt düşer (agent_id, eklenen/çıkarılan sayısı, zaman); eşik değişikliği admin id'siyle loglanır.

## Threat Model
Çağrıldı — AC-S1..AC-S8 yukarıdaki Acceptance Criteria'ya eklendi. Sınırlar: emlakçı↔emlakçı (kiracı), tarayıcı→PostgREST, sidecar(service_role)→DB, WhatsApp mesajı→sistem (KVKK). STRIDE: hepsi uygulandı. Ortam kısıtı: AC-S1/S2/S6'nın doğrudan REST denemeleri gerçek JWT ile canlı projede çalıştırılabilir; `pg_policies` introspection gerektiren kontrol yazılmadı. Not: AC-S'ler yetkilendirme içerdiği için plan/test adımında `authz-test` çağrılmalı.

## Davranış Sözleşmesi

### `get_my_wa_groups()`
| # | Durum | Dönen | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path | `{"ok":true,"status":"connected","groups":[{"jid":"123@g.us","name":"Kadıköy Emlak","selected":true}],"max":20}` | yok | grup listesi, işaretli olanlar | AC-1 |
| 2 | Oturum yok | `{"ok":false,"error":"unauthorized"}` | yok | login'e yönlendirme | AC-4 |
| 3 | Bağlantı kaydı yok | `{"ok":true,"status":"none","groups":[],"max":20}` | yok | "Önce WhatsApp'ını bağla" | AC-10 |
| 4 | Bağlı ama grup listesi henüz gelmedi | `{"ok":true,"status":"connected","groups":[],"max":20,"groups_synced_at":null}` | yok | "Gruplar yükleniyor…" (boş ≠ hata) | AC-1 |
| 5 | Durum `disconnected`/`logged_out`/`error`/`pending`/`qr` (her biri) | `{"ok":true,"status":"<durum>","groups":[...son bilinen...],"readonly":true}` | yok | salt-okunur liste + "Yeniden bağlan" | AC-10 |
| 6 | Grup adı null | `name: null` | yok | "(adsız grup)" | AC-1 |

### `set_my_wa_group_selection(p_group_jids text[])`
| # | Durum | Dönen | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path | `{"ok":true,"selected":3}` | seçim tamamen değiştirilir (tek transaction) | "Kaydedildi" | AC-2 |
| 2 | >20 jid | `{"ok":false,"error":"too_many","max":20}` | yok | "En fazla 20 grup" | AC-2 |
| 3 | Kendisine ait olmayan / bilinmeyen jid | `{"ok":false,"error":"unknown_group"}` | yok (hiçbiri yazılmaz) | "Liste güncel değil, yenile" | AC-4 |
| 4 | Oturum yok | `{"ok":false,"error":"unauthorized"}` | yok | login | AC-4 |
| 5 | Bağlantı `connected` değil | `{"ok":false,"error":"not_connected"}` | yok | salt-okunur uyarı | AC-10 |
| 6 | Boş dizi | `{"ok":true,"selected":0}` | tüm seçim kalkar | "Hiçbir grup okunmuyor" | AC-9 |
| 7 | Kısmi başarı | oluşamaz: tek transaction; herhangi bir jid geçersizse tümü reddedilir (#3) | — | — | AC-2 |

### Sidecar mesaj işleme
| # | Durum | Sonuç | Yan etki | Görünürlük | AC |
|---|---|---|---|---|---|
| 1 | Seçili grup, ilan, score ≥ eşik | raw_listings `approved` + listings (owner_agent_id) | push bildirimi (Faz 2c) | sayaç `personal_auto_approved` | AC-3 |
| 2 | Seçili grup, score < eşik | raw_listings `pending` | admin kuyruğu | sayaç `personal_queued` | AC-6 |
| 3 | Seçili grup, score null | `pending` | admin kuyruğu | sayaç `personal_queued_noscore` | AC-6 |
| 4 | Seçili grup, ilan değil (parse boş) | hiçbir şey yazılmaz | — | sayaç `personal_not_listing` | AC-5 |
| 5 | Seçilmemiş grup | hiçbir şey yazılmaz | — | sayaç `skipped_unselected` | AC-5 |
| 6 | DM | hiçbir şey yazılmaz | — | sayaç `skipped_dm` | AC-5 |
| 7 | Aynı emlakçıda tekrar fingerprint | yazılmaz | — | sayaç `personal_duplicate` | AC-11 |
| 8 | Supabase yazma hatası | raw yazılmadı, retry yok (mesaj kaybı) | — | sayaç `personal_write_error` + error log (içeriksiz) | AC-3 |
| 9 | Kısmi başarı: raw yazıldı, listings yazılamadı | oluşamaz — `ingest_personal_listing` tek transaction; listings hatası raw'ı da geri alır, hiçbir şey kalmaz | — | sayaç `personal_write_error` + içeriksiz log | AC-3 |

_Revizyon (2026-10-31, red-team tur 4): satır 9 başlangıçta "raw pending'e düşer" diyordu; implementasyonda daha güvenli olan atomik yol seçildi, sözleşme buna göre güncellendi._
| 10 | Eşik ayarı okunamadı | varsayılan 0.70 kullanılır | — | sayaç `threshold_fallback` | AC-7 |

Hiçbir şey yapılamadı ama hata yok: satır 4-7 — her birinin ayrı sayacı var, sessiz geçiş yok.
Boş ↔ hata: `groups: []` + `groups_synced_at: null` = "henüz senkron yok"; yetkisizlik her zaman `ok:false,error:"unauthorized"`.

## Test Strategy
Unit 60% — eşik yönlendirme, grup filtresi, sayaçlar, seçim validasyonu.
Integration 30% — RPC'ler, iki emlakçılı izolasyon (A'nın ilanı B'ye görünmez, REST + RPC), sidecar → raw_listings → listings.
E2E 10% — grup seç → kişisel ilan akışta "Kendi gruplarım" filtresiyle görünür.

## Benchmark
Coverage 80%. Eşiği geçen ilan p95 ≤ 2 dk akışta. Görsel: seçim ekranı mobilde (375px) taşmasız; salt-okunur uyarı görünür.

## Kapsam Dışı
Mesaj gönderme; DM işleme; geçmiş mesaj backfill; medya/video; kişisel ilanı ortak havuza paylaşma; emlakçı başına eşik.

## Etkilenen Dosyalar
Frontmatter `affected_modules`.

## Proje Ortamı Kısıtı
Doğrulanmadı — aramalar `emlak-platform/` klasörüyle sınırlanmalı.

## Rollback
Migration `.down.sql` ile geri alınır; sidecar seçili grup yoksa (eski davranış) kişisel mesaj işlemez → güvenli varsayılan.

## Risks
- **0007'deki global fingerprint unique index** (`status <> 'rejected'`) emlakçı başına dedup'la çelişir; index `(coalesce(owner_agent_id), fingerprint)` olarak değişmeli — plan'da karar.
- Kişisel ilanların mevcut `feed_listings`/`feed_unread_count`/push RPC'lerine sızması (owner filtresi unutulursa) — AC-4 en kritik test.
- Sidecar service_role ile yazıyor: owner_agent_id'nin oturumun sahibinden türetilmesi zorunlu, mesajdan değil.

## Assumptions
- Eşik 0.70, max 20 grup, kişisel ilan plan limitine sayılmaz (Opus alt-ajanı önerisi, kullanıcı onayı bekliyor).
- Grup listesi bağlantıda + 6 saatte bir + `groups.update` olayında senkronlanır.

## Unknowns
- `app_settings` tablosu var mı, yoksa bu migration'da mı açılacak — plan'da.

## Sorular ve Cevaplar
(Tümü Opus low alt-ajanı tarafından yanıtlandı; Codex denenmedi.)
1. Grup listesi → sidecar `wa_groups`'a upsert, JID anahtar, ad değişince yalnız name güncellenir.
2. Seçim kaldırılınca eski ilanlar → kalır, etki ileriye dönük.
3. Görünürlük → `listings.owner_agent_id` (null=ortak); aynı akış + "Kendi gruplarım" filtresi/rozeti; plan limiti uygulanmaz.
4. Eşik → 0.70, `app_settings`; null score → kuyruk.
5. Dedup → emlakçı başına; havuzlar arası birleştirme yok.
6. Grup üst sınırı → 20, RPC'de.
7. Bağlantı kopukken → seçim salt-okunur, ilanlar görünür.
8. Admin kararı → onay yalnız sahibine, red kimseye.
9. Başarı → p95 ≤ 2 dk.
10. Kapsam dışı → yukarıda.
11. Test oranı → 60/30/10.
12. Atlanan mesajlar → içeriksiz sayaçlar (`sidecar_heartbeat.counters`).
