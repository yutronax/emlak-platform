1. **Persona: platform sahibi/operatör; emlakçının mevcut akışı korunur.** — Değişikliğin amacı aynı ilan kalitesini daha az Gemini çağrısıyla sağlamaktır.

2. **(c) Bellek LRU + Supabase kalıcı önbellek; ham mesaj saklanmaz.** — LRU hızlı tekrarları, Supabase yeniden başlatmalar ve süreçler arasındaki tekrarları karşılar; `parsed.description` da kişisel veri içerebileceğinden kalıcı kayıtta erişim ve süre sınırı uygulanmalıdır.

3. **Unicode NFC, baş/son boşluk temizliği ve ardışık boşlukları birleştirme; harf, emoji, noktalama, telefon ve URL korunur.** — Daha agresif normalizasyon fiyat/oda anlamını veya `description` içeriğini değiştirebilir; farklı telefonlar farklı hash üretmelidir.

4. **Başarılı “ilan değil” sonuçları da önbelleğe alınır; pozitif TTL 7 gün, negatif TTL 24 saat, LRU en fazla 1.000 kayıt olur.** — Tekrarlayan gereksiz çağrılar engellenirken yanlış sınıflandırmaların uzun süre kalması sınırlandırılır ve model/şema/ayrıştırıcı sürümü değişince önbellek geçersizleşir.

5. **Ön-eleme yalnız boş metinleri ve açıkça selamlaşma/teşekkürden oluşan kısa mesajları reddeder; belirsiz mesajlar modele gider.** — Yalnız uzunluk ve anahtar kelime yokluğuyla ret vermek gerçek ilanları kaçırabileceğinden yanlış negatif hedefi doğrulama kümesinde %0 olmalıdır.

6. **Regex yalnız açık ve tek anlamlı `price+currency`, `area_m2`, `rooms` değerlerini çıkarır; mevcut kurallarla geçerli tam çıktı üretilemedikçe Gemini çağrılır.** — Bu üç alan tek başına ilan niteliğini ve konumu doğrulamaz; model kalan alanları tamamlar, açık regex değerleri korunur, çelişki belirsizlik sayılarak mevcut tam ayrıştırmaya en fazla bir ek çağrı yapılır.

7. **`system_instruction`, `response_schema`, token sınırı ve thinking ayarları bu görevde kapsam dışıdır.** — Bunlar ayrı uyumluluk ve çıktı kalitesi doğrulaması gerektirir; bu görev önbellek, ön-eleme ve kısmi regex çıkarımıyla sınırlı kalmalıdır.

8. **Önbellek hataları işlemi durdurmaz; kısmi regex sonucu tek başına döndürülmez; Gemini hata/timeout sonucu önbelleğe yazılmaz.** — Önbellek yalnız hızlandırıcıdır ve altyapı/model hatasının kalıcı “ilan değil” sonucuna dönüşmesi engellenmelidir.

9. **İçeriksiz yapılandırılmış loglarda `cache_hit{layer}`, `cache_miss`, `cache_error{operation}`, `cache_invalid`, `prefilter_rejected`, `regex_partial`, `regex_only`, `gemini_call`, `gemini_error`, `regex_conflict` ve süreler tutulur.** — Yeni sayaç tablosu gerekmeksizin maliyet etkisi izlenebilir; mevcut `bump_sidecar_counter` iş anlamı korunur, mesaj/telefon/URL/hash loglanmaz.

10. **Temsili tekrar içeren mesaj kümesinde Gemini çağrısı ≥%40 azalmalı; ön-eleme yanlış negatifi %0, ek işlem gecikmesi p95 ≤100 ms, değişen parser kodunda branch coverage ≥%90 olmalıdır.** — Bunlar varsayılan kabul hedefleridir; çağrı azalması aynı veri kümesindeki mevcut akışla karşılaştırılmalı ve tekrar oranına bağlı olduğu açıkça raporlanmalıdır.

11. **Batch API, model değişimi, context caching, sahibinden/Facebook kaynakları ve mevcut fingerprint mantığının değiştirilmesi kapsam dışıdır.** — Onaylanan kapsam yalnız WhatsApp mesajlarının ayrıştırma maliyetine odaklanır.

12. **Test oranı yaklaşık %75 unit / %20 integration / %5 e2e; `GEMINI_PARSE_OPTIMIZATION_ENABLED=false` mevcut ayrıştırma yoluna döndürür.** — Mantığın çoğu deterministik test edilebilirken gerçek Supabase TTL/erişim hataları ve ortak/kişisel akışlar ayrıca doğrulanmalıdır; bayrak dağıtımda açıkça etkinleştirilir.

| # | Durum | Dönen değer | Yan etki | Operatör ne görür |
|---|---|---|---|---|
| 1 | Yeni ilan, önbellekte yok, regex kısmi | Tam doğrulanmış parsed dict | Normalde 1 Gemini çağrısı; başarılı sonuç önbelleğe yazılır | `cache_miss +1`, `regex_partial +1`, `gemini_call +1` |
| 2 | Normalize edilmiş aynı metin, geçerli pozitif kayıt | Önbellekten parsed dict | Gemini çağrılmaz | `cache_hit{layer} +1` |
| 3 | Ön-elemede ilan olmadığı kesin | `None` | Gemini çağrılmaz; kısa TTL ile negatif önbellek yazılır | `prefilter_rejected +1` |
| 4 | Regex ve mevcut deterministik kurallar geçerli tam çıktıyı üretir | Parsed dict | Gemini çağrılmaz; sonuç önbelleğe yazılır; bu koşul sağlanamıyorsa model yolu kullanılır | `regex_only +1` |
| 5 | LRU kaçırır, Supabase önbellek okuması başarısız | Normal ayrıştırmanın dict veya `None` sonucu | Ön-eleme/regex/Gemini akışı sürer; DB hatası mesajı düşürmez | `cache_error{operation=read} +1`; kullanılan yolun sayaçları |
| 6 | Gemini timeout/hata | `None` | Hata sonucu hiçbir önbelleğe yazılmaz; mevcut 429 rotasyonu korunur | `gemini_call +1`, `gemini_error +1` |
| 7 | Regex kısmi, Gemini hata verir | `None` | Eksik ilan döndürülmez; önbelleğe yazılmaz | `regex_partial +1`, `gemini_call +1`, `gemini_error +1` |
| 8 | Önbellekte bozuk/şemaya uymayan kayıt | Yeniden ayrıştırmanın dict veya `None` sonucu | Kayıt yok sayılır, mümkünse silinir; normal akış sürer | `cache_invalid +1`, `cache_miss +1` |
| 9 | Geçerli negatif önbellek kaydı | `None` | Gemini çağrılmaz | `cache_hit{layer} +1` |
| 10 | Önbellek kaydı süresi dolmuş veya sürümü eski | Yeniden ayrıştırmanın sonucu | Eski kayıt kullanılmaz; başarılı sonuçla yenilenir | `cache_miss +1`; kullanılan yolun sayaçları |
| 11 | Başarılı ayrıştırmadan sonra önbellek yazımı başarısız | Parsed dict | İşleme devam edilir; mümkünse LRU kaydı tutulur | `cache_error{operation=write} +1` |
| 12 | Gemini başarıyla `is_listing=false` döndürür | `None` | Negatif sonuç 24 saat önbelleğe alınır | `gemini_call +1`, `cache_miss +1` |
| 13 | Regex ile Gemini çelişir | Tam ayrıştırmayla doğrulanan dict; doğrulanamazsa `None` | En fazla 1 ek tam Gemini çağrısı; çözülemeyen sonuç önbelleğe yazılmaz | `regex_conflict +1`; her gerçek çağrı için `gemini_call +1` |
| 14 | Optimizasyon bayrağı kapalı | Mevcut parser sonucu | Önbellek, ön-eleme ve regex optimizasyonları atlanır | Mevcut operasyonel kayıtlar |
| 15 | Önbellekten dönen ilan ortak veya kişisel akışta ilerler | Parsed dict | Quality gate, fingerprint, kişisel yetki kontrolleri ve mevcut sayaç davranışı korunur | Mevcut akış sayaçları ve `cache_hit +1` |