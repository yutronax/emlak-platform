---
task_slug: kalici-parse-kuyrugu
priority: high
threat_model: inline (AC-S)
jira_id: null
affected_modules: [scraper/durable_queue.py (yeni), scraper/orchestrator.py, scraper/parser.py]
---

# Kalıcı parse kuyruğu

## Neden
2026-11-13 canlı çalıştırmada iki ilan mesajı Gemini 504/503 yüzünden kayboldu. `3213fd5` ile anlık 3 deneme eklendi; ama denemeler tükenirse ya da worker kapanırsa mesaj hâlâ kaybolur (kuyruk bellekte, `queue.Queue`). Hedef: hiçbir mesaj geçici bir Gemini/worker arızası yüzünden kaybolmasın.

## Kararlar
- Depo: stdlib `sqlite3`, tek dosya. Yol `PARSE_QUEUE_PATH` env'i; yoksa `%LOCALAPPDATA%/emlak-platform/parse-queue.sqlite3` (LOCALAPPDATA yoksa `~/.emlak-platform/parse-queue.sqlite3`). Klasör yoksa oluşturulur. OneDrive/repo içine yazılmaz.
- Yeni bağımlılık yok, Supabase migration yok.

## Acceptance Criteria
1. **AC-1** Webhook geçerli bir payload aldığında (auth, loopback, metin kontrolleri değişmeden geçtikten sonra) payload kuyruğa YAZILIR, sonra 200 döner. Yazma başarısızsa 503 döner (`{"error":"queue_unavailable"}`), böylece gönderen tekrar dener; içerik loglanmaz.
2. **AC-2** Aynı `id`'li mesaj kuyrukta zaten varsa (bekliyor/işleniyor/başarısız) ikinci kez eklenmez; yine 200 döner. `id`'siz payload'a benzersiz bir anahtar üretilir. (Bellekteki `_active_ids` setinin yerini alır.)
3. **AC-3** Arka plan döngüsü, zamanı gelmiş (`next_attempt_at <= now`, durum `pending`) kayıtları en fazla `MAX_WORKERS` kadar alır, durumlarını atomik olarak `processing` yapar ve thread pool'da işler. Kuyruk boşsa kısa aralıkla (≤1 sn) yeniden bakar; CPU'yu meşgul döngüyle yakmaz.
4. **AC-4** İşleme sonucu ilan, ilan değil, mükerrer, kişisel yol sonuçları, kalıcı parse hatası (geçersiz JSON, şema, 400/403 vb.) ise kayıt kuyruktan **silinir** (ham metin yerelde kalmaz).
5. **AC-5** Gemini geçici olarak ulaşılamazsa (anlık 3 deneme tükendi, ya da tüm anahtarlar 429) kayıt silinmez: `attempts += 1`, durum `pending`, `next_attempt_at = now + BACKOFF_S[attempts-1]`, `BACKOFF_S = (60, 300, 900, 3600)`. `attempts` 5'e ulaşınca (ilk deneme + 4 tekrar) durum `failed`, `failed_at = now`; içeriksiz log `queue_failed`.
6. **AC-6** `parser.parse_listing_message(raw_text, key_manager, *, raise_unavailable=False)`: varsayılan davranış BİREBİR aynı (None döner). `raise_unavailable=True` iken geçici ulaşılamama durumunda `parser.GeminiUnavailable` fırlatır. Kalıcı hatalar ve "ilan değil" yine None. Hata sonucu hiçbir önbelleğe yazılmaz (mevcut kural). Orchestrator `raise_unavailable=True` ile çağırır; kişisel yolda da `GeminiUnavailable` sayaç/yutma bloklarından ÖNCE yukarı iletilir.
7. **AC-7** Worker başlarken `processing` durumunda kalmış kayıtlar (önceki çökme) `pending`'e döner ve yeniden işlenir. `run()` bu kurtarmayı HTTP sunucusundan önce yapar.
8. **AC-8** `failed` kayıtlar 7 gün sonra silinir (mevcut saatlik temizlik döngüsüne eklenir).
9. **AC-9** Kuyruk thread-safe'tir (tek bağlantı + kilit ya da bağlantı başına işlem; WAL modu). Aynı kaydı iki worker aynı anda alamaz.

## Güvenlik / gizlilik (AC-S)
- **AC-S1** Kuyruk dosyası repo ve OneDrive dışında; `.gitignore` gerekmez ama yol koddan repo içine düşmemeli.
- **AC-S2** Loglar içeriksiz: mesaj metni, telefon, grup/kişi JID'i loglanmaz; yalnız sayılar ve durum (`queue_enqueued`, `queue_retry attempts=<n>`, `queue_failed`, `queue_recovered count=<n>`).
- **AC-S3** Ham metin yalnız işlenene kadar tutulur; başarılı/kalıcı sonuçta silinir, `failed` en fazla 7 gün.
- **AC-S4** Kişisel yol (agentId) loopback kontrolü ve grup seçimi kontrolü değişmez; seçim kontrolü her denemede yeniden yapılır (kuyrukta beklerken seçimi kaldırılan grup parse edilmez).

## Davranış Sözleşmesi
| Durum | Webhook yanıtı | Kuyruk | Not |
|---|---|---|---|
| Yeni geçerli mesaj | 200 | pending eklenir | |
| Aynı id tekrar | 200 | değişmez | |
| Kuyruğa yazma hatası | 503 queue_unavailable | — | gönderen tekrar dener |
| İşlendi (her nihai sonuç) | — | silinir | |
| GeminiUnavailable, attempts<5 | — | pending, backoff | |
| GeminiUnavailable, attempts=5 | — | failed | 7 gün sonra silinir |
| Worker çöktü, yeniden başladı | — | processing→pending | |
| Beklenmeyen exception (handle_message dışında) | — | silinmez, retry gibi ele alınır | sessiz kayıp yok |

## Test stratejisi
Birim: `durable_queue` (geçici dosyada gerçek sqlite), parser `raise_unavailable`, orchestrator webhook + işleme döngüsü (mock'lanmış parse/Supabase). Mevcut webhook/dedup testleri yeni kuyruğa uyarlanır; `message_queue`/`_active_ids` kaldırılır.

## Red-team tur 1 sonrası eklenen kriterler (Codex `block`, 2026-11-13)
- **AC-10 (bulgu 1)** Altyapı hataları kayıp sayılmaz: ortak yolda `get_client`, `fingerprint_exists`, `insert_raw_listing`; kişisel yolda `is_group_selected` ve `ingest_personal_listing` exception'ları handle_message'dan `orchestrator.RetryableError` olarak yukarı iletilir (Gemini çağrılmadan önce olan seçim kontrolü hatasında Gemini'ye GİDİLMEZ). process_entry bunu GeminiUnavailable gibi `retry_later` ile ele alır. İlgili sayaçlar (personal_selection_check_error, personal_write_error) yine artar, ama kayıt silinmez. Nihai sonuçlar (yazıldı, mükerrer, ilan değil, seçili değil, bağlı değil, kalıcı parse hatası) `complete`.
- **AC-11 (bulgu 2)** Eşzamanlı işlenen kayıt sayısı MAX_WORKERS'ı aşmaz: dispatch_due yalnız boş kapasite kadar (`MAX_WORKERS - in_flight`) claim eder; kapasite yoksa claim etmez. process_entry bitince (finally) kapasite geri verilir.
- **AC-12 (bulgu 3)** `executor.submit` hata verirse claim edilen ama gönderilemeyen kayıtlar `DurableQueue.release(row_id)` ile attempts artmadan `pending`'e döner. complete/retry_later hatası içeriksiz loglanır; kayıt yeniden başlatmada recover ile döner (kabul edilen sınır).
- **AC-13 (bulgu 4)** run() sırası: HTTPServer bind → `recover_processing()` → serve_forever. İkinci süreç port alamazsa kurtarma yapmadan çıkar. (AC-7'nin "sunucudan önce" ifadesi "bind'den sonra, serve_forever'dan önce" olarak güncellendi.)
- **AC-S5 (bulgu 5)** orchestrator'da hiçbir hata dalı exception metni ya da traceback loglamaz (`logger.exception` yok); yalnız sabit olay kodu + `type(exc).__name__`.
- **AC-S6 (bulgu 6)** Kuyruk bağlantısında `PRAGMA secure_delete=ON`; saatlik temizlikte `PRAGMA wal_checkpoint(TRUNCATE)`.
- **AC-S7 (bulgu 7)** Kuyruk yolu `os.path.abspath` ile normalize edilir; repo kökü ya da OneDrive (env `OneDrive`, `OneDriveConsumer`, `OneDriveCommercial`) altına düşüyorsa DurableQueue oluşturulurken `ValueError` — sessizce yazılmaz.

## Red-team tur 2 sonrası (Codex `block`, 6/8 kapandı)
- **AC-14 (bulgu 1)** Kişisel yolda parse_listing_message'tan gelen GeminiUnavailable DIŞINDAKİ her exception da `personal_parse_error` sayacını artırır ve `RetryableError` olarak iletilir (kayıt silinmez). parse_listing_message kalıcı hatalarda zaten None döndüğü için buraya düşen exception beklenmeyen/geçicidir.
- **AC-S7b (bulgu 2)** Yol kontrolü fiziksel çözümleme ile yapılır: hedefin (henüz yoksa en yakın mevcut üst dizinin) ve yasak köklerin `os.path.realpath`'i karşılaştırılır; junction/sembolik bağ üzerinden repo ya da OneDrive'a giden yol reddedilir.
- **AC-S6b (bulgu 3)** Fiziksel kalıntı süresi: ham mesaj, kaydın silindiği işlemden sonra WAL'da kalmaz. `complete()` ve `purge_failed()` silme sonrasında aynı kilit altında `wal_checkpoint(TRUNCATE)` çalıştırır; sonuç satırının busy değeri 0 değilse içeriksiz `queue_checkpoint_busy` uyarısı loglanır ve bir sonraki silmede/saatlik temizlikte yeniden denenir. `checkpoint()` da busy'yi kontrol edip bool döner (True = tam temizlendi).
