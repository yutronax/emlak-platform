# Plan — fingerprint-unique-constraint
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — Python/SQL, hiçbir
`.tsx`/`.jsx`/`.vue`/`.css`/sayfa bileşeni yok, "Görsel/UI kriteri" boş).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| scraper/supabase_client.py | `insert_raw_listing`'i atomik `upsert(..., on_conflict="fingerprint", ignore_duplicates=True)`'e çevir, dönüş değerine `inserted: bool` ekle (AC-2, AC-3, AC-5) | medium | backend |
| scraper/orchestrator.py | `handle_message`'daki `insert_raw_listing` çağrısının yeni dönüş değerine göre log satırını ayarla — "yazıldı" vs "mükerrer, atlandı" ayrımı artık ön-kontrole değil gerçek DB sonucuna dayanıyor (AC-6) | low | backend |

## New Files
| File | Purpose |
|------|---------|
| supabase/migrations/0007_raw_listings_fingerprint_unique.sql | `raw_listings.fingerprint` kolonuna unique index ekler (AC-1); mevcut `raw_listings_fingerprint_idx` normal index'i kaldırıp yerine unique index koyar (aynı kolonda iki index tutmaya gerek yok) |

## Dependencies
- `scraper/supabase_client.py`'nin `get_client()` fonksiyonu değişmiyor —
  sadece `insert_raw_listing` değişiyor.
- `scraper/orchestrator.py`'deki `fingerprint_exists()` ön-kontrolü
  KALDIRILMIYOR — hızlı-yol optimizasyonu olarak kalıyor (Gemini parse
  çağrısından SONRA, gereksiz bir upsert denemesini önlemek için); asıl
  doğruluk garantisi artık DB'deki unique constraint + atomik upsert'te.
- `requirements.txt`'teki `supabase>=2.6.0` zaten `upsert(...,
  on_conflict=..., ignore_duplicates=True)` parametrelerini destekliyor
  (PostgREST `Prefer: resolution=ignore-duplicates` karşılığı) — yeni
  bağımlılık gerekmiyor.
- `source_message_id` üzerindeki mevcut unique index (`raw_listings_source_message_idx`,
  partial WHERE source_message_id is not null) DOKUNULMUYOR, bu görevin
  konusu değil.

## Migration Required?
**Evet — Kararlar (customer onayıyla, Seçenek b).** Önce temizlik, sonra
PARTIAL unique index (hard-delete DEĞİL, soft/`status='rejected'` tercih
edilir — customer'ın iki ek şartı: (1) temizlenen satır sayısı audit için
görünür olmalı, (2) soft-delete hard-delete'e tercih edilir).

`supabase/migrations/0007_raw_listings_fingerprint_unique.sql`:
```sql
-- 1) Temizlik: her mükerrer fingerprint grubunda en eski satır (created_at
--    en küçük) dışındakileri 'rejected' durumuna çek (soft, silme yok).
--    DO bloğu ile etkilenen satır sayısını audit için RAISE NOTICE'e yazar.
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

-- 2) Mevcut normal index'i kaldır, PARTIAL unique index ile değiştir —
--    'rejected' satırlar mükerrer fingerprint taşıyabilir (soft-delete
--    sonucu), unique kısıtı sadece aktif (pending/approved) satırlara uygulanır.
drop index if exists raw_listings_fingerprint_idx;
create unique index raw_listings_fingerprint_unique_idx
    on raw_listings (fingerprint)
    where status <> 'rejected';
```
Proje migration'ları `supabase/migrations/` altında numaralı dosyalar
olarak tutuluyor (0001-0006 mevcut) — bu desene uyulacak, numara 0007.

**Teknik not — PARTIAL index + PostgREST upsert (code-copilot'a talimat):**
PostgREST'in `upsert(..., on_conflict="fingerprint")` parametresi normal
(tam tablo) bir unique constraint/index hedefler; PARTIAL bir unique
index'i (`where status <> 'rejected'`) `on_conflict` parametresiyle hedef
almak PostgREST sürümüne göre desteklenmeyebilir. Bu yüzden
`insert_raw_listing` şu deseni kullanmalı: ÖNCE normal `insert()` dene,
eğer Postgres unique-violation hatası (23505) dönerse bunu YAKALA ve
`inserted=False` olarak değerlendir (exception'ı yutma, ama 23505 DIŞINDA
bir hata ise yukarı fırlat — AC-5'i korur). Bu, atomikliği upsert syntax'ı
yerine try/except ile sağlar ama DB seviyesindeki garanti (AC-3) aynı
kalır — unique index zaten DB'de, hangi Python deseni kullanılırsa
kullanılsın race condition'ı engeller.

~~Eski basit yaklaşım (Supabase MCP yetkilendirilmediği için canlı
doğrulanamamıştı, artık kullanılmıyor — customer (b) seçeneğini onayladı):
doğrudan unique index, mükerrer varsa migration FAIL.~~

## Risks
(atdd.md'den taşınan + bu adımda netleşen)
- Kabul edilen risk (threat-model): kasıtlı fingerprint çakıştırma — bu
  görevin yarattığı değil, DB seviyesinde garanti ediliyor.
- **YENİ (bu adımda bulundu):** Migration, tabloda mevcut mükerrer
  fingerprint varsa başarısız olur — bkz. Open Questions, bu kullanıcıya
  sorulmadan "muhtemelen yok" varsayımıyla geçilemez çünkü migration
  başarısız olursa `verify`'ın `supabase-check` gate'i bunu FAIL olarak
  bulacak ve iş geri dönecek (pahalı bir tekrar turu).

## Open Questions
1. **`raw_listings` tablosunda şu an mükerrer fingerprint'li satır var mı?**
   Bu oturumda Supabase MCP yetkilendirilmediği için canlı sorgu
   atılamadı (atdd.md'nin Unknowns bölümünden taşındı, bu adımın kendi
   keşfi de çözemedi — kod okuma bunu cevaplayamaz, gerçek veriye bakmak
   gerekiyor). Migration SQL'i buna göre iki şekilde yazılabilir:
   - **(a)** Kullanıcı "mükerrer yok, direkt unique index'i dene" derse:
     migration yukarıdaki basit haliyle yazılır, başarısız olursa
     `verify`/`supabase-check` bunu yakalar ve bildirir.
   - **(b)** Kullanıcı "emin değilim, güvenli tarafta kal" derse:
     migration önce `SELECT fingerprint, count(*) FROM raw_listings GROUP
     BY fingerprint HAVING count(*) > 1` ile mükerrerleri tespit edip
     (ör. en eski satırı tutup diğerlerini `status='rejected'` yapan veya
     silen) bir temizlik adımı içerir, SONRA unique index oluşturur —
     bu, code-copilot'un ekstra bir SQL bloğu yazmasını gerektirir.
   Lütfen yanıtlayın ya da "sen karar ver" deyin.
