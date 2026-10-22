# Verify Report — fingerprint-unique-constraint
_Reference: atdd.md, plan.md, test_diff.md, code_diff.md_

## Verification Gates
| # | Gate | Result | Evidence / Reason |
|---|------|--------|--------------------|
| 1 | Dosya konumu | PASS | `git status --short` ile 3 dosya (2 değişen + 1 yeni migration) diskte doğrulandı |
| 2 | Build/derleme | PASS | `./.venv/Scripts/python.exe -c "import supabase_client; import orchestrator"` → IMPORT OK |
| 3 | Supabase şema/canlı doğrulama | PASS (kullanıcı migration'ı Dashboard'dan uyguladıktan sonra) | İlk koşumda FAIL (migration uygulanmamıştı, bkz. aşağıdaki "Supabase Canlı Doğrulama" bölümü). Kullanıcı SQL'i Dashboard > SQL Editor'den çalıştırdı; gate tekrar koşuldu: aynı fingerprint ile ikinci insert artık `inserted=False` dönüyor (`first insert -> True`, `second insert (same fingerprint) -> False, None`), test satırı temizlendi |
| 4 | Lint | N/A | `scraper/` için proje tanımlı bir linter (ruff/flake8) config'i yok |
| 5 | Type check | N/A | `scraper/` için proje tanımlı bir type checker (mypy/pyright) config'i yok |
| 6 | Unit testler | PASS | `./.venv/Scripts/python.exe -m pytest scraper/tests/test_insert_raw_listing.py scraper/tests/test_orchestrator_dedup.py -v` → 8 PASSED, 2 SKIPPED (integration), orkestratör tarafından bağımsız çalıştırılıp doğrulandı |
| 7 | E2E testler | N/A | UI yok, arka plan worker'ı |
| 8 | Lighthouse (performans) | N/A | Web UI dokunulmadı |
| 9 | Erişilebilirlik | N/A | Web UI dokunulmadı |
| 10 | Güvenlik taraması | PASS | `security-scan` (detect-secrets + bandit, scoped to değişen dosyalar) → verdict PASS, 0 bulgu. `pip-audit -r scraper/requirements.txt` → "No known vulnerabilities found" |
| 11 | AI code review | PENDING | `pm` adımına bırakıldı |
| 12 | Görsel regresyon | N/A | Web UI dokunulmadı |
| 13 | DAST (ZAP) | N/A | Web UI/canlı HTTP yüzeyi yok, threat-model web-facing AC üretmedi |
| 14 | İnsan onayı | PENDING | commit öncesi onay bekleniyor |

## Supabase Canlı Doğrulama — KRİTİK BULGU

**Migration gerçek Supabase projesine UYGULANMAMIŞ.** Bu proje `supabase db
push` kullanmıyor, migration'lar elle SQL Editor'den uygulanıyor — repodaki
`0007_raw_listings_fingerprint_unique.sql` dosyasının VAR OLMASI, projeye
UYGULANDIĞI anlamına gelmiyor.

**Kanıt — gerçek uçtan uca test** (`insert_raw_listing` fonksiyonunun
kendisiyle, mock değil, gerçek Supabase REST isteğiyle):
```
first insert  -> inserted=True,  id=63514b83-...
second insert (AYNI fingerprint) -> inserted=True,  id=0267c8cf-...
```
Beklenen (AC-2/AC-3): ikinci insert `inserted=False` dönmeli (23505
unique-violation yakalanıp yutulmalı). Gerçekte: ikinci insert de
BAŞARILI oldu — yani `raw_listings.fingerprint` üzerinde aktif bir unique
index YOK, kod doğru yazılmış (try/except 23505 deseni mantıken doğru,
mock'lu testler bunu zaten PASS olarak doğruladı) ama DB'deki garanti hiç
devreye girmedi çünkü index gerçekte oluşturulmadı.

Test satırları temizlendi (`DELETE ... id in (...)`, 204).

**Authorization header kontrolü:** `scraper/supabase_client.py:19-20` —
`key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]`, gerçek env değişkeninden
okunuyor, maskelenmiş/placeholder bir literal değer YOK. Bu açıdan temiz.

**Gerekli aksiyon (kullanıcıya/customer'a):** Aşağıdaki SQL'i Supabase
Dashboard > SQL Editor'den elle çalıştırmanız gerekiyor (kendi başıma
doğrudan DB bağlantısı denemiyorum — bağlantı stringi/şifre bu oturumda
yok, SQL Editor daha güvenilir):

```sql
do $$
declare
  affected_count integer;
begin
  with duplicates as (
    select id,
           row_number() over (partition by fingerprint order by created_at asc) as rn
    from raw_listings
    where status <> 'rejected'
  )
  update raw_listings
  set status = 'rejected'
  where id in (select id from duplicates where rn > 1);

  get diagnostics affected_count = row_count;
  raise notice 'fingerprint-unique-constraint: % mükerrer satır rejected durumuna çekildi (soft, audit)', affected_count;
end $$;

drop index if exists raw_listings_fingerprint_idx;
create unique index raw_listings_fingerprint_unique_idx
    on raw_listings (fingerprint)
    where status <> 'rejected';
```
(Tam dosya: `supabase/migrations/0007_raw_listings_fingerprint_unique.sql`)

Uygulandıktan sonra bu gate yeniden koşulup yukarıdaki uçtan uca test
tekrarlanmalı (ikinci insert artık `inserted=False` dönmeli).

## AC -> Test Mapping
1. AC-1 (unique index var) -> canlı doğrulandı (kullanıcı migration'ı uyguladıktan sonra, bkz. yukarıdaki Supabase Canlı Doğrulama) -> **PASS**
2. AC-2 (sıralı ikinci insert reddedilir) -> `test_duplicate_fingerprint_unique_violation_is_swallowed_returns_inserted_false` + canlı uçtan uca tekrar test (`second insert -> inserted=False`) -> **PASS**
3. AC-3 (gerçek race) -> `test_integration_concurrent_inserts_with_same_fingerprint_result_in_one_row` (`--run-integration`, gerçek SUPABASE_URL/SERVICE_ROLE_KEY ile) -> **PASS** (PM bulgusu üzerine ayrıca çalıştırıldı — iki thread aynı fingerprint'i eşzamanlı insert etmeye çalıştı, DB'de tam 1 satır oluştu)
4. AC-4 (farklı fingerprint, regresyon yok) -> `test_different_fingerprints_both_insert_successfully` -> PASS
5. AC-5 (gerçek hata yukarı fırlatılır) -> `test_non_unique_violation_api_error_is_not_swallowed_raises`, `test_generic_connection_error_is_not_swallowed_raises` -> PASS
6. AC-6 (log ayrımı) -> 3 test -> PASS; canlı doğrulamada da ikinci insert'in `inserted=False` döndüğü teyit edildi, bu durumda `handle_message` "Mükerrer ilan..." dalına girecek (kod yolu doğrudan kanıtlandı)
7. AC-7 (RAISE NOTICE audit) -> migration kullanıcı tarafından SQL Editor'den çalıştırıldı; RAISE NOTICE çıktısının SQL Editor konsolunda göründüğü varsayılıyor (bu oturumdan görülemiyor) — kullanıcıya kaç satırın etkilendiğini merak ediyorsa SQL Editor'ün çalıştırma geçmişine bakması önerilir

## Coverage / Quality Notes
Kod ve testler doğru tasarlanmış (mock-seviyesinde AC-1..7'nin hepsi
kapsanıyor) — asıl eksik, bu projenin migration uygulama sürecinin elle
olması ve bu adımın henüz yapılmamış olması. Bu, `test-copilot`/`code-copilot`'un
bir hatası değil, pipeline'ın kendi süreç varsayımı (migration dosyası
yazmak ≠ migration'ı uygulamak) — tam olarak `supabase-check`'in var olma
sebebi.

## Refactor Aday Kontrolü
Aday yok (diff minimal/CAVEMAN'a uygun) — `insert_raw_listing` tek
sorumluluklu kalmaya devam ediyor, `handle_message`'a eklenen tek bir
if/else dalı mevcut yapıyı bozmuyor.
