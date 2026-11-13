Bağımsız kod incelemecisisin. Kod yazma/düzenleme, dosya yazma; SADECE incele.
Proje kökü: C:\Users\kuyus\OneDrive\Belgeler\Masaüstü\projelerim\emlak-platform
Oku: obss_project\artifacts\kalici-parse-kuyrugu\atdd.md (sözleşme), scraper\durable_queue.py (yeni), scraper\orchestrator.py, scraper\parser.py (GeminiUnavailable, _generate, parse_listing_message), testler: scraper\tests\test_durable_queue.py, test_orchestrator_inbox.py, test_parser_unavailable.py. `git diff main -- scraper/` ile değişikliği görebilirsin.

Amaç: canlıda Gemini 503/504 yüzünden kaybolan WhatsApp ilan mesajlarını kalıcı SQLite kuyruğuyla kaybetmemek.

İnceleme alanları: security (ham mesaj ve kişisel veri saklama, log içeriği, dosya yolu), correctness (her AC kodda gerçekten var mı), reliability (Davranış Sözleşmesi'nin her satırı; sessiz kayıp var mı; çökme/yeniden başlatma; eşzamanlılık: aynı kayıt iki kez işlenebilir mi; sqlite kilitleme/WAL, tek bağlantı + kilit doğru mu; claim_due atomik mi), performance, maintainability, CAVEMAN (gereksiz karmaşıklık), scope.

Özellikle değerlendir (implementasyonu yapan ajanın kendi bildirdiği riskler):
1. handle_message içindeki genel `except Exception` Supabase insert/fingerprint gibi geçici veritabanı hatalarını yutup None döndürüyor; process_entry bunu başarı sayıp kaydı siliyor → mesaj kaybı. Bu sözleşmenin "sessiz kayıp yok" hedefiyle çelişiyor mu? Kişisel yoldaki `personal_write_error` da aynı mı?
2. dispatch_due her döngüde MAX_WORKERS kadar kayıt claim ediyor ama executor'daki bekleyen iş sayısına bakmıyor; döngü yalnız 0 dönünce uyuyor → çok sayıda kayıt "processing" olup executor iç kuyruğunda birikebilir. Gerçek bir risk mi, sonucu ne?
3. Aynı mesaj id'si, kayıt silindikten sonra (complete) tekrar gelirse yeniden işlenir — fingerprint dedup bunu karşılıyor mu?
4. run() dışında inbox None kalırsa (ör. modül farklı giriş noktasıyla kullanılırsa) do_POST/dispatch ne yapar?


## Tur 2
Önceki inceleme: obss_project\artifacts\kalici-parse-kuyrugu\red_team.round1.json (block, 8 bulgu). Sonrasında atdd.md sonuna AC-10..AC-13 ve AC-S5..AC-S7 eklendi ve uygulandı; 6 eski test eski "hatayı yut" davranışından yeni "RetryableError, kayıt silinmez" davranışına çevrildi. Tüm scraper suite 469 passed (3 koşu).
Her önceki bulgu (1-8) için "kapandı / açık / yanlış pozitif" kararını summary'de ya da findings'te açıkça yaz. Düzeltmelerin yarattığı yeni sorunları ara: kapasite sayacının sızması ya da çift azaltılması (WeakKeyDictionary, kuyruk başına sayaç), release/complete yarışları, RetryableError'ın kalıcı hataları da 5 kez denemesi (ör. şema/kısıt hataları) kabul edilebilir mi, yol kontrolünün yanlış pozitif/negatifleri (normcase, sembolik bağ, UNC), secure_delete + WAL checkpoint'in gerçekten kalıntıyı temizleyip temizlemediği, run() bind→recover sırası.
Yanıtın SADECE şu JSON olsun, başka metin yok:
{"task":"kalici-parse-kuyrugu","reviewed_at":"<ISO>","summary":"<1-3 cümle>","findings":[{"severity":"critical|high|medium|low","category":"security|correctness|architecture|maintainability|performance|reliability|readability|test-gap|caveman|scope|risk","file":"...","issue":"...","better_approach":"...","reason":"..."}],"strengths":[],"risks":[],"caveman_review":{"complexity":"low|medium|high","unnecessary_files":0,"unnecessary_helpers":0,"unnecessary_abstractions":0},"scope_review":{"matches_atdd":true,"scope_expansion":false},"ready_to_commit":{"atdd_satisfied":true,"tests_passed":true,"no_critical_findings":true,"scope_respected":true,"caveman_satisfied":true,"security_acceptable":true,"maintainability_acceptable":true,"no_blocking_risks":true},"verdict":"approve|approve-with-changes|block"}
severity ve category yalnız listedeki tek kelime.
