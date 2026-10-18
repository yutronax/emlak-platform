# Plan — eml-20-scraper-webhook-auth
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — scraper/orchestrator.py
ve scraper/sidecar/bridge.js, hiçbir .tsx/.jsx/.vue/.css/sayfa bileşeni yok,
Görsel/UI kriteri atdd.md'de boş).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| scraper/orchestrator.py | `WebhookHandler.do_POST`'a auth kontrolü (AC-S1/S3/S4) ekle, `run()`'a fail-closed secret kontrolü (AC-S5) ve `BAILEYS_WEBHOOK_HOST` env okuma (AC-7) ekle | medium | backend |
| scraper/sidecar/bridge.js | `postMessage`'daki `fetch` çağrısına `Authorization: Bearer` header'ı ekle (AC-1), başlangıçta `BAILEYS_WEBHOOK_SECRET` yoksa fail-closed çık (AC-10), 401 yanıtını logla/retry yapma (AC-11) | low | backend (Node tarafı scraper altyapısı, UI değil) |
| scraper/.env | `BAILEYS_WEBHOOK_SECRET` ve `BAILEYS_WEBHOOK_HOST` ekle (yerel, commit edilmez) | low | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| scraper/.env.example | Tüm env değişkenlerinin placeholder'ları (şu an hiç yok) — `BAILEYS_WEBHOOK_SECRET`/`BAILEYS_WEBHOOK_HOST` dahil | backend |
| scraper/tests/test_webhook_auth.py | AC-1, AC-S1..S5, AC-7, AC-8, AC-9 için unit+integration testler (`scraper/tests/test_verify_supabase.py`'deki unit/integration ayrımı deseni takip edilir, `conftest.py`'deki `integration` marker'ı kullanılır) | backend |

## Dependencies
- `orchestrator.py` zaten `os.getenv(...)` deseniyle `BAILEYS_WEBHOOK_PORT`,
  `QUALITY_GATE_THRESHOLD` okuyor — yeni `BAILEYS_WEBHOOK_SECRET`/
  `BAILEYS_WEBHOOK_HOST` aynı desenle okunmalı.
  `logging.getLogger("scraper.orchestrator")` zaten var, fail-closed hata
  mesajı bu logger ile basılmalı (yeni bir logger açma).
- `WebhookHandler.do_POST` mevcut akışı: path kontrolü (404) → body okuma →
  JSON parse (400) → `_active_ids` dedup → kuyruğa koy → 200. Auth kontrolü
  path kontrolünden SONRA, JSON parse'tan ÖNCE eklenir (AC-S3/S4 sıralaması).
- `bridge.js`'teki `postMessage` fonksiyonu tek POST noktası — header ekleme
  ve 401 loglama sadece burada yapılır, `toWebhookPayload`/`bridge()` dokunulmaz.
- `scraper/tests/conftest.py`'nin `sys.path.insert(0, SCRAPER_DIR)` mekanizması
  sayesinde yeni test dosyası `from orchestrator import ...` ile doğrudan
  import edebilir — `scripts.verify_supabase` deseninden farklı, çünkü
  `orchestrator.py` `scraper/` kökünde (`scripts/` altında değil).
- `hmac` ve `secrets` stdlib modülleri — yeni bağımlılık yok.

## Migration Required?
No — hiçbir DB şema/veri değişikliği yok, sadece HTTP katmanı (auth header)
ve process ortam değişkenleri değişiyor. `raw_listings` tablosuna dokunulmuyor.

## Risks
(atdd.md'den taşındı, bu adımda yeni risk bulunmadı)
- Gemini kota tüketimi / rate limiting bu sürümde ele alınmıyor (bilinçli
  kapsam dışı, ayrı Jira issue'su açılmalı).
- `orchestrator.py` ve `bridge.js` aynı anda deploy edilmezse mesaj akışı
  durur (401 ile reddedilir, veri kaybı yok, sadece gecikme).

## Open Questions
Yok. atdd.md'nin Unknowns bölümündeki tek madde ("Prod ortamında sidecar ve
orchestrator ayrı container/host'ta mı çalışacak") tasarıma zaten
yansıtıldı: `BAILEYS_WEBHOOK_HOST` env override edilebilir olduğu için bu
soru kod keşfiyle çözüldü — prod topolojisi netleşmeden de güvenli
varsayılan (`127.0.0.1`) ile ilerlenebilir, ek bir kullanıcı kararı
gerektirmiyor.
