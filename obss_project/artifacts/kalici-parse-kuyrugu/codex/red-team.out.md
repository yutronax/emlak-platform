{
  "task": "kalici-parse-kuyrugu",
  "reviewed_at": "2026-11-13T13:31:07Z",
  "summary": "GeminiUnavailable için kalıcı kuyruk, backoff ve başlangıç kurtarması uygulanmış; ancak veritabanı hataları hâlâ başarı sayılarak mesajların silinmesine yol açıyor. Sınırsız executor birikmesi, processing kayıtlarının takılması ve gizlilik sözleşmesindeki eksikler giderilmeden değişiklik hazır değil.",
  "findings": [
    {
      "severity": "high",
      "category": "reliability",
      "file": "scraper/orchestrator.py:114",
      "issue": "handle_message genel exception bloğunda get_client, fingerprint_exists ve insert_raw_listing hatalarını yutup None döndürüyor. Kişisel yolda yazma hatası personal_write_error, seçim sorgusu hatası personal_selection_check_error olarak dönüyor. process_entry bu sonuçların hepsinde complete çağırarak henüz kaydedilmemiş mesajı siliyor.",
      "better_approach": "Geçici ve beklenmeyen işleme hatalarını process_entry katmanına ilet; yalnız doğrulanmış nihai sonuçlarda complete çağır. Seçim sorgusu hatasında Gemini çağırmadan kaydı yeniden denemeye bırak.",
      "reason": "Webhook zaten 200 döndürmüş olduğundan gönderen yeniden denemeyebilir. Davranış tablosu beklenmeyen exception satırını handle_message dışıyla sınırlasa da bu davranış genel sessiz kayıp yok hedefiyle çelişiyor. personal_write_error da aynı kayıp mekanizmasına sahip."
    },
    {
      "severity": "high",
      "category": "performance",
      "file": "scraper/orchestrator.py:221",
      "issue": "dispatch_due her çağrıda MAX_WORKERS yeni kayıt alıyor; çalışan ve executor içinde bekleyen işleri hesaba katmıyor. Arka plan döngüsü kuyruk boşalana kadar uyumadığı için bütün backlog processing durumuna geçirilip bellekte biriktirilebiliyor.",
      "better_approach": "Tamamlanmamış Future sayısını sınırla; yalnız boş worker kapasitesi kadar claim yap ve kapasite yokken tamamlanma bekle.",
      "reason": "MAX_WORKERS yalnız çalışan thread sayısını sınırlar. Büyük backlog bellek tüketimini, kuyruk gecikmesini ve SQLite kilit rekabetini artırır; bellek tükenmesi ve tekrar tekrar yeniden başlama döngüsü oluşturabilir. Çökmede kayıtlar SQLite'ta kalır, ancak bu durum ilerlemeyi güvenilir kılmaz."
    },
    {
      "severity": "medium",
      "category": "reliability",
      "file": "scraper/orchestrator.py:198",
      "issue": "complete veya retry_later başarısız olduğunda kayıt processing durumunda bırakılıyor; çalışan süreçte bu kayıtları tekrar ele alan mekanizma yok. Claim sonrasında executor.submit hata verirse gönderilmemiş kayıtlar da aynı durumda kalıyor.",
      "better_approach": "Başarısız durum güncellemelerini yeniden dene ve submit edilemeyen kayıtları geri bırak. Süreç içinde kurtarma gerekiyorsa aktif işleri ayırt eden süreli sahiplenme kullan.",
      "reason": "Geçici SQLite kilidi veya disk arızası giderilse bile ilgili kayıt ancak süreç yeniden başlatılırsa ilerler. Ham mesajın saklanması da bu sırada süresiz uzayabilir."
    },
    {
      "severity": "medium",
      "category": "reliability",
      "file": "scraper/durable_queue.py:128",
      "issue": "recover_processing bütün processing kayıtlarını koşulsuz pending yapıyor. Aynı dosyayı kullanan ikinci süreç başlarsa ilk süreçte hâlen çalışan kayıtlar yeniden claim edilebilir. run kurtarmayı HTTP portuna bind işleminden önce yaptığı için ikinci süreç sonradan port hatası alsa bile bu yarışı başlatabilir.",
      "better_approach": "Tek süreç kullanımını kurtarmadan önce süreçler arası kilitle garanti et veya sahiplik ve süre bilgisiyle yalnız terk edilmiş claim'leri kurtar.",
      "reason": "BEGIN IMMEDIATE ile claim işlemi atomik; sorun canlı claim'lerin başlangıç kurtarmasıyla geçersizleştirilmesi. Veritabanı unique index'leri çift insert'i sınırlasa da aynı mesaj eşzamanlı parse edilebilir."
    },
    {
      "severity": "high",
      "category": "security",
      "file": "scraper/orchestrator.py:194",
      "issue": "Genel ve kişisel yazma hatalarında logger.exception exception metnini ve traceback'i logluyor. Supabase/PostgREST hata ayrıntıları raw_text, telefon veya JID içerebilir; içerik loglanmaz açıklaması bunu engellemiyor.",
      "better_approach": "Bu bloklarda yalnız sabit olay kodu ve güvenli hata sınıfı logla; exception metnini ve sağlayıcı ayrıntılarını çıkar.",
      "reason": "AC-S2 normal akış kadar hata akışını da kapsıyor. Mevcut log testleri gerçek işleme ve insert hatalarının hassas exception içeriklerini sınamıyor."
    },
    {
      "severity": "medium",
      "category": "security",
      "file": "scraper/durable_queue.py:95",
      "issue": "complete ve purge_failed yalnız SQL DELETE uyguluyor. secure_delete ve WAL kalıntıları için politika bulunmadığından mantıksal olarak silinen ham mesajın SQLite boş sayfalarında veya WAL dosyasında kalmaması garanti edilmiyor.",
      "better_approach": "AC-S3'ün fiziksel veri kalıntılarını kapsayıp kapsamadığını netleştir; kapsıyorsa secure_delete, güvenli WAL checkpoint yaşam döngüsü ve erişim izinlerini birlikte uygula ve doğrula.",
      "reason": "SQL sorgusunda görünmemek, ham metnin yerel dosyalardan kaldırılmasıyla aynı garanti değildir. Başarılı sonuçta ham metin yerelde kalmaz iddiası mevcut uygulamadan daha güçlü."
    },
    {
      "severity": "medium",
      "category": "security",
      "file": "scraper/durable_queue.py:38",
      "issue": "PARSE_QUEUE_PATH doğrudan kabul ediliyor. Göreli bir yol proje çalışma dizinine, mutlak bir yol OneDrive veya repo içine yazılabiliyor.",
      "better_approach": "Yolu mutlak ve normalize edilmiş biçime getir; repo ve OneDrive altına çözülen yolları başlangıçta açık hatayla reddet.",
      "reason": "Varsayılan yol uygun olsa da AC-S1 dosyanın repo ve OneDrive dışında olmasını istiyor. .env.example uyarısı bu koşulu uygulamıyor; testler de override için bu sınırı kontrol etmiyor."
    },
    {
      "severity": "medium",
      "category": "test-gap",
      "file": "scraper/tests/test_orchestrator_inbox.py",
      "issue": "Beklenmeyen hata testi handle_message fonksiyonunun tamamını exception fırlatacak şekilde mock'luyor; gerçek fonksiyonun DB hatalarını yuttuğunu yakalayamıyor. Dispatch testleri tek çağrıdaki batch boyutunu doğruluyor, toplam bekleyen iş sınırını doğrulamıyor.",
      "better_approach": "Gerçek handle_message üzerinden fingerprint, insert, kişisel yazma ve seçim sorgusu hatalarını enjekte et. Bloklanan executor ile ardışık dispatch, submit reddi, durum güncelleme hatası ve ikinci süreç kurtarma senaryolarını sınayan testler ekle.",
      "reason": "Mevcut testler kritik hata sınırlarını atladığından yeşil sonuç alınması sessiz kayıp ve kapasite sorunlarını dışlamaz."
    }
  ],
  "strengths": [
    "claim_due tek bağlantı kilidi ve BEGIN IMMEDIATE transaction içinde seçim ile durum güncellemesini yapıyor; normal claim yarışında aynı kayıt iki worker'a verilmez.",
    "Webhook kalıcı enqueue tamamlandıktan sonra 200, enqueue hatasında içeriksiz 503 queue_unavailable döndürüyor.",
    "Backoff, beşinci başarısızlıkta failed durumu, saatlik temizlik ve HTTP sunucusundan önce başlangıç kurtarması uygulanmış.",
    "GeminiUnavailable ortak ve kişisel yoldan iletiliyor; parser varsayılan çağrıda None davranışını koruyor ve hata sonucunu önbelleğe yazmıyor.",
    "Yeni bağımlılık veya Supabase migration eklenmemiş; SQLite testleri gerçek dosya ve eşzamanlı claim kullanıyor."
  ],
  "risks": [
    "Complete sonrasında aynı id yeniden kabul edilir; AC-2 yalnız kuyruktaki kayıtları kapsadığı için bu tek başına sözleşme ihlali değildir. Kalıcı ilan kayıtlarında fingerprint yanında source/source_message_id unique index'i de koruma sağlar; kişisel RPC mesaj id'sini agent ile adlandırır. Bu garanti incelenen migration'ların canlıda uygulanmasına bağlıdır; yeniden parse maliyetini ve daha önce ilan değil sayılmış mesajların tekrar işlenmesini engellemez.",
    "run dışında inbox None kalırsa geçerli metinli do_POST isteği 503 queue_unavailable alır. dispatch_due doğrudan AttributeError verir; arka plan döngüsü bunu yakalayıp her saniye uyarı vererek hiçbir iş yapmadan devam eder. Alternatif giriş noktası kuyruğu açıkça kurmalıdır.",
    "claim_due için status/next_attempt_at indeksi yok; büyüyen pending ve yedi günlük failed birikimi her taramada sorgu ve sıralama maliyetini artırır.",
    "Failed kayıtlar saatlik temizlendiğinden yedi günlük sınır yaklaşık bir saat aşılabilir; servis kapalıysa temizlik yeniden çalışmaya kadar ertelenir.",
    "İnceleme yalnız okumayla yapıldı; dosya oluşturan testler çalıştırılmadı. tests_passed=false doğrulanmış bir test başarısızlığını değil, çalıştırma kanıtı bulunmadığını belirtir."
  ],
  "caveman_review": {
    "complexity": "low",
    "unnecessary_files": 0,
    "unnecessary_helpers": 0,
    "unnecessary_abstractions": 0
  },
  "scope_review": {
    "matches_atdd": true,
    "scope_expansion": false
  },
  "ready_to_commit": {
    "atdd_satisfied": false,
    "tests_passed": false,
    "no_critical_findings": true,
    "scope_respected": true,
    "caveman_satisfied": true,
    "security_acceptable": false,
    "maintainability_acceptable": true,
    "no_blocking_risks": false
  },
  "verdict": "block"
}