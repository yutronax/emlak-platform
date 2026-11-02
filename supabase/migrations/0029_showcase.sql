-- 0029_showcase.sql
-- Videolu vitrin: emlakçı teslim edilen videoyu mülk bilgileriyle kendisi yayınlar.
-- Telefon vitrinde görünür; yayın için emlakçının açık onayı (showcase_phone_consent_at) zorunlu.
-- Okuma yalnız sunucudan (servis rolü) showcase_items görünümüyle; anon/authenticated'a açık değil.
-- Idempotent. Rollback: 0029_showcase.down.sql

alter table public.properties add column if not exists deal text;
alter table public.properties add column if not exists price_minor bigint;
alter table public.properties add column if not exists city text;
alter table public.properties add column if not exists district text;
alter table public.properties add column if not exists rooms text;
alter table public.properties add column if not exists area_m2 integer;
alter table public.properties add column if not exists floor text;
alter table public.properties add column if not exists building_age integer;
alter table public.properties add column if not exists heating text;
alter table public.properties add column if not exists description text;

alter table public.property_videos add column if not exists duration_sec integer;

alter table public.agents add column if not exists showcase_phone_consent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_showcase_check') then
    alter table public.properties add constraint properties_showcase_check check (
      (deal is null or deal in ('satilik', 'kiralik'))
      and (price_minor is null or price_minor between 1 and 100000000000000)
      and (city is null or char_length(btrim(city)) between 1 and 60)
      and (district is null or char_length(btrim(district)) between 1 and 60)
      and (rooms is null or rooms ~ '^[0-9]{1,2}\+[0-9]{1,2}$')
      and (area_m2 is null or area_m2 between 1 and 100000)
      and (floor is null or char_length(floor) <= 40)
      and (building_age is null or building_age between 0 and 300)
      and (heating is null or char_length(heating) <= 60)
      and (description is null or char_length(description) <= 3000)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'property_videos_duration_check') then
    alter table public.property_videos add constraint property_videos_duration_check
      check (duration_sec is null or duration_sec between 1 and 7200);
  end if;
end $$;

-- Vitrin görünümü: yalnız yayında, bilgileri tam, sahibi askıda olmayan ve telefon onayı veren emlakçıların videoları.
create or replace view public.showcase_items
with (security_invoker = true) as
select
    pv.id,
    pv.published_at,
    pv.storage_path,
    coalesce(pv.duration_sec, 0) as duration_sec,
    p.title,
    p.deal,
    p.price_minor,
    p.city,
    coalesce(p.district, '') as district,
    p.rooms,
    split_part(p.rooms, '+', 1)::integer as room_count,
    p.area_m2,
    p.floor,
    p.building_age,
    p.heating,
    coalesce(p.description, '') as description,
    a.company_name as agent_name,
    a.phone as agent_phone
from public.property_videos pv
join public.properties p on p.id = pv.property_id
join public.agents a on a.id = p.agent_id
where pv.status = 'published'
  and pv.published_at is not null
  and a.suspended_at is null
  and a.showcase_phone_consent_at is not null
  and a.phone is not null
  and p.deal is not null and p.price_minor is not null and p.city is not null
  and p.rooms is not null and p.area_m2 is not null;

revoke all on public.showcase_items from public, anon, authenticated;
grant select on public.showcase_items to service_role;

create index if not exists property_videos_published_idx on public.property_videos (published_at desc) where status = 'published';
