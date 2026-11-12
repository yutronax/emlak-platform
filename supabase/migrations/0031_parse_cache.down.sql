-- 0031_parse_cache.down.sql
-- 0031_parse_cache.sql geri alma. Yalnız hızlandırıcı tablo kaldırılır; ilan kayıtlarına dokunmaz.
-- Geri almadan önce GEMINI_PARSE_OPTIMIZATION_ENABLED=false yapılmalıdır.

drop index if exists public.parse_cache_expires_idx;
drop table if exists public.parse_cache;
