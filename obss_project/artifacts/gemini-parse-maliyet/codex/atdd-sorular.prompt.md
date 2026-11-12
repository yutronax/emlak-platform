Aşağıdaki özellik için ATDD netleştirme sorularını YANITLA.
BU BİR ARAŞTIRMA GÖREVİ DEĞİL — hiçbir tool (Read/Grep/Glob/WebSearch/Bash vb.) KULLANMA, kod tabanını tarama. SADECE aşağıda verilen bağlamdan en makul cevabı seç/üret. Bağlam yetersizse bile araştırmaya başlama — en makul varsayımı gerekçesiyle yaz.
Her soru için en makul/varsayılan seçeneği seç (veya seçenek yoksa kısa bir cevap üret), 1 cümlelik gerekçeyle.

Kullanıcının orijinal isteği: "modelin sürekli aynı promptu verip çıktı isticeğiz ve bunun uzun vadede çok maliyetli" → onaylanan kapsam: Gemini ilan ayrıştırma maliyetini düşür: scraper/parser.py için (1) normalize edilmiş mesaj hash'iyle tekrar önbelleği, (2) ilan olmayan mesajlar için ucuz ön-eleme, (3) fiyat/m²/oda gibi kolay alanların regex ile çıkarılıp modelin yalnız eksik/belirsiz alanlar için çağrılması.

Proje bağlamı (task_slug: gemini-parse-maliyet, emlak-platform):
- Python scraper/orchestrator.py: Baileys sidecar'dan gelen WhatsApp mesajları kuyruktan işlenir: parse_listing_message(text) (Gemini gemini-3.8-flash, tek çağrı, SYSTEM_PROMPT + metin tek string, JSON regex ile çıkarılıyor) -> quality_gate score -> fingerprint dedup (city+district+rooms+price+area_m2 sha256, Gemini'DEN SONRA) -> raw_listings insert. Kişisel yol (agentId'li) ayrı: is_group_selected kontrolü, sonra parse, sonra ingest_personal_listing (DB RPC) ve sidecar sayaçları (bump_sidecar_counter).
- parse_listing_message dönüşü: is_listing=false ise None, aksi halde dict {is_listing,title,price,currency,rooms,area_m2,city,district,neighborhood,description}. 429'da key rotasyonu. Hata/timeout -> None.
- KVKK: mesaj içeriği loglanmaz (kişisel yolda içeriksiz sayaç). Supabase (Postgres) var, migration'lar supabase/migrations/00NN_*.sql.
- Testler: pytest, scraper/tests/test_parser.py vb.

Sorular:
1. Persona: bu değişikliği kim "kullanır"/fark eder? (platform sahibi/operatör maliyet açısından; emlakçı davranış değişmemeli?)
2. Önbellek nerede tutulsun? (a) Supabase'de yeni tablo parse_cache(text_hash pk, parsed jsonb|null, is_listing bool, created_at) (b) yalnız bellek-içi LRU (c) her ikisi: bellek LRU + Supabase kalıcı. Ham metin önbellekte saklanmasın mı (KVKK)?
3. Normalizasyon kuralı ne olsun? (küçük harf, Unicode NFKC, boşluk/emoji/noktalama sadeleştirme, telefon numaralarını ve URL'leri maskeleme — aynı ilanı farklı emlakçı telefonuyla atanlar aynı hash'e düşsün mü?) Not: telefon farklıysa parsed sonuç yine aynı alanları verir mi?
4. "İlan değil" (is_listing=false) sonucu da önbelleğe alınsın mı? Önbellek ömrü (TTL) ne olsun?
5. Ön-eleme kuralı: hangi durumda Gemini'ye HİÇ gitmeden "ilan değil" denir? (ör. metin < N karakter VE fiyat/m²/oda/satılık/kiralık/daire/arsa anahtar kelimelerinin hiçbiri yok). Yanlış negatif (gerçek ilanı atlamak) toleransı nedir?
6. Regex çıkarımı: hangi alanlar regex'le alınsın (price+currency, area_m2, rooms)? Regex tüm zorunlu alanları bulursa Gemini HİÇ çağrılmasın mı, yoksa city/district için yine çağrılsın mı? Regex ile Gemini çelişirse hangisi kazanır?
7. Gemini çağrısı yine yapılacaksa: SYSTEM_PROMPT system_instruction'a, şema response_schema'ya taşınsın mı, max_output_tokens ve thinking kapatma da kapsamda mı?
8. Davranış sözleşmesi: önbellek DB'si erişilemezse ne olur (Gemini'ye düş mü, mesajı at mı)? Önbellek yazımı başarısızsa? Regex kısmi bulursa? Gemini hata/timeout'ta önbelleğe yazılır mı (yazılmamalı mı)?
9. Operatör görünürlüğü: hangi sayaçlar/loglar? (ör. cache_hit, cache_miss, prefilter_rejected, regex_only, gemini_call, gemini_error — içerik loglamadan). bump_sidecar_counter mı, ayrı tablo mu, sadece log mu?
10. Başarı ölçütü (sayısal): Gemini çağrı sayısında hedef azalma (%), ön-elemede yanlış negatif oranı üst sınırı, ek gecikme sınırı, coverage hedefi.
11. Kapsam dışı: Batch API, model değişimi, context caching, sahibinden/Facebook kaynakları, mevcut fingerprint mantığının değişmesi — hangileri DIŞARIDA?
12. Test stratejisi oranı (unit/integration/e2e) ve rollback (özellik bayrağıyla kapatılabilir mi, env değişkeni adı?).

Davranış sözleşmesi taslağı (doldur/düzelt, satır öner):
| # | Durum | Dönen değer | Yan etki | Operatör ne görür |
|1| Happy path: yeni ilan metni, önbellekte yok | parsed dict | Gemini 1 çağrı, önbelleğe yazılır | gemini_call +1, cache_miss +1 |
|2| Aynı metin (normalize) tekrar gelir | önbellekten parsed dict | Gemini çağrısı YOK | cache_hit +1 |
|3| Ön-eleme: ilan olmadığı belli | None | Gemini YOK | prefilter_rejected +1 |
|4| Regex tüm alanları buldu | ? | ? | regex_only +1 ? |
|5| Önbellek DB erişilemez | ? | ? | ? |
|6| Gemini timeout/hata | None (mevcut) | önbelleğe YAZILMAZ? | gemini_error +1 |
|7| Kısmi: regex bir kısmını buldu, Gemini hata verdi | ? | ? | ? |
|8| Hiçbir şey yapılamadı ama hata yok (ör. önbellek bozuk kayıt) | ? | ? | ? |

Yanıt formatı: her soru için 'N. <seçilen cevap> — <gerekçe>'. Sonra doldurulmuş davranış sözleşmesi tablosunu ver.
Dosya yazma, sadece cevap ver.
