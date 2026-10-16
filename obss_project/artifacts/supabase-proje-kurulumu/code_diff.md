# Code Diff — supabase-proje-kurulumu

## Oluşturulan dosyalar
- `scraper/scripts/verify_supabase.py` (215 satır) — şema smoke check (AC-2), yaz-oku-sil (AC-3), RLS reddi (AC-4). Saf karar fonksiyonları (`evaluate_schema`, `schema_missing`, `evaluate_write_read`, `describe_write_read`, `evaluate_rls_rejection`, `overall_verdict`) I/O'dan ayrı; `check_schema`/`check_write_read`/`check_rls_rejection` client alır; `main()` ikisini birleştirip PASS/FAIL raporu basar, `sys.exit(1)` FAIL'de.

## Değiştirilen dosyalar
- `.env.example`: `SUPABASE_ANON_KEY=` satırı eklendi.

## Acceptance Criteria karşılanması
- **AC-2:** `check_schema` 6 tabloyu `select().limit(1)` ile, `is_admin`'i ayrı select ile, 2 RPC'yi `rpc(name, {"p_raw_listing_id": nil-uuid})` çağırıp "bulunamadı" hata metnini (0002_admin_review.sql'deki RAISE mesajı — yan etkisiz, migration'ı okuyup doğruladım) "fonksiyon var" kanıtı sayarak doğrular.
- **AC-3:** `check_write_read` UUID4 id ile `raw_listings`'e NOT NULL alanları dolu bir kayıt yazar, okur, siler; `error`/`empty`/`ok` durumları ayrı dallarda.
- **AC-4:** `check_rls_rejection` anon client ile insert dener; başarılı olursa (RLS atlanmış) `main()` "temizlenemedi" uyarısı basar, çökmez.
- **Kısmi/sessiz başarı:** `overall_verdict` üç kontrolün AND'i; boş/eksik kanıt her yerde FAIL.

## Bağımsız doğrulama (code-copilot'un kendi raporuna güvenilmedi)
Backend-copilot alt-ajanı testleri geçici bir stub `supabase` paketiyle çalıştırdığını bildirmişti (gerçek SDK kurulu değildi diye). Ben ayrı bir geçici venv'de **gerçek** `supabase`+`pytest` paketlerini kurup testleri yeniden çalıştırdım:
```
34 passed, 3 skipped in 1.00s
```
Sonuç alt-ajanın raporuyla birebir eşleşti. Geçici venv silindi, repoya hiçbir bağımlılık eklenmedi (requirements.txt'teki `supabase>=2.6.0` zaten yeterli).

## Kod incelemesi (DoD kontrolü)
- Tek dosya, spekülatif soyutlama yok, her sabit/yardımcı kullanılıyor.
- TODO/FIXME/placeholder/ölü kod yok.
- Her davranış-sözleşmesi dalı (tablo eksik / is_admin eksik / RPC eksik / yaz hatası / okuma boş / silme başarısız / RLS atlanmış) kendi ayrı `try/except` veya `if` dalında — genel bir `except Exception: pass` ile birden fazla durum birleştirilmemiş.
- Fallback her yerde pessimist (belirsizlik = FAIL).

## Kalan sınırlamalar
- atdd.md'nin Davranış Sözleşmesi tablosundaki CLI satırları (supabase link/db push exit kodları) bu Python script'in kapsamı dışında — onlar gerçek CLI komutlarının kendi davranışı, elle çalıştırılacak (aşağıdaki "Sıradaki insan adımı" bölümü).
- `check_schema`'nın RPC kontrolü gerçek PostgREST hata formatına dayanıyor, test dosyası bunu mock'luyor ama gerçek projede ayrıca doğrulanmalı (ilk `main()` çalıştırmasında görülecek).
- `get_client()` (scraper/supabase_client.py, değiştirilmedi) env eksikse KeyError ile çöker — bu görevin kapsamı dışında bırakıldı (plan.md'de "opsiyonel iyileştirme" olarak not edilmişti).

## Sıradaki insan adımı (script'in kapsamadığı, kullanıcının yapması gereken)
1. supabase.com'da proje oluştur (bölge: eu-central-1, karar plan.md'de).
2. `npx supabase login` + `npx supabase link --project-ref <ref>`.
3. `npx supabase db push`.
4. `.env`'e gerçek `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` yaz (commit edilmez).
5. `cd scraper && python -m scripts.verify_supabase` — GENEL: PASS beklenir.
