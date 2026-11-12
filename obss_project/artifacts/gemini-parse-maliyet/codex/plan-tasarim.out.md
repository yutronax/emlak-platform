1. **Rol dosyasına erişilemedi.** `C:/Users/kuyus/.claude/agents/ecc-architect.md` bulunamadı. Değerlendirmeyi görev belgesi, dosya planı ve mevcut kod üzerinden mimari inceleme olarak yaptım.

2. **İç sonuç sözleşmesi eksik.** Mevcut parser hem doğrulanmış “ilan değil” sonucunda hem sağlayıcı hatasında `None` döndürüyor. Negatif önbelleğin hataları saklamaması için içeride `listing / not_listing / error` ayrımı gerekli. Dışarıdaki `dict | None` imzası korunabilir.

3. **Ortak doğrulayıcının yeri belirlenmeli.** Gemini sonucu, birleştirilmiş regex sonucu ve pozitif önbellek kaydı aynı doğrulama işlevinden geçmeli. Bunu `parser.py` içinde tutup `parse_cache.py` dosyasından parser’a import etmek döngüsel bağımlılık yaratabilir. Bağımlılık yönü planda açıklaştırılmalı.

4. **Kısmi istek önerisi AC-1 ile uyuşmuyor.** Tam şemayı yeniden ürettirmek, bilinen regex alanlarını da modelden tekrar istemek anlamına geliyor. Bilinen alanlar ile eksik/belirsiz alanların yanıt ve birleştirme sözleşmesini kesinleştirin. Regex alanları yanıttan çıkarılırsa AC-8 kapsamındaki çelişkinin nasıl gözleneceği de tanımlanmalı.

5. **Önbellek erişiminin gecikme bütçesi eksik.** `get_client()` her çağrıda yeni istemci oluşturuyor. DB okuma, yazma ve bağlantı maliyetleri p95 ≤100 ms hedefini etkiler. Önbelleğe özel timeout, istemci yaşam döngüsü ve hata sonrası fallback sınırları belirlenmeli. LRU kilidi ağ çağrısı boyunca tutulmamalı.

6. **TTL ve eşzamanlı yazma politikası eksik.** Atomik upsert yarım kaydı önler, ancak geciken bir yazma daha yeni sonucu ezebilir. `created_at/expires_at` değerlerinin hangi anda üretileceği, UTC kullanımı ve aynı anahtarın yeniden yazılmasında TTL davranışı tanımlanmalı.

7. **Temizleyicinin yaşam döngüsü eksik.** `orchestrator.run()` üzerinden süreç başına tek temizleyici başlatılması, hata sonrası devam etmesi ve bayrak kapatıldığında mevcut kayıtları temizlemeyi sürdürmesi belirtilmeli. Worker kapalıyken fiziksel silme gecikir. Bu durum belgede kabul edilen saatlik retention varsayımıyla açıkça eşleştirilmeli.

8. **Devreye alma bağımlılığı eksik.** `.env.example` dosyasına `false` eklemek optimizasyonu etkinleştirmez. Migration sonrasında gerçek dağıtım ortamında bayrağın açılması ve kapatılarak geri dönüşün doğrulanması plana eklenmeli.

9. **Kabul kanıtlarının dosya kapsamı eksik.** Etiketli benchmark verisi, karşılaştırma çalıştırıcısı, çağrı sayımı, kalite karşılaştırması ve branch coverage komutu atanmış değil. Gerçek Supabase testleri için authenticated test kimliği ve test verisi temizliği de gerekli. Mevcut regresyon testlerini çalıştırmak, sıcak önbellekle kişisel grup kontrolünü tek başına kanıtlamaz.

10. **Daha basit uygulama yolu mevcut sözleşmeyle mümkün.** Belgede başlangıçta `regex_only=0` kabul ediliyor. Bu nedenle tam ilan üreten ayrı deterministik yol kurmadan, regex’i kısmi alan çıkarımıyla sınırlamak yeterli. Mevcut Gemini çağrı/rotasyon kodunu tek yardımcıda paylaşmak da normal ayrıştırma ile çelişki fallback’inin zamanla ayrışmasını önler.