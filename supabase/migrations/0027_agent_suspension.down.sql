-- 0027_agent_suspension.down.sql — fonksiyonlardaki askı kontrolleri, suspended_at kalkınca hata verir;
-- önce 0027 öncesi fonksiyon tanımları (0020-0024 migration'ları) yeniden uygulanmalı, sonra:
drop index if exists public.agents_created_at_idx;
alter table public.agents drop column if exists suspended_at;
