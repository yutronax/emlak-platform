-- 0029_showcase.down.sql
drop index if exists public.property_videos_published_idx;
drop view if exists public.showcase_items;
alter table public.property_videos drop constraint if exists property_videos_duration_check;
alter table public.properties drop constraint if exists properties_showcase_check;
alter table public.agents drop column if exists showcase_phone_consent_at;
alter table public.property_videos drop column if exists duration_sec;
alter table public.properties drop column if exists description;
alter table public.properties drop column if exists heating;
alter table public.properties drop column if exists building_age;
alter table public.properties drop column if exists floor;
alter table public.properties drop column if exists area_m2;
alter table public.properties drop column if exists rooms;
alter table public.properties drop column if exists district;
alter table public.properties drop column if exists city;
alter table public.properties drop column if exists price_minor;
alter table public.properties drop column if exists deal;
