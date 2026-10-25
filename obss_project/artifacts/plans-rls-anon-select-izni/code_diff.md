# Code Diff — plans-rls-anon-select-izni

## Oluşturulan Dosya
`supabase/migrations/0010_plans_anon_select.sql` (yeni)
```sql
-- 0010_plans_anon_select.sql
-- plans fiyat kataloğu herkese açık bilgi; anonim ziyaretçi de görebilmeli.
drop policy if exists plans_authenticated_select on plans;

create policy plans_public_select on plans
    for select to anon, authenticated using (true);
```
`Read` ile doğrulandı — plan.md'nin "Migration İçeriği" bölümüyle birebir eşleşiyor. `for select` (NOT `for all`) — threat-model'in AC-S2'de uyardığı en kritik yanlış-uygulama riski kod seviyesinde önlenmiş.

## AC Karşılama
- AC-1/AC-2: policy `anon, authenticated` ikisini de kapsıyor — kod seviyesinde doğru, gerçek doğrulama `verify` adımında migration uygulanıp testler koşulduğunda.
- AC-S1/AC-S2: `for select` tek başına, başka bir cmd yok — statik olarak doğru.
- AC-S3: zaten `plan` adımında kod okunarak doğrulanmıştı (hassas sütun yok).

## Değiştirilmeyen
Diğer migration dosyaları (0001-0009), test dosyası (`test_plans_rls_anon_select.py`) — `git status` ile doğrulandı, sadece 1 yeni dosya (`??` untracked).

## Kalan Sınırlamalar
- Migration henüz gerçek Supabase projesine uygulanmadı — bu `verify` adımının (supabase-check gate) işi.
- Ters/rollback migration'ı henüz yazılmadı (atdd.md Rollback Beklentisi'nde bir sorun çıkarsa yazılacağı not edilmişti, bu görev kapsamında proaktif üretilmedi — gerekirse `verify` sonrası ayrı adım).

## CAVEMAN Self-Review
Tek dosya, tek SQL ifadesi, mevcut proje stiline uygun (yorum + düz SQL). Soyutlama/yardımcı fonksiyon yok, gereksiz dosya yok.

## Red-team Sonrası Ek Dosya (2026-10-25)
`supabase/rollback/0010_plans_anon_select_rollback.sql` eklendi (red-team finding 3) — `plans_public_select`'i DROP edip eski `plans_authenticated_select`'i yeniden CREATE eden ters migration. `supabase/migrations/` dışında, ayrı bir `rollback/` dizininde — otomatik uygulanmaz, sadece acil durumda elle/manuel referans.
