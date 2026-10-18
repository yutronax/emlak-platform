# Code Diff — pricing-plans-sort-order-fix

## Oluşturulan dosyalar
- `supabase/migrations/0006_plans_sort_order.sql` — `plans` tablosuna
  `sort_order integer not null default 0` ekler, mevcut satırları
  `price_minor_unit asc, created_at asc` sırasına göre backfill eder
  (`row_number() over (...)`). Doğrulandı (`Read`): verilen SQL birebir.

## Değiştirilen dosyalar
- `web/src/test/fake-supabase.ts` — `FakeQuery`'ye `order(column, {ascending})`
  (sıralamayı `execute()`'ta "many" modunda uygular) ve `returns<T>()`
  (no-op) eklendi. Doğrulandı (`Read`): diğer metodlar (select/eq/insert/
  update/single/maybeSingle) değişmemiş, test dosyalarına dokunulmamış.

## AC karşılanma durumu
| AC | Durum |
|---|---|
| AC-1 (happy path, sıralı render) | Karşılandı — page.test.tsx zaten PASS, migration + backfill gerçek DB için hazır |
| AC-2 (şema: integer/not null/default 0) | Karşılandı — migration testi (dosya-sistemi kontrolü) artık PASS |
| AC-3 (boş liste) | Karşılandı — page.tsx zaten doğru |
| AC-4 (42703 regresyon) | Karşılandı — page.tsx zaten doğru |
| AC-5 (backfill sıralaması farklı/fiyat sırasına uygun) | Migration'da `row_number()` ile her satıra benzersiz, fiyata göre artan bir değer atanıyor — gerçek DB'de doğrulanması gerekiyor (bkz. Kalan Sınırlamalar) |

## Kalan sınırlamalar / doğrulanamayanlar
- Migration gerçek Supabase projesine HENÜZ uygulanmadı — bu, `verify`/
  `supabase-check` adımında yapılacak (atdd.md'nin Integration test
  stratejisinin %60'ı tam olarak bunu kapsıyor).
- `fake-supabase.ts`'in `.order()` implementasyonu test ortamında
  doğrulandı (44 test PASS, red→green dönüşü migration testinde teyit
  edildi); gerçek Supabase PostgREST `.order()` davranışıyla bire bir
  eşleşmesi ayrıca integration testiyle teyit edilmeli.

## Varsayımlar
- Yok (Opus alt-ajanının plan.md'de belirlediği backfill sıralaması
  birebir uygulandı).

## CAVEMAN self-review
- Yeni dosya: sadece 1 migration dosyası (gerekli, kaçınılmaz).
- Yeni soyutlama/yardımcı fonksiyon: yok — `order()`/`returns()` doğrudan
  var olan `FakeQuery` sınıfına eklendi, ayrı bir dosya/sınıf açılmadı.
- Gereksiz config/placeholder/TODO: yok.
