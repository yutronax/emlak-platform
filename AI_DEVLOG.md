# AI Dev Log

Pipeline adımlarının (atdd/plan/code_diff/verify) kendi dosyalarına yazdığı
karar/risk/varsayım kayıtlarının aktarımı — yeniden yorumlanmadan, kaynağıyla.

## fingerprint-unique-constraint (2026-10-22)

**Riskler** (kaynak: atdd.md, plan.md):
- Kabul edilen risk (threat-model): kasıtlı fingerprint çakıştırma yoluyla
  gerçek bir ilanın sessizce reddedilmesi — bu görevin yarattığı değil,
  `fingerprint_exists()` ön-kontrolünün zaten bugün sergilediği davranış,
  sadece DB seviyesinde garantiye bağlanıyor.
- Migration'ın tabloda mevcut mükerrer fingerprint varsa başarısız olma
  riski — customer kararıyla (Seçenek b) migration'a önce soft-delete
  temizlik adımı eklendi.

**Kararlar** (kaynak: plan.md, customer session onayıyla):
- Migration yaklaşımı: önce mükerrer fingerprint'li satırları `status=
  'rejected'`e soft-çeken bir DO bloğu (RAISE NOTICE ile etkilenen satır
  sayısı audit için loglanır), sonra `status <> 'rejected'` koşuluyla
  PARTIAL unique index. Hard-delete değil soft-delete tercih edildi
  (customer'ın açık şartı: audit görünürlüğü + geri döndürülebilirlik).
- PostgREST'in partial unique index'i `on_conflict` parametresiyle
  güvenilir şekilde hedefleyemeyebileceği teknik gerekçesiyle, atomiklik
  `upsert(on_conflict=...)` yerine try/except 23505 deseniyle sağlandı —
  davranış sözleşmesi (AC-3'ün sonucu) değişmedi, sadece uygulama
  mekanizması (PM tarafından compliance açısından "şeffaf, onay ihlali
  değil" olarak değerlendirildi).

**Kalan sınırlamalar / gerçek zorluk** (kaynak: verify_report.md, red_team.json):
- `verify` adımının ilk koşumunda canlı uçtan uca test, migration'ın
  gerçek Supabase projesine HENÜZ UYGULANMAMIŞ olduğunu yakaladı (aynı
  fingerprint ile ikinci insert de başarıyla eklendi) — bu, "migration
  dosyası repoda var" ile "migration projeye uygulandı" arasındaki farkı
  somut olarak gösteren canlı bir örnek (`supabase-check`/gate 3'ün var
  olma sebebi). Kullanıcı SQL'i Dashboard'dan çalıştırdıktan sonra gate
  tekrar koşulup PASS'a döndü.
- PM incelemesi, AC-3'ün (gerçek race condition) integration testinin
  `verify` aşamasında hiç çalıştırılmadığını buldu (medium bulgu) — bu
  bulgu üzerine test gerçek Supabase'e karşı ayrıca çalıştırıldı ve PASS
  etti, commit öncesi kapatıldı.

## scraper-dm-grup-filtresi (2026-10-22)

**Riskler** (kaynak: atdd.md, plan.md):
- Baileys'in JID sonek sözleşmesini (`@g.us`/`@s.whatsapp.net`) gelecekte
  değiştirmesi durumunda filtre fail-closed davranır — grup mesajları da
  yanlışlıkla düşebilir. Kabul edilen risk: PII sızıntısından daha az
  zararlı; `forwarded` sayacı 0'da kalırsa operatör fark eder.
- `raw_listings` tablosunda bu düzeltmeden ÖNCE sızmış olabilecek geçmiş
  DM verisinin temizliği bu görevin kapsamı dışında bırakıldı — ayrı bir
  görev olarak backlog'a (`is-listesi-ve-sayfa-envanteri.md`, madde 23)
  eklendi, silme/anonimleştirme kararı gerçek kullanıcıya bırakıldı.

**Kalan sınırlamalar / varsayımlar** (kaynak: plan.md, code_diff.md):
- `bridge.js`'in `require` edildiğinde (test'ten import edilince) yan
  etkili kod (env kontrolü + WhatsApp bağlantısı) çalışmaması için
  `require.main === module` koruması eklendi — `node bridge.js` ile
  doğrudan çalıştırma davranışı değişmedi.
- İlk red-step testleri, entegrasyon/log testlerinde gerçek handler'ı
  değil kendi yazdıkları `if` dalını çağırıyordu ("doğrudan tetikleme"
  ihlali) — PM/verify öncesinde fark edilip `processIncomingMessage`'ı
  doğrudan çağıracak şekilde düzeltildi.
- PM incelemesinde bulunan bir boşluk (grup mesajı + boş/çıkarılamayan
  metin durumunda hiçbir sayaç artmıyordu) düzeltildi — `type=no_text`
  kategorisiyle `skipped` sayacına eklendi.

## supabase-proje-kurulumu (2026-10-16)

**Riskler** (kaynak: atdd.md, plan.md):
- Service-role key yanlışlıkla `NEXT_PUBLIC_*`'e veya commit'e girerse, repo
  public olduğu için anında sızar — tek çözüm key'i Supabase dashboard'dan
  rotate etmek (geçmişten silmek yetmez).
- Yanlış key (ANON yerine SERVICE_ROLE beklenen yerde) sessizce 0 satır
  dönebilir, fark edilmeyebilir — bu yüzden `verify_supabase.py` yaz-oku-sil
  smoke testi zorunlu tutuldu.

**Kararlar** (kaynak: plan.md, kullanıcı yetkisiyle Opus alt-ajanı tarafından yanıtlandı):
- Supabase bölgesi: `eu-central-1` (Frankfurt) — Türkiye'ye en yakın, şema/AC'leri
  etkileyen bir kısıt yoktu.
- "Henüz proje yok, kullanıcı şimdi dashboard'dan yeni proje açacak" varsayımıyla
  ilerlendi — doğrulandı, kullanıcı gerçekten yeni proje açtı.

**Kalan sınırlamalar / varsayımlar** (kaynak: code_diff.md):
- `verify_supabase.py`'nin RPC varlık kontrolü, migration'daki Türkçe RAISE
  EXCEPTION metnini ("bulunamadı") kanıt olarak kullanıyor — mesaj metni
  değişirse sessizce FAIL'e döner (fail-safe yönde, ama kırılgan). PM
  incelemesinde düşük risk olarak not edildi, düzeltilmedi (bilinçli kabul).
- `SUPABASE_ANON_KEY` env değişken adı code-copilot tarafından seçildi
  (kullanıcıya sorulmadan) — makul ama şeffaflık notu olarak kayıtlı.
- Anon ile yanlışlıkla başarılı insert olursa (RLS atlanmışsa) script
  temizlik yapamaz (silme de RLS'e takılır) — atdd.md'de zaten bilinen ve
  kabul edilmiş bir sınırlama.

**Not — SETUP.md oluşturulmadı:** Bu projede kurulum adımları zaten
`README.md`'de tutuluyor (ayrı bir `SETUP.md` dosyası yok, iki kaynağa
bölünmesi gereksiz tekrar yaratırdı) — plan.md'nin öngördüğü env
değişkeni/doğrulama script'i adımı bu görevde doğrudan README.md'ye eklendi.

**Gerçek canlı doğrulama** (kaynak: verify_report.md): Gerçek Supabase
projesi (ref: `bbjmjzixcugdwbcwydux`) bağlandı, migration'lar uygulandı,
`python -m scripts.verify_supabase` canlı projede çalıştırıldı — `GENEL: PASS`.

## agents-self-update-rls-yetki-yukseltme-acigi (2026-10-18, EML-18)

**Risk** (kaynak: atdd.md): Mevcut üretim verisinde açık daha önce istismar
edilmiş olabilir — `SELECT id, email, updated_at FROM agents WHERE is_admin
= true` ile salt-okunur bir denetim yapıldı, anormallik bildirilmedi (kullanıcı
beyanı, ayrıntılı satır çıktısı paylaşılmadı).

**Teknik karar** (kaynak: plan.md): `WITH CHECK` yerine BEFORE UPDATE trigger
seçildi — `WITH CHECK`'te OLD satırına (önceki `is_admin` değerine) doğrudan
referans yok, subquery ile aynı tabloyu okumak MVCC/command-counter
davranışına bağımlı güvenilmez bir varsayım olurdu; trigger'da `OLD`/`NEW`
açıkça mevcut.

**Kalan sınırlamalar / varsayımlar** (kaynak: code_diff.md, red_team.json):
- ~~AC-2 (`id`/`created_at` alanlarının değişmezliği) için trigger'da açık
  bir koruma yoktu~~ — **EML-25 ile kapatıldı** (bkz. aşağıdaki ek).
- Migration, Supabase Dashboard SQL Editor'den elle uygulandı — dosya ile
  gerçek proje şeması arasında otomatik bir senkronizasyon/diff kontrolü yok.

**Süreç notu** (kaynak: red_team.json compliance_check): Pipeline sırasında
iki küçük kapsam kararı orkestratör tarafından kullanıcıya sorulmadan alındı
(frontend-pipeline adımının `page.tsx`'in bu göreve dokunmadığı gerekçesiyle
atlanması; bir testin yanlış beklentisi düzeltilirken atdd.md'nin Davranış
Sözleşmesi'nin de güncellenmesi) — PM ikisini de teknik olarak doğru ama
şeffaflık notu gerektiren kararlar olarak işaretledi, kullanıcı commit
onayında bilgilendirildi.

**Gerçek canlı doğrulama** (kaynak: verify_report.md): Migration gerçek
Supabase projesine (ref: `bbjmjzixcugdwbcwydux`) uygulandı,
`web/src/test/agents-self-update-rls.test.ts` gerçek projeye karşı 6/6 PASS
— `is_admin` yetki yükseltme denemesi 403 + Postgres 42501 ile reddediliyor.

### Ek — EML-25: AC-2 (id/created_at değişmezliği) kapatıldı (2026-10-18)

**Kalan sınırlama** (kaynak: red_team.json, low): `id` alanı için ayrı bir
UPDATE denemesi/test yok — trigger kodunda `new.id is distinct from old.id`
kontrolü var ama `id` zaten PK olduğu için pratikte ikinci bir savunma
hattı; risk düşük, sonraya bırakıldı.

**Gerçek canlı doğrulama:** `supabase/migrations/0005_agents_immutable_columns.sql`
gerçek projeye uygulandı, `created_at` değişikliği denemesi 403 + 42501 ile
reddediliyor, DB'de değer değişmediği ayrıca doğrulandı (7/7 test PASS).

## pricing-plans-sort-order-fix (2026-10-18, EML-19)

**Risk/Varsayım** (kaynak: atdd.md, plan.md): Mevcut `plans` satırlarının
(varsa) backfill sıralaması fiyata göre (price_minor_unit artan, eşitlikte
created_at) yapıldı — bu bir varsayım, gerçek iş sıralaması (pazarlama
tercihi) farklıysa elle düzeltme gerekebilir; kullanıcıya ayrıca, tek tek
sorulmadı (atdd.md'nin Hard Stop onayı genel pipeline'a izin verdi, bu
spesifik varsayıma değil — `red_team.json` bunu compliance bulgusu olarak
işaretledi).

**Kalan sınırlama** (kaynak: code_diff.md, red_team.json): Backfill
mantığı (`row_number() over (order by price_minor_unit asc, created_at
asc)`) gerçek veriyle hiç test edilmedi — gerçek `plans` tablosu migration
uygulandığında boştu. Migration tek seferlik çalıştığı için ileride eklenen
yeni satırların `sort_order`'ının ayrıca (uygulama kodu veya elle) set
edilmesi gerektiği şu an koda yansımıyor.

**Gerçek canlı doğrulama** (kaynak: verify_report.md): Gerçek Supabase
projesinde `plans` tablosunun migration `0003_subscriptions_payment.sql`
hiç uygulanmadığı için **hiç var olmadığı** keşfedildi (0001-0002 dışında
hiçbir migration gerçek projeye uygulanmamıştı). Kullanıcı 0003 + 0006'yı
SQL Editor'den elle uyguladı (0003'ün partial index'indeki
`status::text` cast'i STABLE olduğu için IMMUTABLE gerektiren index
predicate'inde hataya yol açtı, doğrudan enum karşılaştırmasına
düzeltildi). Sonrasında `plans`/`sort_order`, `subscriptions.plan_id`,
`payment_events` REST ile canlıda doğrulandı (200, bkz. verify_report.md).
0004/0005'in gerçek projeye uygulanıp uygulanmadığı bu görevde ayrıca
doğrulanmadı.

## eml-20-scraper-webhook-auth (2026-10-18, EML-20)

**Risk** (kaynak: atdd.md): Gemini kota tüketimi / rate limiting bu
sürümde bilinçli olarak kapsam dışı bırakıldı — token çalınırsa/sidecar
ele geçirilirse DoS riski hâlâ açık, ayrı bir Jira issue'su açılmalı.
`orchestrator.py` ve `bridge.js` aynı anda deploy edilmezse mesaj akışı
401 ile durur (veri kaybı yok, sadece gecikme).

**Rollback Beklentisi** (kaynak: atdd.md): Auth eklemesi geriye dönük
uyumsuz — iki tarafın (orchestrator.py + bridge.js) aynı anda deploy
edilmesi gerekiyor.

**Kalan sınırlama** (kaynak: red_team.json, low): `WebhookHandler.do_POST`'taki
`not secret or not hmac.compare_digest(token, secret)` kontrolü, `run()`'ın
`BAILEYS_WEBHOOK_SECRET` boşsa süreci hiç başlatmaması varsayımına örtük
olarak bağımlı — handler ileride başka bir giriş noktasından çağrılırsa bu
fail-closed garanti tekrar edilmemiş olur. Şu an gerçek bir açık değil
(run() koruyor), ileride not edilmesi gereken bir varsayım.

**Test-gap** (kaynak: verify_report.md, red_team.json): Timing-leak testi
(`test_ac_s2_timing_does_not_leak_correct_vs_incorrect_token`) pytest+Windows
soket ortamında tutarlı `ConnectionAbortedError` ile FAIL veriyor; aynı
senaryo pytest dışında sorunsuz çalıştı. AC-S2'nin asıl iddiası
(`hmac.compare_digest` kullanımı) ayrı bir testle (PASS) zaten kanıtlı,
bu nedenle implementasyonu bloklamadı — ama testin kendisi (gerçek TCP
round-trip yerine izole bir unit test) sağlamlaştırılmalı.

**Yeni env değişkenleri** (SETUP.md yok, bu repoda kurulum `scraper/.env.example`
üzerinden belgeleniyor — ayrı bir SETUP.md oluşturmak gereksiz tekrar
yaratırdı): `BAILEYS_WEBHOOK_SECRET` (zorunlu, boşsa süreç başlamaz),
`BAILEYS_WEBHOOK_HOST` (opsiyonel, varsayılan `127.0.0.1`).

**Gerçek doğrulama** (kaynak: verify_report.md): `scraper/tests/test_webhook_auth.py`
scraper'ın kendi `.venv`'inde çalıştırıldı, 13/14 PASS. `security-scan`
skill'i değişen dosyalara karşı çalıştırıldı — `secrets: PASS`,
`python_sast: PASS`.
