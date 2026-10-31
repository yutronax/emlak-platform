-- 0024_wa_groups_personal_listings.down.sql
-- 0024 geri alma. Kişisel veri varsa İPTAL edilir (sessiz silme yok): önce operatör
-- kişisel kayıtları bilinçli olarak temizlemeli. Ortak ilanlar etkilenmez.
-- Uyarı: frontend ve sidecar commit'leri de geri alınmalı; aksi halde RPC'ler yok olur.

do $$
begin
    if exists (select 1 from raw_listings where owner_agent_id is not null)
       or exists (select 1 from listings where owner_agent_id is not null) then
        raise exception '0024 down iptal: kişisel ilan kayıtları (owner_agent_id dolu) mevcut';
    end if;
end $$;

-- 1) RPC'ler
drop function if exists delete_my_wa_data();
drop function if exists upsert_wa_groups(uuid, jsonb);
drop function if exists ingest_personal_listing(uuid, jsonb);
drop function if exists set_sidecar_counters(jsonb);
drop function if exists bump_sidecar_counter(text);
drop function if exists admin_get_threshold();
drop function if exists admin_set_threshold(numeric);
drop function if exists set_my_wa_group_selection(text[]);
drop function if exists get_my_wa_groups();

-- 2) Trigger ve yardımcı fonksiyon
drop trigger if exists listings_owner_immutable on listings;
drop trigger if exists raw_listings_owner_immutable on raw_listings;
drop function if exists owner_agent_id_immutable();

-- 3) approve_raw_listing: 0016 hali (owner yok)
create or replace function approve_raw_listing(p_raw_listing_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_parsed jsonb;
    v_source_group_name text;
    v_listing_id uuid;
begin
    select parsed, source_group_name into v_parsed, v_source_group_name
    from raw_listings
    where id = p_raw_listing_id and status = 'pending';

    if v_parsed is null then
        raise exception 'raw_listing bulunamadı veya zaten incelenmiş: %', p_raw_listing_id;
    end if;

    insert into listings (raw_listing_id, title, price, currency, rooms, area_m2, city, district, neighborhood, description, source_group_name)
    values (
        p_raw_listing_id,
        coalesce(v_parsed->>'title', trim(concat(v_parsed->>'rooms', ' ', v_parsed->>'district', ' ', v_parsed->>'city'))),
        (v_parsed->>'price')::numeric,
        coalesce(v_parsed->>'currency', 'TRY'),
        v_parsed->>'rooms',
        (v_parsed->>'area_m2')::numeric,
        v_parsed->>'city',
        v_parsed->>'district',
        v_parsed->>'neighborhood',
        v_parsed->>'description',
        v_source_group_name
    )
    returning id into v_listing_id;

    update raw_listings
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id;

    return v_listing_id;
end;
$$;

-- 4) Feed RPC'leri: 0020 hali (owner filtresi yok, scope yok).
create or replace function feed_listings(p_filters jsonb default '{}'::jsonb, p_page int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_has boolean;
    v_lim integer;
    v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
    v_page integer := greatest(1, least(coalesce(p_page, 1), 500));
    v_il text := v_filters->>'il';
    v_ilce text := v_filters->>'ilce';
    v_grup text := v_filters->>'grup';
    v_oda text := v_filters->>'oda';
    v_fmin numeric := case when v_filters->>'fiyatMin' ~ '^[0-9]+(\.[0-9]+)?$' then (v_filters->>'fiyatMin')::numeric end;
    v_fmax numeric := case when v_filters->>'fiyatMax' ~ '^[0-9]+(\.[0-9]+)?$' then (v_filters->>'fiyatMax')::numeric end;
    v_has_price boolean := v_fmin is not null or v_fmax is not null;
    v_items jsonb;
    v_locked bigint;
    v_open_today bigint;
begin
    select a.has_access, a.lim into v_has, v_lim from feed_access() a;

    if not coalesce(v_has, false) then
        return jsonb_build_object(
            'items', '[]'::jsonb,
            'locked_count', 0,
            'limit', 0,
            'reason', 'no_subscription'
        );
    end if;

    with ranked as (
        select
            l.id, l.title, l.price, l.currency, l.rooms, l.area_m2,
            l.city, l.district, l.source_group_name, l.created_at,
            row_number() over (
                partition by (l.created_at at time zone 'Europe/Istanbul')::date
                order by l.created_at desc, l.id desc
            ) as rn
        from listings l
    ),
    flagged as (
        select
            r.*,
            (v_lim is null or r.rn <= v_lim) as is_open,
            ((r.created_at at time zone 'Europe/Istanbul')::date
                = (now() at time zone 'Europe/Istanbul')::date) as is_today
        from ranked r
    ),
    filtered as (
        select f.*
        from flagged f
        where (v_il is null or f.city = v_il)
          and (v_ilce is null or f.district = v_ilce)
          and (v_grup is null or f.source_group_name = v_grup)
          and (not v_has_price or (f.currency = 'TRY' and f.price is not null))
          and (v_fmin is null or f.price >= v_fmin)
          and (v_fmax is null or f.price <= v_fmax)
          and (
                v_oda is null
             or (v_oda = '5+' and f.rooms in ('5+1', '5+2', '6+1', '6+2', '7+1', '8+1'))
             or (v_oda <> '5+' and f.rooms = v_oda)
          )
    ),
    page as (
        select f.*
        from filtered f
        order by f.created_at desc, f.id desc
        limit 20 offset (v_page - 1) * 20
    )
    select
        coalesce(
            jsonb_agg(
                case
                    when p.is_open then jsonb_build_object(
                        'id', p.id,
                        'title', p.title,
                        'price', p.price,
                        'currency', p.currency,
                        'rooms', p.rooms,
                        'area_m2', p.area_m2,
                        'city', p.city,
                        'district', p.district,
                        'source_group_name', p.source_group_name,
                        'created_at', p.created_at,
                        'locked', false
                    )
                    else jsonb_build_object(
                        'id', p.id,
                        'city', p.city,
                        'district', p.district,
                        'created_at', p.created_at,
                        'locked', true
                    )
                end
                order by p.created_at desc, p.id desc
            ),
            '[]'::jsonb
        ),
        (select count(*) from filtered f2 where not f2.is_open),
        (select count(*) from flagged g where g.is_today and g.is_open)
    into v_items, v_locked, v_open_today
    from page p;

    return jsonb_build_object(
        'items', coalesce(v_items, '[]'::jsonb),
        'locked_count', coalesce(v_locked, 0),
        'open_today', coalesce(v_open_today, 0),
        'limit', v_lim
    );
end;
$$;

revoke all on function feed_listings(jsonb, integer) from public;
revoke execute on function feed_listings(jsonb, integer) from anon;
grant execute on function feed_listings(jsonb, integer) to authenticated;

create or replace function feed_filter_options(p_il text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_has boolean;
begin
    select a.has_access into v_has from feed_access() a;

    if not coalesce(v_has, false) then
        return jsonb_build_object('cities', '[]'::jsonb, 'districts', '[]'::jsonb, 'groups', '[]'::jsonb);
    end if;

    return jsonb_build_object(
        'cities', (
            select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb)
            from (select distinct city as v from listings where city is not null) s
        ),
        'districts', (
            select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb)
            from (
                select distinct district as v from listings
                where district is not null
                  and (p_il is null or city = p_il)
            ) s
        ),
        'groups', (
            select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb)
            from (select distinct source_group_name as v from listings where source_group_name is not null) s
        )
    );
end;
$$;

revoke all on function feed_filter_options(text) from public;
revoke execute on function feed_filter_options(text) from anon;
grant execute on function feed_filter_options(text) to authenticated;

create or replace function feed_unread_count(p_since timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_has boolean;
    v_count integer;
begin
    select a.has_access into v_has from feed_access() a;

    if not coalesce(v_has, false) then
        return 0;
    end if;

    select least(count(*), 100)::integer into v_count
    from listings
    where created_at > p_since;

    return v_count;
end;
$$;

revoke all on function feed_unread_count(timestamptz) from public;
revoke execute on function feed_unread_count(timestamptz) from anon;
grant execute on function feed_unread_count(timestamptz) to authenticated;

-- 5) Dedup index: 0007 hali (global fingerprint).
drop index if exists raw_listings_owner_fingerprint_unique_idx;
create unique index if not exists raw_listings_fingerprint_unique_idx
    on raw_listings (fingerprint)
    where status <> 'rejected';

-- 6) Tablolar ve kolonlar
drop index if exists listings_owner_agent_id_idx;
alter table listings drop column if exists owner_agent_id;
alter table raw_listings drop column if exists owner_agent_id;
alter table wa_connection_events drop column if exists detail;
alter table wa_connections drop column if exists groups_synced_at;

drop table if exists wa_group_selection;
drop table if exists wa_groups;
drop table if exists app_settings;
