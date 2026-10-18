---
task_slug: eml-20-scraper-webhook-auth
jira_id: EML-20
threat_model: done
priority: critical
coverage_target: 90
performance_target: "<1ms ek gecikme (hmac.compare_digest)"
memory_target: null
test_strategy:
  unit: 60
  integration: 40
  e2e: 0
affected_modules:
  - scraper/orchestrator.py
  - scraper/sidecar/bridge.js
  - scraper/.env
  - scraper/.env.example
  - scraper/tests/test_webhook_auth.py
---

# ATDD — eml-20-scraper-webhook-auth

## Jira Kaynağı
[EML-20 — [P0] Scraper webhook'una (:8090/baileys-webhook) auth ekle](https://kuyusuzyusuf123.atlassian.net/browse/EML-20)
Açıklama (Jira'dan birebir): "scraper/orchestrator.py — webhook uç noktası
kimlik doğrulamasız ve 0.0.0.0'a bağlı. Ağdan erişen herkes raw_listings'e
service-role ile kayıt sokabilir ve Gemini kotasını tüketebilir. Secret/token
kontrolü ve bind adresinin sınırlanması gerekiyor. Kaynak:
proje-dokumantasyonu.md §10.2"
Etiketler: P0, security.

## Persona
Meşru çağıran: aynı makinede/Docker ağında çalışan `scraper/sidecar/bridge.js`
(Baileys WhatsApp köprüsü) — tek gerçek "kullanıcı" bu süreç. Saldırgan:
8090 portuna ağdan erişebilen herkes (LAN/VM komşusu, port taraması yapan
biri, ele geçirilmiş bir container). (Opus alt-ajanı tarafından yanıtlandı)

## Hedef (Neden)
Kimliği doğrulanmamış bir istemcinin service-role yetkisiyle `raw_listings`'e
keyfi kayıt yazması (RLS tamamen bypass edilir, veri zehirlenir) ve Gemini
API kotasının sınırsızca tüketilmesi (maliyet/DoS) riskini kapatmak.
(Opus alt-ajanı tarafından yanıtlandı)

## User Story
As a scraper sistemi işletmecisi (Yusuf)
I want /baileys-webhook ucunun sadece geçerli bir paylaşılan-sır token'ıyla
  çağrılabilmesini ve sadece beklenen arayüzde dinlemesini
So that ağdaki yetkisiz bir istemci raw_listings'e yazamasın ve Gemini
  kotasını tüketemesin

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given bridge.js doğru `BAILEYS_WEBHOOK_SECRET` değerini
   `Authorization: Bearer <token>` header'ında gönderiyor, When
   `/baileys-webhook`'a POST yapılıyor, Then istek kuyruğa alınır ve 200
   döner (mevcut davranış korunur).
2. [Critical] **AC-S1 (Spoofing)** Given istekte `Authorization` header'ı
   hiç yok, When `/baileys-webhook`'a POST yapılıyor, Then 401 döner,
   body `{"error":"unauthorized"}`, `WWW-Authenticate: Bearer` header'ı
   eklenir, payload kuyruğa ALINMAZ.
3. [Critical] **AC-S1 (Spoofing)** Given `Authorization: Bearer <yanlış-token>`
   gönderiliyor, When `/baileys-webhook`'a POST yapılıyor, Then yine 401
   ve AYNI `{"error":"unauthorized"}` body döner (eksik token ile yanlış
   token arasında ayrım yapılmaz — oracle verilmez), payload kuyruğa
   ALINMAZ.
4. [High] **AC-S2 (Tampering/timing)** Token karşılaştırması
   `hmac.compare_digest` ile sabit zamanlı yapılır — kısa/uzun/kısmen
   doğru token denemeleri arasında ölçülebilir bir süre farkı
   OLUŞTURMAZ (test: aynı uzunlukta doğru ve yanlış token ile çalıştırma
   süresi karşılaştırılır, büyük sapma olmamalı).
5. [Critical] **AC-S3/S4 (Info disclosure — sıralama)** Given geçersiz
   JSON body VE eksik/yanlış token birlikte gönderiliyor, When
   `/baileys-webhook`'a POST yapılıyor, Then auth kontrolü JSON parse'tan
   ÖNCE çalışır ve 401 döner (400 değil) — kimliği doğrulanmamış bir
   istemciye body'nin parse edilip edilmediği bilgisi sızdırılmaz. Path
   kontrolü (404) auth'tan önce kalır (path bilgisi gizli değil).
6. [Critical] **AC-S5 (Fail-closed yapılandırma)** Given
   `BAILEYS_WEBHOOK_SECRET` env değişkeni set edilmemiş veya boş, When
   `orchestrator.py` `run()` ile başlatılıyor, Then süreç sunucuyu hiç
   başlatmadan açık bir hata loglar ve sıfır olmayan çıkış koduyla sonlanır
   (sessizce auth'suz çalışmaz).
7. [High] Given `BAILEYS_WEBHOOK_HOST` env'i set edilmemiş, When sunucu
   başlatılıyor, Then varsayılan bind adresi `127.0.0.1` olur (eski
   `0.0.0.0` davranışı kaldırılır); env set edilmişse (ör. Docker'da ayrı
   container) o değere bind edilir.
8. [Medium] Given path `/baileys-webhook` değil, When POST yapılıyor,
   Then 404 döner (mevcut davranış korunur, auth kontrolünden ETKİLENMEZ
   çünkü path kontrolü auth'tan önce çalışır).
9. [Medium] Given geçerli token VE geçersiz JSON body, When POST
   yapılıyor, Then 400 döner (mevcut davranış korunur — auth geçtikten
   sonra JSON parse hatası eskisi gibi işler).
10. [High] Given `bridge.js` başlatılırken `BAILEYS_WEBHOOK_SECRET` env'i
    set edilmemiş, When `node bridge.js` çalıştırılıyor, Then süreç açık
    bir hata loglayıp çıkar (fail-closed, orchestrator ile simetrik).
11. [Medium] Given `bridge.js` çalışırken orchestrator'dan 401 dönüyor
    (token uyuşmazlığı — örn. iki taraf farklı restart'ta farklı secret
    okudu), When `postMessage` çağrılıyor, Then konsola
    `"webhook auth failed (401), BAILEYS_WEBHOOK_SECRET uyuşmuyor"` türünde
    bir hata loglanır, mesaj düşürülür, retry YAPILMAZ, token değeri asla
    loglanmaz.

## Threat Model
Çağrıldı — STRIDE-lite uygulandı, AC-S1 (Spoofing: token yok/yanlış
ayırt edilemez), AC-S2 (Tampering/timing: sabit zamanlı karşılaştırma),
AC-S3/S4 (Info disclosure: auth sırası, JSON parse'tan önce) ve AC-S5
(fail-closed yapılandırma) kriterleri yukarıdaki Acceptance Criteria'ya
eklendi. Repudiation: mevcut `message_id` loglaması yeterli kabul
edildi, ek AC üretilmedi. Elevation: tek rol var, uygulanamaz. DoS
(Gemini kota tüketimi / rate limit): bilinçli olarak kapsam dışı
bırakıldı — bkz. Risks.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path (doğru token + geçerli JSON) | 200, boş body | payload kuyruğa alınır, sonra raw_listings'e yazılır | (sidecar tarafı) sessiz başarı | AC-1 |
| 2 | Token eksik | 401 + `{"error":"unauthorized"}` + `WWW-Authenticate: Bearer` | yok, kuyruğa alınmaz | bridge.js konsolda hata logu | AC-S1 |
| 3 | Token yanlış | 401 + aynı `{"error":"unauthorized"}` (eksikle aynı) | yok, kuyruğa alınmaz | bridge.js konsolda hata logu | AC-S1 |
| 4 | Path yanlış | 404 (auth kontrolünden önce) | yok | — | AC-8 |
| 5 | Dış bağımlılık hatası (Supabase/Gemini `handle_message` içinde) | Kapsam dışı — bu AC'ler sadece HTTP katmanını kapsıyor, mevcut `except Exception` davranışı korunur | log + `_active_ids` temizlenir | — | (mevcut davranış, değişmiyor) |
| 6 | `BAILEYS_WEBHOOK_SECRET` set edilmemiş (yanlış yapılandırma) | Süreç başlamaz, stderr'e hata, exit code ≠ 0 | sunucu hiç dinlemeye başlamaz | terminalde açık hata mesajı | AC-S5 |
| 7 | Kısmi başarı (token doğru ama JSON geçersiz) | 400 (mevcut davranış, auth'tan sonra) | yok | bridge.js konsolda hata logu | AC-9 |
| 8 | Hiçbir şey yapılamadı ama hata yok | Bu uçta yok — her dal ya 200/400/401/404 ile açıkça döner, sessiz "başarı" yolu yoktur | — | — | AC-1, AC-S1, AC-8, AC-9 |

Kısmi başarı: Token doğrulaması "hepsi ya da hiçbiri" — kısmi auth durumu
yoktur (token doğru/yanlış, ikili). JSON parse ayrı bir aşama, AC-9'da
ele alınıyor.
Hiçbir şey yapılamadı ama hata da yok: Oluşmaz — HTTP handler her istekte
açık bir durum kodu döner (200/400/401/404), sessiz "hiçbir şey
yapılmadı" dalı yok.
Boş sonuç ↔ hata ayrımı: Bu uç veri DÖNDÜRMÜYOR (fire-and-forget POST),
dolayısıyla "boş sonuç" kavramı uygulanamaz — tek ayrım 200 (kabul
edildi) / 4xx (reddedildi) arasında.

## Test Strategy
Unit: 60% — `hmac.compare_digest` kullanımı, `BAILEYS_WEBHOOK_SECRET`
env okuma/fail-closed davranışı, header parse mantığı (izole, mock
`BaseHTTPRequestHandler` ile).
Integration: 40% — rastgele bir portta gerçek `HTTPServer` açıp
200/401/404/400 yanıtlarını, auth/JSON-parse sıralamasını ve bind
adresini (`socket` ile) gerçek TCP isteğiyle doğrulama.
E2E: 0% — gerçek bir WhatsApp/Baileys bağlantısı gerekmiyor, HTTP
sözleşmesi test kapsamını karşılıyor.

## Benchmark / Başarı Ölçütü
Coverage Target: 90% (değişen auth/bind kodu), genel `orchestrator.py`
için ≥85%.
Performance Target: `hmac.compare_digest` ek gecikmesi istek başına
<1ms, ihmal edilebilir.
Diğer ölçülebilir kriterler: Manuel doğrulama (kullanıcı isterse) —
curl kontrol listesi:
```
curl -i -X POST http://127.0.0.1:8090/baileys-webhook -d '{}'              # -> 401
curl -i -X POST http://127.0.0.1:8090/baileys-webhook -H 'Authorization: Bearer yanlis' -d '{}'  # -> 401
curl -i -X POST http://127.0.0.1:8090/baileys-webhook -H 'Authorization: Bearer <DOGRU_SECRET>' -d '{"id":"t1","text":"test"}'  # -> 200
```

## Kapsam Dışı
Rate limiting, TLS/HTTPS, IP allowlist, tam OAuth/JWT sistemi, HMAC
body imzası. Bu P0 düzeltme dar tutulur: sadece shared-secret auth +
fail-closed yapılandırma + bind adresi sınırlaması. (Opus alt-ajanı
tarafından yanıtlandı)

## Etkilenen Dosyalar/Modüller (bilinen)
- `scraper/orchestrator.py` (auth kontrolü + `BAILEYS_WEBHOOK_HOST` bind)
- `scraper/sidecar/bridge.js` (`Authorization: Bearer` header ekleme +
  fail-closed env kontrolü)
- `scraper/.env` (yerel, `BAILEYS_WEBHOOK_SECRET` eklenir — commit edilmez)
- `scraper/.env.example` (henüz yok, bu görevde oluşturulur — tüm env
  değişkenlerinin placeholder'larıyla)
- `scraper/tests/test_webhook_auth.py` (yeni test dosyası, mevcut
  `scraper/tests/conftest.py` desenini takip eder)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı: git reposunun kökü proje klasörü
(`emlak-platform/`) ile aynı — `C:\Users\YUSUF ÇİNAR\OneDrive\Belgeler\Masaüstü\projelerim\emlak-platform`.
Bu görevde arama bu klasörle sınırlı tutuldu, devasa/harici bir geçmiş
riski gözlenmedi.

## Rollback Beklentisi
Auth eklemesi geriye dönük uyumsuz bir değişiklik — `bridge.js` aynı
deploy'da güncellenmezse (secret eklenmezse) tüm mesajlar 401 ile
reddedilir ve `raw_listings`'e hiçbir yeni kayıt girmez (veri kaybı yok,
sadece gecikme — mesajlar WhatsApp'ta durur, sidecar restart edilip
doğru secret verilince kuyruğa alınmaya devam eder). Bu nedenle
orchestrator.py ve bridge.js'in AYNI ANDA deploy edilmesi gerekir —
Kapsam Dışı değil, Risks'e not düşüldü.

## Risks
- Gemini kota tüketimi / rate limiting bu sürümde ele alınmıyor (bilinçli
  kapsam dışı) — token çalınırsa veya sidecar ele geçirilirse DoS riski
  hâlâ var, ayrı bir Jira issue'su açılmalı (örn. "EML-21: webhook rate
  limit"). (threat-model adım 5)
- orchestrator.py ve bridge.js aynı anda deploy edilmezse mesaj akışı
  durur (yukarıda Rollback Beklentisi'nde detaylandırıldı) — tek
  geliştiricili/yerel ortamda düşük risk, prod'a taşınırsa deploy sırası
  netleştirilmeli.

## Assumptions
- `BAILEYS_WEBHOOK_SECRET` en az 32 byte rastgele üretilecek (örn.
  `python -c "import secrets; print(secrets.token_urlsafe(32))"`) —
  kullanıcı onaylamadı, varsayım.
- Sidecar ve orchestrator şu an aynı makinede/Docker ağında çalışıyor,
  bu yüzden `BAILEYS_WEBHOOK_HOST` varsayılanı `127.0.0.1` seçildi —
  prod/VM topolojisi netleşirse bu varsayım değişebilir.

## Unknowns
- Prod ortamında sidecar ve orchestrator ayrı container/host'ta mı
  çalışacak — eğer öyleyse `127.0.0.1` varsayılanı yetersiz kalır, env
  override gerekecek (zaten tasarıma dahil edildi, ama doğrulanmadı).

## Sorular ve Cevaplar (ham kayıt)
1. Persona/saldırgan → bridge.js meşru çağıran, ağdaki herhangi bir
   istemci saldırgan (Opus alt-ajanı tarafından yanıtlandı)
2. Ana hedef → service-role ile keyfi yazım + Gemini kota tüketimi riski
   (kullanıcı mesajından/Jira AC'sinden — Opus alt-ajanı tarafından
   teyit edildi)
3. Happy path/token taşıma → `Authorization: Bearer <token>`,
   `BAILEYS_WEBHOOK_SECRET` env (Opus alt-ajanı tarafından yanıtlandı)
4. Token eksik → 401 + sabit body + `WWW-Authenticate: Bearer` (Opus
   alt-ajanı tarafından yanıtlandı)
5. Token yanlış → aynı 401/body, `hmac.compare_digest` ile sabit zamanlı
   (Opus alt-ajanı tarafından yanıtlandı)
6. Secret hiç set edilmemiş → fail-closed, süreç başlamaz (Opus
   alt-ajanı tarafından yanıtlandı)
7. Sıralama → path (404) → auth (401) → JSON parse (400) (Opus
   alt-ajanı tarafından yanıtlandı)
8. Bind adresi → `BAILEYS_WEBHOOK_HOST`, varsayılan `127.0.0.1` (Opus
   alt-ajanı tarafından yanıtlandı)
9. Kapsam dışı → rate limit/TLS/IP allowlist/OAuth/HMAC body imzası
   (Opus alt-ajanı tarafından yanıtlandı)
10. Bağımlılıklar → orchestrator.py, bridge.js, .env, .env.example, yeni
    test dosyası (Opus alt-ajanı tarafından yanıtlandı)
11. Rollback → bridge.js fail-closed, 401'de retry yok, token loglanmaz
    (Opus alt-ajanı tarafından yanıtlandı)
12. Test oranı → unit 60/integration 40/e2e 0 (Opus alt-ajanı tarafından
    yanıtlandı, kullanıcıya onaylatılmadı — bkz. Unknowns)
13. Kabul kriteri sahibi → otomatik testler + opsiyonel manuel curl
    kontrolü (Opus alt-ajanı tarafından yanıtlandı)
14. Coverage/performans hedefi → %90 / <1ms (Opus alt-ajanı tarafından
    yanıtlandı)
