---
task_slug: faz-b-scraper-guvenilirlik-sertlestirme
jira_id: EML-66
threat_model: not-applicable
priority: high
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 90
  integration: 10
  e2e: 0
affected_modules:
  - scraper/orchestrator.py
  - scraper/parser.py
  - scraper/sidecar/bridge.js
---

# ATDD — faz-b-scraper-guvenilirlik-sertlestirme

## Jira Kaynağı
[EML-66 — Faz B: Scraper güvenilirlik sertleştirme](https://yutronax.atlassian.net/browse/EML-66)
User Story: EML-65 (Faz A) canlı doğrulamasında bulunan 3 güvenilirlik sorunu kapatılsın.

## Persona
Scraper'ı işleten geliştirici/operatör — canlıda scraper'ın gerçek WhatsApp trafiğiyle çökmeden/asılı kalmadan çalışmasını istiyor.

## Hedef (Neden)
Faz A'da (EML-65) canlı test sırasında 3 gerçek sorun bulundu: (1) bozuk encoding'li bir HTTP body orchestrator'ın webhook handler'ını except'siz çökertiyor, (2) Gemini çağrısında timeout yok — sağlayıcı 503 verdiğinde istek süresiz asılı kalabiliyor, (3) metin çıkarılamayan mesajlar sadece konsola yazılıp kayboluyor, hangi mesajın neden atlandığı sonradan incelenemiyor.

## User Story
As a scraper operatörü
I want orchestrator'ın bozuk girdilere karşı dayanıklı olmasını, Gemini çağrılarının asılı kalmamasını, ve atlanan mesajların iz bırakmasını
So that canlı ortamda sessiz çökme/asılı kalma/veri kaybı riski azalsın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given orchestrator'ın `/baileys-webhook` ucuna geçerli `Authorization` header'ıyla ama bozuk/geçersiz-UTF8 body gönderilir, When `do_POST` çalışır, Then handler çökmez, 400 döner, bağlantı düzgün kapanır.
2. [Critical] Given orchestrator'a geçerli JSON ama eksik/hatalı alan (`text` yok) gönderilir, When `do_POST` çalışır, Then 200 döner ama mesaj kuyruğa eklenmez (mevcut davranış korunur, regresyon testi).
3. [Critical] Given Gemini `generate_content` çağrısı belirlenen süreden (örn. 30s) uzun sürer/hiç cevap vermez, When `parse_listing_message` çalışır, Then çağrı timeout ile kesilir, fonksiyon `None` döner, worker thread asılı kalmaz.
4. [High] Given Gemini normal süresinde cevap verir (mevcut davranış), When `parse_listing_message` çalışır, Then timeout eklenmeden ÖNCEKİ gibi doğru parse sonucu döner (regresyon yok).
5. [High] Given bridge.js bir mesajdan metin çıkaramaz (`toWebhookPayload` null döner), When `processIncomingMessage` çalışır, Then mevcut konsol logunun YANINDA `bridge_unhandled_messages.log` dosyasına PII'siz bir satır (timestamp, mesaj ID, remoteJid'in sadece grup/DM olduğu bilgisi — ham metin/telefon numarası YOK) eklenir.
6. [Medium] Given `bridge_unhandled_messages.log` dosyası yazılamaz (örn. disk dolu, izin hatası), When loglama denenir, Then bridge'in asıl işlevi (mesaj iletimi) durmaz, sadece konsola bir uyarı düşer (mevcut `logRiskEvent`'teki pessimist-ama-engellemeyen desenle aynı).

## Threat Model
Tetikleyici yok — değerlendirilen tetikleyiciler: kimlik doğrulama/yetkilendirme (webhook auth zaten EML-20'de var, bu görev değiştirmiyor), kullanıcı girdisi (webhook body'si zaten güvensiz kabul ediliyordu, bu görev SADECE hata yönetimini sertleştiriyor, yeni bir girdi kabul etmiyor), dış API çağrısı (Gemini çağrısı zaten var, timeout eklemek saldırı yüzeyini büyütmüyor, sadece dayanıklılığı artırıyor), yeni HTTP ucu (yok) — hiçbiri uymuyor çünkü bu görev mevcut güven sınırlarını DEĞİŞTİRMİYOR, sadece var olan hata yollarını (çökme/asılı kalma) kapatıyor.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Bozuk/geçersiz-UTF8 body | HTTP 400, body `{"error": "invalid_body"}` | Bağlantı düzgün kapanır, exception loglanır (`logger.warning`, body içeriği LOGLANMAZ — PII riski) | N/A (WhatsApp tarafı, cevap görmüyor) | AC-1 |
| 2 | Geçerli JSON, eksik alan | HTTP 200, `{}` | Mesaj kuyruğa eklenmez | N/A | AC-2 |
| 3 | Gemini timeout (30s aşıldı) | `parse_listing_message` → `None` | `logger.warning` ile "Gemini timeout" logu, worker thread serbest kalır | N/A (iç fonksiyon) | AC-3 |
| 4 | Gemini normal cevap | Mevcut davranış (parsed dict veya None) | Yok | N/A | AC-4 |
| 5 | Metin çıkarılamayan mesaj | `undefined` (processIncomingMessage void) | Konsol logu + `bridge_unhandled_messages.log`'a 1 satır (PII'siz: `{timestamp, messageId, jidType: "group"|"dm"}`) | N/A | AC-5 |
| 6 | Log dosyası yazılamıyor | `undefined` (processIncomingMessage void) | Konsola `[LOG-YAZMA HATASI]` uyarısı, mesaj iletimi/filtreleme AKIŞI durmaz | N/A | AC-6 |

Kısmi başarı: Bu görevde "kısmi başarı" senaryosu yok — her AC kendi başına tam bağımsız (encoding fix, timeout, log yazımı birbirine bağımlı değil).
Hiçbir şey yapılamadı ama hata da yok: AC-6'da log yazılamazsa "hiçbir şey yapılamadı" durumu var ama bu BİLEREK sessiz/engellemeyen tasarlanmış (ikincil bir gözlem aracı, ana işlevi durdurmamalı) — bu nedenle konsol uyarısı ZORUNLU tutuldu, tamamen sessiz değil.
Boş sonuç ↔ hata ayrımı: AC-3/AC-4'te `None` dönüşü hem "ilan değil" hem "timeout" hem de "parse hatası" için ortak — bu mevcut `parse_listing_message` sözleşmesinin zaten böyle olması (orchestrator.py zaten bunu "ilan değil veya parse edilemedi" olarak tek bir log satırına indiriyor), bu görev bu ayrımı DEĞİŞTİRMİYOR, sadece timeout'u da aynı `None` yoluna ekliyor.

## Test Strategy
Unit: 90% — `do_POST`'un encoding-hata dalı (gerçek bozuk byte'larla), `parse_listing_message`'ın timeout dalı (mock'lanmış yavaş/asılı `generate_content`), `processIncomingMessage`'ın log-yazma dalı (geçici dosya, mock fs hatası).
Integration: 10% — mevcut `test_orchestrator_dedup.py` desenine uyan, webhook→orchestrator tam akış regresyon testi (zaten var, bozulmadığını doğrula).
E2E: 0% — Faz A'da zaten canlı olarak elle doğrulandı, otomatik e2e kapsamı bu görevde yok.

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Diğer ölçülebilir kriterler: 6 AC'nin hepsi doğrudan bir testle tetiklenmeli (vekil değil — ör. timeout testi gerçekten yavaş bir mock kullanmalı, "None döner" assertion'ı tek başına yeterli değil, timeout mekanizmasının GERÇEKTEN devreye girdiği kanıtlanmalı, örn. `assert elapsed_time < 35`).

## Kapsam Dışı
- Reconnect disiplini (statusCode=440 için) — zaten mevcut kodda var (EML-65'in notunda "zaten özel kod var" denildi), bu görevde dokunulmuyor.
- Risk event log'u (`risk_events.log`, maviLojistik'teki tam özellik) — Faz C'ye bırakıldı, bu görevde sadece `bridge_unhandled_messages.log` ekleniyor.
- Retry/getMessage desteği — Faz C.
- Grup adı zenginleştirme — Faz C.
- Gemini timeout değerinin KESİN sayısı (30s) bir varsayım — gerekirse sonradan ayarlanabilir bir config/env değişkeni YAPILMIYOR bu görevde (kapsam küçük tutuluyor), sabit kodlanıyor.

## Etkilenen Dosyalar/Modüller (bilinen)
- scraper/orchestrator.py (değiştir — do_POST'a try/except)
- scraper/parser.py (değiştir — generate_content çağrısına timeout)
- scraper/sidecar/bridge.js (değiştir — processIncomingMessage'a dosya loglama)
- Yeni testler: scraper/tests/test_orchestrator_webhook_encoding.py, scraper/tests/test_parser_timeout.py, scraper/sidecar/bridge.unhandled-log.test.js

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı) — arama scraper/ alt dizinine sınırlanacak.

## Rollback Beklentisi
Davranış değişikliği geriye dönük uyumlu (sadece yeni hata-yönetimi ekleniyor, mevcut başarı yolları değişmiyor) — bir sorun çıkarsa sadece bu 3 dosyadaki değişiklikler geri alınır, veri kaybı riski yok.

## Risks
- Gemini'nin `google.genai` Python SDK'sının `generate_content` çağrısına senkron bir timeout parametresi native olarak destekleniyor mu, yoksa `concurrent.futures`/`signal` ile sarmalamak mı gerekiyor — plan adımında SDK'nın gerçek API'si kontrol edilmeli (bir önceki postmortem'in "runtime seçeneğinin gerçekten desteklendiğini doğrula" kuralı burada tam uygulanıyor — "destekleniyor" varsayımı YAPILMAYACAK, kod/SDK dokümantasyonu okunacak).
- `bridge_unhandled_messages.log`'un büyüme/rotasyon sınırı bu görevde ele alınmıyor (maviLojistik'te de yoktu) — ileride bir hijyen görevi olabilir, backlog'a not düşülecek.

## Assumptions
- Gemini timeout değeri 30 saniye olarak varsayıldı (kod okunarak değil, makul bir varsayım — WhatsApp mesaj işleme gecikmesi için kabul edilebilir üst sınır); kullanıcı/customer farklı bir değer isterse plan adımında değiştirilebilir.
- `bridge_unhandled_messages.log`'un konumu `scraper/sidecar/` altında (maviLojistik'teki `__dirname` deseniyle aynı).

## Unknowns
- `google.genai` SDK'sının timeout mekanizması (plan adımında netleştirilecek — Risks'te belirtildi).

## Sorular ve Cevaplar (ham kayıt)
1. Pipeline ölçeği? → Tam ATDD (kullanıcı mesajından, net).
2. Kapsam (3 madde)? → orchestrator.py encoding fix + parser.py timeout + bridge.js unhandled log (kullanıcı mesajından).
3. Reconnect disiplini kapsamda mı? → Hayır, zaten mevcut (kullanıcı mesajından: "zaten özel kod var").
4. Timeout değeri? → Varsayım: 30s (kod okunarak doğrulanmadı, plan'da netleşebilir).
5. Log formatı PII içerir mi? → Hayır, PII'siz olmalı (proje genelindeki mevcut desen — bridge.js'teki yorum: "PII'siz sabit şablon log").
6. Threat-model tetikleyici var mı? → Yok, gerekçe yukarıda (mevcut güven sınırları değişmiyor).
7. Test stratejisi oranı? → 90/10/0 (bu görev saf hata-yönetimi/dayanıklılık, e2e zaten Faz A'da elle yapıldı).
8. Rollback beklentisi? → Geriye uyumlu, risk düşük (görevin doğasından).
