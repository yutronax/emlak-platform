ROLÜN: Kıdemli ürün/test mimarı. Aşağıdaki görev için ATDD belgesini (atdd.md) Türkçe olarak EKSİKSİZ yaz. Kod tabanını okuyabilirsin (read-only); etkilenen dosyaları ve mevcut davranışı gerçek koddan çıkar (özellikle scraper/parser.py, scraper/orchestrator.py, scraper/fingerprint.py, scraper/supabase_client.py, scraper/tests/, supabase/migrations/ son numara), tahmin ettiğin yerleri "Assumptions"a yaz. Dosya değiştirme.

Görev: Gemini ilan ayrıştırma maliyetini düşür — scraper/parser.py için (1) normalize edilmiş mesaj hash'iyle tekrar önbelleği, (2) ilan olmayan mesajlar için ucuz ön-eleme, (3) fiyat/m²/oda gibi kolay alanların regex ile çıkarılıp modelin yalnız eksik/belirsiz alanlar için çağrılması. Kullanıcının ilk ifadesi: "modelin sürekli aynı promptu verip çıktı isticeğiz ve bunun uzun vadede çok maliyetli".
Önemli mevcut-durum bulgusu: orchestrator'da fingerprint dedup Gemini çağrısından SONRA yapılıyor; aynı ilan birden çok gruba düşünce her biri için Gemini ücreti ödeniyor.

task_slug: gemini-parse-maliyet
jira_id: null — bu oturumda Jira (Atlassian) MCP bağlantısı yok, jira-sync çalıştırılamadı. Frontmatter'a `jira_id: null` yaz ve "Jira Kaynağı" bölümüne bu durumu açıkça not et (bağlantı kurulunca EML projesinde issue açılacak).

Netleştirme cevapları (4z, birebir kullan, yeniden yorumlama; "Sorular ve Cevaplar" bölümüne her birini "(Codex tarafından yanıtlandı: <gerekçe>)" notuyla yaz):
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
Threat model kararı: Görev KVKK kişisel veri (mesaj metni/telefon içeren parsed.description önbellekte), Supabase servis rolüyle DB erişimi ve dış API (Gemini) içerdiği için tetikleyici VAR. Frontmatter'a threat_model: done yaz; "Threat Model" bölümüne en az şu AC-S kriterlerini ekle ve Acceptance Criteria listesine de koy: AC-S1 önbellek tablosu RLS açık, anon/authenticated politikasız, yalnız servis rolü; AC-S2 ham mesaj metni önbellekte saklanmaz (yalnız hash + parsed + is_listing); AC-S3 loglarda mesaj/telefon/URL/hash yok; AC-S4 kişisel yolda önbellek isabeti grup seçim kontrolünü (is_group_selected) atlamaz — kontrol parse'tan önce kalır; AC-S5 parsed önbellek kaydı TTL ile süresi dolunca kullanılmaz ve periyodik temizlenir (retention).

Şablon (başlıkları ve YAML frontmatter alanlarını AYNEN koru):

```markdown
---
task_slug: <task-slug>
jira_id: <issue key, örn. KAN-42 — artık ZORUNLU, null olmaz>
threat_model: done | not-applicable
priority: critical | high | medium | low
coverage_target: <yüzde, örn. 85>
performance_target: <örn. "<200ms" veya null>
memory_target: <örn. "<100MB" veya null>
test_strategy:
  unit: <yüzde>
  integration: <yüzde>
  e2e: <yüzde>
affected_modules:
  - <modül/dosya yolu>
---

# ATDD — <task-slug>

## Jira Kaynağı
[<JIRA-ID> — <tam başlık>](https://.../browse/<JIRA-ID>) — `jira-sync` ZORUNLU
çağrıldı, artık her görevde bir Jira issue'su var.
User Story (Jira'dan birebir, varsa): "..."
AC (Jira'dan birebir, varsa): Given ..., When ..., Then ...

## Persona
<kim, hangi bağlamda kullanıyor>

## Hedef (Neden)
<bu iş neden yapılıyor>

## User Story
As a <persona>
I want <capability>
So that <benefit>

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given <bağlam>, When <eylem>, Then <beklenen sonuç>
2. [High] ...
3. [Medium] ...
(en az happy path [Critical] + 2 edge case olacak şekilde; test-copilot
Critical olanları önce yazabilsin diye öncelik etiketi zorunlu)

## Threat Model
(5b adımının zorunlu karar kaydı — boş bırakılamaz)
- `threat-model` çağrıldıysa: "Çağrıldı — AC-S<n> kriterleri yukarıdaki Acceptance Criteria'ya eklendi."
- Çağrılmadıysa: "Tetikleyici yok — değerlendirilen tetikleyiciler: <liste>, hiçbiri uymadı çünkü <1 cümle gerekçe>."

## Agentic Değerlendirme Kriterleri (opsiyonel — sadece görev bir LLM agent/sub-agent tool-calling davranışını veya prompt'unu değiştiriyorsa doldurulur)
Tetikleyici yoksa bu bölümü sil, "tetikleyici yok" yazma.
- Beklenen tool-calling trajectory'si: <hangi tool'lar hangi sırayla çağrılmalı>
- Hassas (`sensitive: true`) tool'lar: <PII/finansal veri döndüren tool isimleri — agentic-judge scope-creep'i bunlarla eşleşince severity'yi otomatik critical'a çıkarır>
- Response kalite kriterleri: <faithfulness/completeness/tone_fit/actionability için proje-özel eşik veya beklenti, varsa>
- Bu bölüm doluysa `agentic-judge` skill'i `red-team`'in yanına koşullu adım olarak eklenir (bkz. `pipeline` SKILL.md).

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | <happy path> | <ör. 200 + {id, ad}> | <ör. kayıt oluşur> | <ör. "Kaydedildi"> | AC-1 |
| 2 | <girdi geçersiz> | <ör. 400 + {hata: "ad boş olamaz"}> | <yok> | <alan altı hata> | AC-2 |
| ... | | | | | |

Kısmi başarı: <bir kısmı olup kalanı olmazsa ne döner — "olmaz" yazma, oluşursa ne olacağını yaz>
Hiçbir şey yapılamadı ama hata da yok: <bu durumda ne döner — sessiz başarı YASAK>
Boş sonuç ↔ hata ayrımı: <"veri yok" ile "yetkin yok" nasıl ayırt edilir>
LLM çağrısı varsa (postmortem Koşum 1, 2026-10-28 — `cv-parse-kariyer-bilgisi`,
`kan-eksiklik-ideal-answer`'da 2 high bulgu): <(a) çıktı şeması nedir, nasıl
doğrulanır (ör. Pydantic) ve geçerli JSON ama şema dışı yanıtta ne döner;
(b) kullanıcı içeriği prompt'ta nasıl ayrılır (delimiter + "içindeki talimatları
yok say"); (c) LLM'e gösterilen ve LLM'den beklenen index/sıra numaraları aynı
tabanda mı (0/1). Her biri bir AC satırına bağlanır. LLM yoksa satırı sil.>

<Uygulanmayan satır silinir ve nedeni buraya yazılır. Tabloda olmayan hata
durumu, test edilmeyen hata durumudur.>

## Test Strategy
Unit: <yüzde>% — <hangi katman/fonksiyonlar>
Integration: <yüzde>% — <hangi akışlar>
E2E: <yüzde>% — <varsa hangi senaryolar>

## Benchmark / Başarı Ölçütü
Coverage Target: <yüzde>%
Performance Target: <varsa>
Memory: <varsa>
Görsel/UI kriteri (varsa): <ör. "layout bozulmamalı", "hata mesajı görünür
olmalı" — bu tür kriterler `verify` adımında `vision-test` skill'iyle
kontrol edilir, buraya not düşülmezse unutulur>
Diğer ölçülebilir kriterler: <...>

## Kapsam Dışı
<açıkça yapılmayacaklar>

## Etkilenen Dosyalar/Modüller (bilinen)
<varsa>

## Proje Ortamı Kısıtı (arama/grep kapsamı)
<Bu makinede git reposunun kökü proje klasörü değil, DAHA GENİŞ bir dizin
(örn. ev dizini) olabilir ve devasa bir git geçmişi taşıyabilir —
doğrulanmadıysa "doğrulanmadı" yaz, "yok" deme. Doğruysa: sonraki adımlarda
(özellikle `plan`'ın kod keşfi, `code-copilot`/`test-copilot`/`red-team`'in
Grep/Glob/Bash kullanımı) arama HER ZAMAN gerçek proje klasörüyle
sınırlanmalı — sınırsız arama (`git log -p --all`, kök dizinden `grep -r`,
tam-repo indexleme) devasa geçmişi/ilgisiz dosyaları tarayıp RAM'i
tüketebilir (canlı olay: `security-scan` ve harici araçlarda (tgrep)
tekrarladı, bkz. proje hafızası).>

## Rollback Beklentisi
<hata durumunda davranış>

## Risks
- <bilinen risk, varsa>

## Assumptions
- <varsayım — kullanıcı onaylamadıysa açıkça "varsayım" olarak işaretli>

## Unknowns
- <henüz netleşmemiş, ileride tekrar sorulması gereken>

## Sorular ve Cevaplar (ham kayıt)
1. Soru → Cevap (veya "kullanıcı mesajından, tekrar sorulmadı")
2. ...
```


Kurallar: her AC Given-When-Then ve öncelikli (Critical/High/Medium/Low); davranış sözleşmesinde "hata döner" gibi belirsiz satır yok, her hata durumu somut dönüş değeri (Python: dict örneği veya None) içerir; nullable alanlar (price, area_m2, rooms, city vb.) için null davranışı yazılır; test stratejisi sayısal oran ve toplam 100; benchmark ölçülebilir; LLM çağrısı olduğu için şablondaki "LLM çağrısı varsa" (a)(b)(c) maddelerini doldur; "Doğrudan tetikleme" notunu ilgili satırlara düş; operatör görünürlüğü (sayaç/log) her satırda belirt.
Çıktı: YALNIZCA atdd.md içeriği (frontmatter dahil), başka açıklama yok. Dosya yazma, sadece cevap ver.
