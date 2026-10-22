# Code Diff — fingerprint-unique-constraint

## Değişen/Yeni Dosyalar
- `supabase/migrations/0007_raw_listings_fingerprint_unique.sql` (yeni) — soft temizlik (DO bloğu + RAISE NOTICE) + PARTIAL unique index (`where status <> 'rejected'`), customer'ın (b) kararına ve audit/soft-delete şartlarına birebir uygun.
- `scraper/supabase_client.py` — `insert_raw_listing` artık try/except 23505 deseniyle atomik, `(dict|None, bool)` döndürüyor. 23505 dışı hatalar yukarı fırlatılıyor.
- `scraper/orchestrator.py` — `handle_message`, yeni dönüş değerine göre "yazıldı" / "Mükerrer ilan (fingerprint çakışması, DB seviyesinde atlandı)" ayrı log satırları üretiyor (mevcut `fingerprint_exists` ön-kontrolünün log metninden kasıtlı olarak farklı).

## Davranış Sözleşmesi Karşılanma Durumu
| AC | Durum |
|---|---|
| AC-1 | ✅ (migration, integration testiyle doğrulanacak) |
| AC-2 | ✅ |
| AC-3 | ✅ (integration testiyle doğrulanacak) |
| AC-4 | ✅ |
| AC-5 | ✅ |
| AC-6 | ✅ |
| AC-7 | ✅ (RAISE NOTICE eklendi, migration çalıştırıldığında doğrulanacak) |

## Doğrulama
`scraper/.venv/Scripts/python.exe -m pytest scraper/tests/test_insert_raw_listing.py scraper/tests/test_orchestrator_dedup.py -v` → 8/8 unit PASS, 2 integration SKIP (orkestratör tarafından bağımsız olarak tekrar çalıştırıldı ve doğrulandı).

## Test Dosyalarına Dokunulmadı
Doğrulandı — sadece implementasyon dosyaları değişti.

## Kalan Sınırlamalar
- Integration testleri (AC-3: gerçek eşzamanlılık, AC-1: gerçek migration doğrulaması) bu oturumda Supabase MCP yetkilendirilmediği için çalıştırılamadı — `verify` adımında `supabase-check` ile ele alınmalı, aksi halde bu iki AC pratikte doğrulanmamış kalır.
- Migration'ın gerçek projede uygulanıp uygulanmadığı (ve RAISE NOTICE'in gerçekten kaç satır etkilediği) bu oturumda görülemedi — aynı şekilde `supabase-check`'e bırakıldı.
