-- 0026_agent_profile.down.sql — 0026'yı geri alır. Logo nesneleri silinmez (bucket boş değilse elle temizlenmeli).

drop policy if exists agent_logos_owner_select on storage.objects;
drop policy if exists agent_logos_owner_insert on storage.objects;
drop policy if exists agent_logos_owner_update on storage.objects;
drop policy if exists agent_logos_owner_delete on storage.objects;

-- Önceki (geniş) güncelleme yetkisi geri verilir.
grant update on table public.agents to authenticated;

alter table public.agents drop constraint if exists agents_logo_path_owner;
alter table public.agents drop constraint if exists agents_district_len;
alter table public.agents drop constraint if exists agents_city_len;
alter table public.agents drop constraint if exists agents_contact_name_len;
alter table public.agents drop constraint if exists agents_company_name_len;
alter table public.agents drop constraint if exists agents_phone_format;

alter table public.agents drop column if exists notify_weekly_summary_email;
alter table public.agents drop column if exists notify_video_order_email;
alter table public.agents drop column if exists notify_new_listing_email;
alter table public.agents drop column if exists notify_new_listing_push;
alter table public.agents drop column if exists logo_path;
alter table public.agents drop column if exists district;
alter table public.agents drop column if exists city;
alter table public.agents drop column if exists contact_name;
