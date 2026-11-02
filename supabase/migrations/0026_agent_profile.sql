-- 0026_agent_profile.sql
-- kullanici-profili backend'i: profil alanları, bildirim tercihleri, logo deposu ve agents güncelleme yetkisinin
-- sütun bazına indirilmesi. Idempotent. Rollback: 0026_agent_profile.down.sql

-- 1) Profil ve bildirim alanları.
alter table public.agents add column if not exists contact_name text;
alter table public.agents add column if not exists city text;
alter table public.agents add column if not exists district text;
alter table public.agents add column if not exists logo_path text;
alter table public.agents add column if not exists notify_new_listing_push boolean not null default true;
alter table public.agents add column if not exists notify_new_listing_email boolean not null default false;
alter table public.agents add column if not exists notify_video_order_email boolean not null default true;
alter table public.agents add column if not exists notify_weekly_summary_email boolean not null default false;

-- Biçim kısıtları. Telefon mevcut biçimde (+90'sız 10 hane, 5 ile başlar) tutulur; UI +90 gösterir.
-- NOT VALID: eski satırlar migration'ı düşürmesin, yeni yazmalar zorunlu.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agents_phone_format') then
    alter table public.agents add constraint agents_phone_format check (phone is null or phone ~ '^5[0-9]{9}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agents_company_name_len') then
    alter table public.agents add constraint agents_company_name_len check (char_length(btrim(company_name)) between 2 and 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agents_contact_name_len') then
    alter table public.agents add constraint agents_contact_name_len check (contact_name is null or char_length(btrim(contact_name)) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agents_city_len') then
    alter table public.agents add constraint agents_city_len check (city is null or char_length(btrim(city)) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agents_district_len') then
    alter table public.agents add constraint agents_district_len check (district is null or char_length(btrim(district)) <= 60);
  end if;
  -- Logo yolu sahibin klasöründe olmalı: "<agent_id>/logo.<uzantı>".
  if not exists (select 1 from pg_constraint where conname = 'agents_logo_path_owner') then
    alter table public.agents add constraint agents_logo_path_owner check (logo_path is null or logo_path like id::text || '/%');
  end if;
end $$;

-- 2) Güncelleme yetkisi sütun bazında. Önceden authenticated kendi satırındaki HER sütunu (terms_*, wa_consent_*,
--    trial_started_at, listings_seen_at) REST ile değiştirebiliyordu; bu sütunları yalnız SECURITY DEFINER fonksiyonlar
--    (start_trial, accept_wa_consent, mark_listings_seen) ve kayıttaki INSERT yazar. RLS (agents_self_update) satırı,
--    bu grant'ler sütunları sınırlar; is_admin/id/created_at tetikleyicisi yerinde kalır.
revoke update on table public.agents from anon, authenticated;
grant update (
  company_name, phone, contact_name, city, district, logo_path,
  notify_new_listing_push, notify_new_listing_email, notify_video_order_email, notify_weekly_summary_email
) on public.agents to authenticated;

-- 3) Logo deposu: özel bucket, 2 MB, png/jpeg/webp. Nesne yolu "<auth.uid()>/..." ile sınırlı.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-logos', 'agent-logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agent_logos_owner_select on storage.objects;
drop policy if exists agent_logos_owner_insert on storage.objects;
drop policy if exists agent_logos_owner_update on storage.objects;
drop policy if exists agent_logos_owner_delete on storage.objects;

create policy agent_logos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy agent_logos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy agent_logos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy agent_logos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'agent-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
