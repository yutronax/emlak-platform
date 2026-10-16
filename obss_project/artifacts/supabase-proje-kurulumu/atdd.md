---
task_slug: supabase-proje-kurulumu
jira_id: null
saga_task_id: null
threat_model: not-applicable
priority: high
coverage_target: 80
performance_target: "~15 dakika içinde tüm adımlar tamamlanır"
memory_target: null
test_strategy:
  unit: 10
  integration: 80
  e2e: 10
affected_modules:
  - scraper/.env
  - scraper/supabase_client.py
  - web/.env.local
  - web/src/lib/supabase/client.ts
  - web/src/lib/supabase/server.ts
  - supabase/config.toml
  - README.md
---

# ATDD — supabase-proje-kurulumu

## Jira Kaynağı
Jira'ya bağlı değil — yerel görev (GitHub Issue [#4](https://github.com/yutronax/emlak-platform/issues/4)).

## Persona
Proje sahibi geliştirici (tek kişi) — Supabase CLI ve dashboard'a erişimi olan, projeyi oluşturma/key alma yetkisine sahip kişi.

## Hedef (Neden)
Şu ana kadar scraper ve web hep placeholder/sahte Supabase URL+key ile test edildi. RLS politikalarının, admin RPC'lerinin ve şemanın gerçek bir ortamda çalıştığı hiç kanıtlanmadı. Bu görev, gerçek bir Supabase projesine `supabase link` + `supabase db push` ile geçişi sağlar.

## User Story
As a proje sahibi geliştirici
I want 0001 ve 0002 migration'larını gerçek bir Supabase projesine uygulamak ve env dosyalarını gerçek değerlerle güncellemek
So that scraper ve web gerçek veriyle uçtan uca test edilebilir

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given boş/yeni bir Supabase projesi, When `supabase link` + `supabase db push` çalıştırılır, Then her iki migration da hatasız uygulanır ve `supabase migration list` Local/Remote'u eşit gösterir.
2. [Critical] Given migration'lar uygulanmış, When şema smoke check çalıştırılır, Then 6 tablo + `agents.is_admin` + 2 RPC fonksiyonu bulunur (AC-8'deki "sessiz başarı" riskine karşı).
3. [Critical] Given gerçek SERVICE_ROLE_KEY `scraper/.env`'e yazılmış, When scraper `raw_listings`'e 1 test kaydı yazıp okur, Then kayıt başarıyla okunur ve ardından silinir.
4. [High] Given gerçek ANON_KEY `web/.env.local`'e yazılmış, When anon key ile `raw_listings`'e insert denenir, Then RLS reddeder (42501 / "new row violates row-level security policy").
5. [High] Given yanlış/geçersiz `project-ref`, When `supabase link` çalıştırılır, Then exit 1 + "project not found" benzeri hata döner, link dosyası yazılmaz.
6. [High] Given 0002 migration'da syntax hatası olsaydı, When push çalıştırılır, Then o migration rollback olur, önceki migration kalıcı kalır, hangi dosya/statement olduğu gösterilir.
7. [Medium] Given commit öncesi, When `git status`/`detect-secrets` kontrolü yapılır, Then repoda gerçek service-role key/DB şifresi/access token bulunmaz.

## Threat Model
Tetikleyici yok — değerlendirilen tetikleyiciler: kimlik doğrulama/yetkilendirme, dış API çağrısı, çok kiracılı sınır. Hiçbiri uymadı çünkü bu görev yeni bir auth akışı/HTTP ucu/kullanıcı girdi yüzeyi eklemiyor — Faz 1-3'te zaten yazılmış ve incelenmiş şemayı (RLS dahil) gerçek bir ortama deploy ediyor; kod/mimari değişmiyor.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path (ilk kez push) | exit 0; "Applying migration 0001_init.sql... 0002_admin_review.sql... Finished supabase db push." | Uzak DB'de 6 tablo, RLS, is_admin, 2 RPC oluşur; `schema_migrations`'a 2 satır eklenir | Başarı mesajı; `migration list` Local=Remote | AC-1 |
| 2 | Girdi geçersiz (yanlış project-ref) | exit 1; "project not found" / 404 | Yok, link dosyası yazılmaz | Hata; ref'in dashboard'dan kontrolü istenir | AC-5 |
| 3 | Migration dosyası bozuk/syntax hatası | exit 1; "ERROR: syntax error ... (SQLSTATE 42601) At statement N" | O migration'ın transaction'ı rollback olur, `schema_migrations`'a eklenmez | Hangi dosya/statement gösterilir | AC-6 |
| 4 | Yetkisiz erişim (yanlış/eksik token) | exit 1; "Access token not provided" veya DB şifresi yanlışsa "password authentication failed" (28P01) | Yok | `supabase login` tekrarı veya şifre sıfırlama istenir | — |
| 5 | Dış bağımlılık hatası (ağ) | exit 1; "dial tcp: i/o timeout / no such host" | Yok, bağlantı açılmadan düşer | Ağ hatası; tekrar denenir | — |
| 6 | Zaman aşımı | exit 1; "context deadline exceeded" | Kesilen migration rollback olur, önceki migration'lar kalıcı | Hata; push idempotent, yeniden çalıştırılır | — |
| 7 | **Kısmi başarı** (0001 push oldu, 0002 hata verdi) | exit 1; "Applying migration 0001... 0002... ERROR: ..." | 0001 kalıcı; 0002 rollback, geçmişe yazılmaz | `migration list`'te 0001 Remote'ta var, 0002 yok | AC-6 |
| 8 | **Hiçbir şey yapılamadı ama hata da yok** ("Remote database is up to date" ama şema eksik) | exit 0; "Remote database is up to date." | Yok; drift sessizce kalır | Yanıltıcı başarı — bu yüzden AC-2 (şema smoke check) zorunlu son adım | AC-2 |

Kısmi başarı: Satır 7 — ilk migration kalıcı kalır, ikincisi rollback olur ve düzeltilip tekrar push edilebilir (henüz `schema_migrations`'a yazılmadığı için "uygulanmış migration'ı düzenleme yasağı" burada geçerli değil).
Hiçbir şey yapılamadı ama hata da yok: Satır 8 — CLI "up to date" der ama gerçek şema eksik olabilir (örn. elle silinmiş bir tablo). Sessiz başarıya güvenilmez, AC-2'deki şema smoke check (6 tablo + is_admin + 2 RPC sayımı) zorunlu.
Boş sonuç ↔ hata ayrımı: Scraper'ın yaz-oku-sil testinde "0 satır okundu" iki farklı nedenden olabilir — (a) yanlış key (RLS reddi, genelde 401/403/42501 ile görünür) veya (b) push gerçekten hiçbir şey yazmadı. Bunu ayırt etmek için smoke test insert sonrası HATA kodunu da loglar; sessiz 0 satır kabul edilmez.

## Test Strategy
Unit: %10 — env doğrulama fonksiyonu (boş/placeholder değer reddi), smoke check'in parse mantığı.
Integration: %80 — gerçek projeye karşı şema smoke check; service key ile yaz-oku-sil; anon key ile RLS reddi.
E2E: %10 — web dev sunucusu gerçek URL ile bir sayfayı hatasız render eder.

## Benchmark / Başarı Ölçütü
Coverage Target: 80%
Performance Target: ~15 dakika içinde tüm adımlar (login, link, push, env güncelleme, doğrulama) tamamlanır.
Diğer ölçülebilir kriterler:
- `supabase migration list`: 0001 ve 0002 Local=Remote.
- Şema smoke check: 6/6 tablo, `agents.is_admin`, 2/2 RPC bulunur.
- Scraper service key ile 1 test kaydı yazıp okuyor, sonra siliyor.
- Anon key ile `raw_listings` insert reddediliyor.
- Git'te gerçek key yok (detect-secrets / grep ile doğrulanır).

## Kapsam Dışı
- Gerçek emlakçı/abonelik verisi ve seed
- Ödeme entegrasyonu
- Faz 4/5 kodu
- Yeni tablo veya migration (zorunlu düzeltme hariç)
- Production deploy (Vercel, cron)
- Auth provider ayarları (OAuth, e-posta şablonları), Storage bucket'ları
- CI'ya secret ekleme, branching/staging projesi

## Etkilenen Dosyalar/Modüller (bilinen)
- `scraper/.env`, `web/.env.local` (yalnız lokal, commit edilmez)
- `scraper/.env.example`, `web/.env.example`
- `.gitignore` (`.env*` hariç `.env.example`, `supabase/.temp/` kapsamda mı doğrulanacak)
- `supabase/config.toml` (project_id)
- `README.md` (kurulum adımları)
- `scraper/supabase_client.py` (env doğrulaması/placeholder reddi — opsiyonel iyileştirme)
- `web/src/lib/supabase/client.ts`, `server.ts` (env eksikse hata davranışı)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökü `emlak-platform` klasörü, ama üst dizin (`projelerim/`) çok daha geniş ve başka repoları da içeriyor. Sonraki adımlarda (plan/code-copilot/verify) arama her zaman `emlak-platform/` klasörüyle sınırlanmalı; üst dizinden sınırsız `grep -r` veya `git log -p --all` çalıştırılmamalı.

## Rollback Beklentisi
Uygulanmış migration düzenlenmez/silinmez — düzeltme her zaman yeni bir migration (`0003_fix_...`) ile yapılır. Push hata verirse başarısız migration zaten otomatik rollback olur; henüz uygulanmamış o dosya düzeltilip tekrar push edilir. Proje verisiz durumdayken tek istisna: kullanıcının açık onayıyla dashboard'dan "reset database". Env tarafında rollback, eski `.env` yedeğine dönmektir.

## Risks
- Service-role key yanlışlıkla `NEXT_PUBLIC_*` değişkenine veya commit'e girerse, repo public olduğu için anında sızar — tek çözüm key'i Supabase dashboard'dan rotate etmek (geçmişten silmek yetmez).
- Yanlış key (ANON yerine SERVICE_ROLE beklenen yerde) sessizce 0 satır dönebilir, fark edilmeyebilir — bu yüzden yaz-oku-sil smoke testi zorunlu.

## Assumptions
- Kullanıcının zaten bir Supabase hesabı var veya ücretsiz katmanda yeni proje açabilir (varsayım — doğrulanmadı).
- Supabase CLI yerel makinede kurulu değilse kurulum bu görevin kapsamına dahil (varsayım).

## Unknowns
- Supabase proje bölgesi (region) tercihi netleşmedi — Opus alt-ajanı `eu-central-1` önerdi, kullanıcı onayı gerekebilir.

## Sorular ve Cevaplar (ham kayıt)
1. Persona → Proje sahibi geliştirici (tek kişi), dashboard+CLI erişimi var. (Opus low alt-ajanı tarafından yanıtlandı: kurulum yetkisi gerektiriyor)
2. Ana hedef → Placeholder env'den gerçek projeye geçiş, RLS/RPC'nin gerçek ortamda kanıtlanması. (Opus low alt-ajanı tarafından yanıtlandı)
3. Happy path → dashboard'da proje oluştur → login → link → db push --dry-run → db push → migration list → key'leri env'e yaz → smoke test. (Opus low alt-ajanı tarafından yanıtlandı: standart ve en güvenli sıra)
4. Edge case 1 (kısmi/yanlış migration) → migration list ile drift tespiti, şema aynıysa `migration repair`, farklıysa (veri yoksa) reset, veri varsa yeni migration. (Opus low alt-ajanı tarafından yanıtlandı)
5. Edge case 2 (yanlış key) → yaz-oku-sil smoke test ile tespit; ters yönde (service key public'e sızması) build çıktısında grep kontrolü. (Opus low alt-ajanı tarafından yanıtlandı)
6. Davranış sözleşmesi tablosu → yukarıdaki tablo, hiçbir satır silinmedi. (Opus low alt-ajanı tarafından yanıtlandı)
7. Başarı ölçütü → migration list eşitliği + şema smoke check + yaz-oku-sil + RLS reddi + web açılışı + git'te key yokluğu, ~15 dakika. (Opus low alt-ajanı tarafından yanıtlandı)
8. Kapsam dışı → yukarıdaki liste. (Opus low alt-ajanı tarafından yanıtlandı)
9. Bağımlılıklar → yukarıdaki dosya listesi. (Opus low alt-ajanı tarafından yanıtlandı)
10. Güvenlik kısıtı → service-role key yalnız scraper/.env'de, asla NEXT_PUBLIC_*/commit/log'a girmez; detect-secrets + manuel grep. (Opus low alt-ajanı tarafından yanıtlandı)
11. Rollback → uygulanmış migration düzenlenmez, düzeltme yeni migration; istisna: verisiz projede kullanıcı onaylı reset. (Opus low alt-ajanı tarafından yanıtlandı)
12. Test stratejisi → unit 10 / integration 80 / e2e 10. (Opus low alt-ajanı tarafından yanıtlandı: değer gerçek sistemle konuşmakta, mock yanlış güven verir)

Not: Notion mirror adımı atlandı (Saga bağlantısı yok, bu oturumda Saga MCP mevcut değil).
