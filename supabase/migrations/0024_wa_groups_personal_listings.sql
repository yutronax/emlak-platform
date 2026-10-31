-- 0024_wa_groups_personal_listings.sql
-- EML-107 (faz3b-grup-secimi-kisisel-ilan, EML-108 subtask): WhatsApp grup seçimi,
-- kişisel ilan görünürlüğü (owner_agent_id), otomatik onay eşiği.
-- Doğrudan erişim kapalı: RLS açık, policy yok, tablo grant'i yok (0023 deseni).
-- Okuma/yazma security definer RPC'lerle (auth.uid()); agent_id argümanı yalnız
-- service_role RPC'lerinde (ingest_personal_listing, upsert_wa_groups) vardır.
-- Service-role RPC'lerinin EXECUTE grant'i açıkça verilir (BYPASSRLS fonksiyon ACL'sini aşmaz).
-- Idempotent: tekrar çalıştırılabilir.

-- 1) Tablolar ---------------------------------------------------------------

-- Hesabın WhatsApp grupları (sidecar upsert eder; service_role).
create table if not exists wa_groups (
    agent_id uuid not null references agents(id) on delete cascade,
    group_jid text not null check (char_length(group_jid) between 1 and 200),
    name text,
    updated_at timestamptz not null default now(),
    primary key (agent_id, group_jid)
);

-- Seçili gruplar (okunacak gruplar). Yalnız set_my_wa_group_selection yazar.
create table if not exists wa_group_selection (
    agent_id uuid not null,
    group_jid text not null,
    created_at timestamptz not null default now(),
    primary key (agent_id, group_jid),
    foreign key (agent_id, group_jid) references wa_groups(agent_id, group_jid) on delete cascade
);

-- Uygulama ayarları (anahtar/değer). Eşik: personal_auto_approve_threshold.
create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    updated_by uuid references agents(id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint app_settings_threshold_range check (
        case when key = 'personal_auto_approve_threshold'
             then jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric between 0 and 1
             else true
        end
    )
);

insert into app_settings (key, value)
values ('personal_auto_approve_threshold', '0.70'::jsonb)
on conflict (key) do nothing;

-- 2) Sahip kolonları (null = ortak havuz) ------------------------------------
alter table raw_listings add column if not exists owner_agent_id uuid references agents(id) on delete cascade;
alter table listings add column if not exists owner_agent_id uuid references agents(id) on delete cascade;

create index if not exists listings_owner_agent_id_idx on listings (owner_agent_id, created_at desc);

-- Geçiş kaydı: seçim değişikliği sayımları (içeriksiz, AC-S8).
alter table wa_connection_events add column if not exists detail jsonb;

-- Başarılı tam grup senkronunun zamanı (boş liste dahil). Yalnız upsert_wa_groups yazar;
-- hata/bekleme durumunda değişmez. null = henüz hiç başarılı senkron yok.
alter table wa_connections add column if not exists groups_synced_at timestamptz;

-- Sahip değiştirilemez (AC-S6). Silme cascade'i trigger tetiklemez.
create or replace function owner_agent_id_immutable() returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.owner_agent_id is distinct from old.owner_agent_id then
        raise exception 'owner_agent_id değiştirilemez' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists listings_owner_immutable on listings;
create trigger listings_owner_immutable
    before update on listings
    for each row execute function owner_agent_id_immutable();

drop trigger if exists raw_listings_owner_immutable on raw_listings;
create trigger raw_listings_owner_immutable
    before update on raw_listings
    for each row execute function owner_agent_id_immutable();

-- 3) Dedup: global index -> emlakçı başına (AC-11) --------------------------
drop index if exists raw_listings_fingerprint_unique_idx;
create unique index if not exists raw_listings_owner_fingerprint_unique_idx
    on raw_listings (coalesce(owner_agent_id, '00000000-0000-0000-0000-000000000000'::uuid), fingerprint)
    where status <> 'rejected';

-- 4) RLS açık, policy yok, grant kaldır -------------------------------------
alter table wa_groups enable row level security;
alter table wa_group_selection enable row level security;
alter table app_settings enable row level security;

revoke all on table wa_groups, wa_group_selection, app_settings from public, anon, authenticated;

-- 5) Onay: sahibi korunur (AC-S6). Kişisel ilan ortak havuza taşınmaz. --------
create or replace function approve_raw_listing(p_raw_listing_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_parsed jsonb;
    v_source_group_name text;
    v_owner uuid;
    v_listing_id uuid;
begin
    select parsed, source_group_name, owner_agent_id
      into v_parsed, v_source_group_name, v_owner
    from raw_listings
    where id = p_raw_listing_id and status = 'pending';

    if v_parsed is null then
        raise exception 'raw_listing bulunamadı veya zaten incelenmiş: %', p_raw_listing_id;
    end if;

    insert into listings (raw_listing_id, title, price, currency, rooms, area_m2, city, district, neighborhood, description, source_group_name, owner_agent_id)
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
        v_source_group_name,
        v_owner
    )
    returning id into v_listing_id;

    update raw_listings
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id;

    return v_listing_id;
end;
$$;

-- 6) Akış RPC'leri: görünürlük = ortak (owner null) veya kendi (owner = auth.uid()).
--    Günlük limit yalnız ortak ilanları sayar; kişisel ilanlar kilitlenmez (AC-8).
--    p_filters.scope = 'mine' -> yalnız kendi kişisel ilanları.

create or replace function feed_access()
returns table (has_access boolean, lim integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_plan_id uuid;
    v_max integer;
begin
    select p.id, p.max_listings
      into v_plan_id, v_max
    from subscriptions s
    left join plans p on p.id = s.plan_id
    where s.agent_id = auth.uid()
      and s.status in ('active', 'trialing', 'past_due')
      and s.current_period_end > now()
    order by s.created_at desc
    limit 1;

    if not found then
        return query select false, null::integer;
        return;
    end if;

    if v_plan_id is null then
        raise log 'feed_plan_missing';
        return query select true, 10;
        return;
    end if;

    if v_max is null then
        return query select true, null::integer;
        return;
    end if;

    if v_max <= 0 then
        raise log 'feed_limit_clamped';
        return query select true, 0;
        return;
    end if;

    return query select true, v_max;
end;
$$;

revoke all on function feed_access() from public, anon, authenticated;

create or replace function feed_listings(p_filters jsonb default '{}'::jsonb, p_page int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
    v_scope text := v_filters->>'scope';
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

    with visible as (
        select l.id, l.title, l.price, l.currency, l.rooms, l.area_m2,
               l.city, l.district, l.source_group_name, l.created_at, l.owner_agent_id
        from listings l
        where l.owner_agent_id is null or l.owner_agent_id = auth.uid()
    ),
    ranked as (
        -- Sıra yalnız ortak ilanlar arasında (partition owner null) -> kişisel ilan limite sayılmaz.
        select
            v.*,
            row_number() over (
                partition by (v.owner_agent_id is null), (v.created_at at time zone 'Europe/Istanbul')::date
                order by v.created_at desc, v.id desc
            ) as rn
        from visible v
    ),
    flagged as (
        select
            r.*,
            (r.owner_agent_id is not null or v_lim is null or r.rn <= v_lim) as is_open,
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
          and (v_scope is distinct from 'mine' or f.owner_agent_id = auth.uid())
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
                        'personal', (p.owner_agent_id is not null),
                        'owner_agent_id', p.owner_agent_id,
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
        (select count(*) from flagged g where g.is_today and g.is_open and g.owner_agent_id is null)
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
set search_path = public, pg_temp
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
            from (
                select distinct city as v from listings
                where city is not null
                  and (owner_agent_id is null or owner_agent_id = auth.uid())
            ) s
        ),
        'districts', (
            select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb)
            from (
                select distinct district as v from listings
                where district is not null
                  and (p_il is null or city = p_il)
                  and (owner_agent_id is null or owner_agent_id = auth.uid())
            ) s
        ),
        'groups', (
            select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb)
            from (
                select distinct source_group_name as v from listings
                where source_group_name is not null
                  and (owner_agent_id is null or owner_agent_id = auth.uid())
            ) s
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
set search_path = public, pg_temp
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
    where created_at > p_since
      and (owner_agent_id is null or owner_agent_id = auth.uid());

    return v_count;
end;
$$;

revoke all on function feed_unread_count(timestamptz) from public;
revoke execute on function feed_unread_count(timestamptz) from anon;
grant execute on function feed_unread_count(timestamptz) to authenticated;

-- listings_subscriber_select 0020'de bilinçli olarak kaldırıldı (günlük limit yalnız RPC'den geçer).
-- Plan'daki "yeniden tanımla" maddesi uygulanmadı: doğrudan REST okuma yeniden açılmamalı.
drop policy if exists listings_subscriber_select on listings;

-- 7) RPC: emlakçı grupları (AC-1, AC-10). Yalnız kendi satırları.
create or replace function get_my_wa_groups()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_status text;
    v_synced timestamptz;
    v_groups jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    select c.status, c.groups_synced_at into v_status, v_synced
    from wa_connections c
    where c.agent_id = v_uid;

    if not found then
        return jsonb_build_object('ok', true, 'status', 'none', 'groups', '[]'::jsonb, 'max', 20);
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object('jid', g.group_jid, 'name', g.name, 'selected', (s.group_jid is not null))
        order by g.name nulls last, g.group_jid
    ), '[]'::jsonb)
    into v_groups
    from wa_groups g
    left join wa_group_selection s
           on s.agent_id = g.agent_id and s.group_jid = g.group_jid
    where g.agent_id = v_uid;

    return jsonb_build_object(
        'ok', true,
        'status', v_status,
        'groups', v_groups,
        'max', 20
    ) || case
            when v_status = 'connected' then jsonb_build_object('groups_synced_at', v_synced)
            else jsonb_build_object('readonly', true)
         end;
end;
$$;

revoke all on function get_my_wa_groups() from public;
revoke execute on function get_my_wa_groups() from anon;
grant execute on function get_my_wa_groups() to authenticated;

-- 8) RPC: seçimi tamamen değiştir (AC-2, AC-4, AC-S2, AC-S7, AC-S8). Tek transaction.
create or replace function set_my_wa_group_selection(p_group_jids text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_status text;
    v_jids text[];
    v_matched integer;
    v_added integer;
    v_removed integer;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    -- Agent bazında serialize (TOCTOU / eşzamanlı sekmeler): sayım, silme ve yeniden insert
    -- aynı kilit altında; xact kilidi transaction sonunda otomatik bırakılır.
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

    if p_group_jids is null then
        return jsonb_build_object('ok', false, 'error', 'invalid_input');
    end if;

    if coalesce(cardinality(p_group_jids), 0) > 20 then
        return jsonb_build_object('ok', false, 'error', 'too_many', 'max', 20);
    end if;

    select c.status into v_status
    from wa_connections c
    where c.agent_id = v_uid;

    if v_status is distinct from 'connected' then
        return jsonb_build_object('ok', false, 'error', 'not_connected');
    end if;

    -- Eleman null ya da >200 karakter -> unknown_group (hiçbiri yazılmaz).
    if exists (
        select 1 from unnest(p_group_jids) j
        where j is null or char_length(j) > 200
    ) then
        return jsonb_build_object('ok', false, 'error', 'unknown_group');
    end if;

    v_jids := array(select distinct j from unnest(p_group_jids) j);

    -- Her jid bu hesabın wa_groups kaydında olmalı; biri bile değilse hiçbiri yazılmaz.
    select count(*) into v_matched
    from wa_groups g
    where g.agent_id = v_uid
      and g.group_jid = any(v_jids);

    if v_matched <> coalesce(cardinality(v_jids), 0) then
        return jsonb_build_object('ok', false, 'error', 'unknown_group');
    end if;

    select count(*) into v_added
    from unnest(v_jids) j
    where not exists (
        select 1 from wa_group_selection s
        where s.agent_id = v_uid and s.group_jid = j
    );

    select count(*) into v_removed
    from wa_group_selection s
    where s.agent_id = v_uid
      and not (s.group_jid = any(v_jids));

    delete from wa_group_selection where agent_id = v_uid;

    insert into wa_group_selection (agent_id, group_jid)
    select v_uid, j from unnest(v_jids) j;

    -- AC-S8: içeriksiz kayıt (yalnız sayılar).
    if v_added + v_removed > 0 then
        insert into wa_connection_events (agent_id, attempt_id, from_status, to_status, error_code, requested_action, detail)
        values (v_uid, null, v_status, v_status, 'selection_changed', null,
                jsonb_build_object('added', v_added, 'removed', v_removed));
    end if;

    return jsonb_build_object('ok', true, 'selected', coalesce(cardinality(v_jids), 0));
end;
$$;

revoke all on function set_my_wa_group_selection(text[]) from public;
revoke execute on function set_my_wa_group_selection(text[]) from anon;
grant execute on function set_my_wa_group_selection(text[]) to authenticated;

-- 9) RPC: eşik (AC-7, AC-S5). Yalnız admin; değer 0-1.
create or replace function admin_set_threshold(p_threshold numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if not exists (select 1 from agents a where a.id = v_uid and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if p_threshold is null or p_threshold = 'NaN'::numeric or p_threshold < 0 or p_threshold > 1 then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;

    insert into app_settings (key, value, updated_by, updated_at)
    values ('personal_auto_approve_threshold', to_jsonb(p_threshold), v_uid, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

    return jsonb_build_object('ok', true, 'threshold', p_threshold);
end;
$$;

revoke all on function admin_set_threshold(numeric) from public;
revoke execute on function admin_set_threshold(numeric) from anon;
grant execute on function admin_set_threshold(numeric) to authenticated;

-- 9b) RPC: eşik okuma (admin, düzeltme 4). Admin değilse forbidden; satır yoksa 0.70.
--     admin_set_threshold ile aynı kontrol deseni.
create or replace function admin_get_threshold()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_value jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if not exists (select 1 from agents a where a.id = v_uid and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    select s.value into v_value
    from app_settings s
    where s.key = 'personal_auto_approve_threshold';

    v_value := coalesce(v_value, '0.70'::jsonb);

    -- Sayı değilse (veya 0-1 dışıysa) okunamadı: frontend "okunamadı" olarak gösterir.
    if jsonb_typeof(v_value) is distinct from 'number' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;
    if (v_value #>> '{}')::numeric not between 0 and 1 then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;

    return jsonb_build_object('ok', true, 'value', v_value);
end;
$$;

revoke all on function admin_get_threshold() from public;
revoke execute on function admin_get_threshold() from anon;
grant execute on function admin_get_threshold() to authenticated;

-- 9c) Sayaç RPC'leri (operatör görünürlüğü). sidecar_heartbeat.counters şekli:
--     { "orchestrator": { <anahtar>: n, ... }, "sidecar": { <anahtar>: n, ... } }
--     bump_sidecar_counter: tek satır atomik +1 (ON CONFLICT ... DO UPDATE; satır kilidi altında
--     mevcut counters okunup yazılır). Yalnız service_role (orchestrator ve ingest_personal_listing).
create or replace function bump_sidecar_counter(p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if p_key is null or p_key !~ '^[a-z_]{1,40}$' then
        raise exception 'invalid_counter_key';
    end if;

    insert into sidecar_heartbeat (id, counters)
    values (1, jsonb_build_object('orchestrator', jsonb_build_object(p_key, 1)))
    on conflict (id) do update
    set counters = coalesce(sidecar_heartbeat.counters, '{}'::jsonb) || jsonb_build_object(
        'orchestrator',
        coalesce(sidecar_heartbeat.counters->'orchestrator', '{}'::jsonb) || jsonb_build_object(
            p_key,
            coalesce((sidecar_heartbeat.counters->'orchestrator'->>p_key)::bigint, 0) + 1
        )
    );
end;
$$;

revoke all on function bump_sidecar_counter(text) from public, anon, authenticated;
grant execute on function bump_sidecar_counter(text) to service_role;

-- set_sidecar_counters: sidecar kendi sayaç nesnesini YALNIZ 'sidecar' alt anahtarına yazar;
-- 'orchestrator' alt nesnesi korunur (PostgREST upsert counters'ı ezmesin diye ayrı RPC).
create or replace function set_sidecar_counters(p_counters jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if p_counters is null or jsonb_typeof(p_counters) <> 'object' then
        raise exception 'invalid_counters';
    end if;

    insert into sidecar_heartbeat (id, counters)
    values (1, jsonb_build_object('sidecar', p_counters))
    on conflict (id) do update
    set counters = coalesce(sidecar_heartbeat.counters, '{}'::jsonb)
                   || jsonb_build_object('sidecar', p_counters);
end;
$$;

revoke all on function set_sidecar_counters(jsonb) from public, anon, authenticated;
grant execute on function set_sidecar_counters(jsonb) to service_role;

-- 10) Service-role RPC: kişisel ilan girişi (AC-3, AC-5, AC-6, AC-11, AC-S3, AC-S4).
--     owner ASLA p_record'dan okunmaz; p_agent_id sidecar oturumunun sahibidir.
--     Seçim otoritesi DB'dir (AC-5, AC-9): source_group bu agent'ın wa_group_selection
--     kaydında yoksa (seçim kaldırılmış / hiç seçilmemiş) hiçbir şey yazılmaz -> 'unselected'.
--     Dönüş: 'approved' | 'pending' | 'duplicate' | 'unselected' | 'not_connected'. Tek transaction: hata -> tümü geri alınır.
--     Sonuç ve eşik fallback'i sayaçlara bu fonksiyon içinde, aynı transaction'da yazılır.
create or replace function ingest_personal_listing(p_agent_id uuid, p_record jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_value jsonb;
    v_threshold numeric := 0.70;
    v_fallback boolean := false;
    v_score numeric;
    v_approve boolean;
    v_parsed jsonb;
    v_raw_id uuid;
    v_status text;
    v_req text;
    v_sel integer;
begin
    if p_agent_id is null or p_record is null or jsonb_typeof(p_record) <> 'object' then
        raise exception 'invalid_record';
    end if;

    -- Bağlantı kilidi (TOCTOU, AC-5/AC-9/AC-S4): FOR SHARE, eşzamanlı disconnect (delete_my_wa_data
    -- FOR UPDATE) commit'e kadar bekler. Bağlı değil ya da kesme istendiyse hiçbir şey yazılmaz.
    select c.status, c.requested_action into v_status, v_req
    from wa_connections c
    where c.agent_id = p_agent_id
    for share;

    if not found or v_status is distinct from 'connected' or coalesce(v_req, '') = 'disconnect' then
        perform bump_sidecar_counter('personal_not_connected');
        return 'not_connected';
    end if;

    -- Seçim kilidi (yazmadan önce): FOR SHARE, eşzamanlı seçim kaldırma commit'e kadar bekler.
    -- source_group null ise eşleşme olmaz -> unselected.
    select 1 into v_sel
    from wa_group_selection ws
    where ws.agent_id = p_agent_id
      and ws.group_jid = p_record->>'source_group'
    for share;

    if not found then
        perform bump_sidecar_counter('personal_unselected');
        return 'unselected';
    end if;

    -- Eşik: satır yoksa / okunamazsa / geçersizse varsayılan 0.70 (threshold_fallback).
    select s.value into v_value
    from app_settings s
    where s.key = 'personal_auto_approve_threshold';

    if not found then
        v_fallback := true;
    else
        begin
            v_threshold := (v_value #>> '{}')::numeric;
        exception when others then
            v_threshold := null;
        end;
    end if;

    if v_threshold is null or v_threshold < 0 or v_threshold > 1 then
        v_threshold := 0.70;
        v_fallback := true;
    end if;

    if v_fallback then
        perform bump_sidecar_counter('threshold_fallback');
    end if;

    -- Skor: null / sayı değil / 0-1 dışı -> pending (kuyruk).
    v_score := case
        when p_record->>'quality_score' ~ '^[0-9]+(\.[0-9]+)?$' then (p_record->>'quality_score')::numeric
    end;
    if v_score is not null and (v_score < 0 or v_score > 1) then
        v_score := null;
    end if;

    v_approve := v_score is not null and v_score >= v_threshold;
    v_parsed := p_record->'parsed';

    begin
        insert into raw_listings (
            source, source_group, source_message_id, raw_text, parsed, fingerprint,
            quality_score, status, owner_agent_id, source_group_name, reviewed_at
        )
        values (
            'whatsapp_personal',
            p_record->>'source_group',
            case when p_record->>'source_message_id' is not null
                 then p_agent_id::text || ':' || (p_record->>'source_message_id')
            end,
            p_record->>'raw_text',
            v_parsed,
            p_record->>'fingerprint',
            v_score,
            case when v_approve then 'approved' else 'pending' end,
            p_agent_id,
            p_record->>'source_group_name',
            case when v_approve then now() end
        )
        returning id into v_raw_id;
    exception when unique_violation then
        -- Aynı emlakçıda aynı fingerprint/mesaj: tek kayıt kalır, yazma yok (AC-11).
        perform bump_sidecar_counter('personal_duplicate');
        return 'duplicate';
    end;

    if v_approve then
        insert into listings (
            raw_listing_id, title, price, currency, rooms, area_m2, city, district,
            neighborhood, description, source_group_name, owner_agent_id
        )
        values (
            v_raw_id,
            coalesce(v_parsed->>'title', trim(concat(v_parsed->>'rooms', ' ', v_parsed->>'district', ' ', v_parsed->>'city'))),
            (v_parsed->>'price')::numeric,
            coalesce(v_parsed->>'currency', 'TRY'),
            v_parsed->>'rooms',
            (v_parsed->>'area_m2')::numeric,
            v_parsed->>'city',
            v_parsed->>'district',
            v_parsed->>'neighborhood',
            v_parsed->>'description',
            p_record->>'source_group_name',
            p_agent_id
        );
        perform bump_sidecar_counter('personal_auto_approved');
        return 'approved';
    end if;

    perform bump_sidecar_counter(
        case when v_score is null then 'personal_queued_noscore' else 'personal_queued' end
    );
    return 'pending';
end;
$$;

revoke all on function ingest_personal_listing(uuid, jsonb) from public, anon, authenticated;
grant execute on function ingest_personal_listing(uuid, jsonb) to service_role;

-- 11) RPC: kişisel veri silme (AC-12). Kendi ilanları, ham kayıtları, grupları ve seçimleri.
--     listings önce silinir (listings.raw_listing_id -> raw_listings FK).
create or replace function delete_my_wa_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    -- Önce bağlantı satırı kilitlenip kesme olarak işaretlenir (TOCTOU, AC-12). Ingest ve grup
    -- upsert'i FOR SHARE ile bekler; commit'ten sonra 'not_connected' döner ve yazmaz.
    -- Satır yoksa devam (bağlantı hiç kurulmamış).
    perform 1 from wa_connections where agent_id = v_uid for update;
    if found then
        update wa_connections
        set requested_action = 'disconnect',
            requested_at = now()
        where agent_id = v_uid;
    end if;

    delete from listings where owner_agent_id = v_uid;
    delete from raw_listings where owner_agent_id = v_uid;
    delete from wa_group_selection where agent_id = v_uid;
    delete from wa_groups where agent_id = v_uid;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function delete_my_wa_data() from public;
revoke execute on function delete_my_wa_data() from anon;
grant execute on function delete_my_wa_data() to authenticated;

-- 12) Service-role RPC: grup listesi upsert'i (AC-1, AC-S3, AC-S7).
--     Sidecar doğrudan wa_groups'a REST yazmaz. wa_connections satırı FOR SHARE ile kilitlenir;
--     bağlı değilse ya da kesme istendiyse hiçbir şey yazılmaz -> 'not_connected' (sayaç: groups_sync_rejected).
--     Sahip p_agent_id'dir; satırlardaki agent_id alanı yok sayılır. Hesap başına en fazla 500 grup,
--     jid 1-200 karakter. Dönüş: 'ok' | 'not_connected'.
--     p_rows TAM listedir (otorite): listede olmayan wa_groups satırları silinir; seçimleri
--     wa_group_selection FK cascade ile birlikte gider. Boş dizi geçerlidir (tümünü siler).
create or replace function upsert_wa_groups(p_agent_id uuid, p_rows jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_status text;
    v_req text;
    v_jids text[];
begin
    if p_agent_id is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
        raise exception 'invalid_rows';
    end if;

    if jsonb_array_length(p_rows) > 500 then
        raise exception 'too_many_groups';
    end if;

    if exists (
        select 1 from jsonb_array_elements(p_rows) r
        where jsonb_typeof(r->'group_jid') is distinct from 'string'
           or char_length(r->>'group_jid') not between 1 and 200
    ) then
        raise exception 'invalid_rows';
    end if;

    -- Agent bazlı kilit (set_my_wa_group_selection ile birebir aynı anahtar): uzlaştırma ile seçim
    -- değişikliği serialize olur; FK hatası ya da anlık cascade ile seçim bozulmaz.
    perform pg_advisory_xact_lock(hashtextextended(p_agent_id::text, 0));

    select c.status, c.requested_action into v_status, v_req
    from wa_connections c
    where c.agent_id = p_agent_id
    for share;

    if not found or v_status is distinct from 'connected' or coalesce(v_req, '') = 'disconnect' then
        return 'not_connected';
    end if;

    -- Başarılı senkron zamanı (boş liste dahil). Silme/cascade'den önce yazılır: bağlantı satırı
    -- zaten FOR SHARE ile tutulmuş, ingest ile kilit sırası çakışmaz.
    update wa_connections
    set groups_synced_at = now()
    where agent_id = p_agent_id;

    -- Tam liste uzlaştırması: bu hesapta olup p_rows'ta bulunmayan gruplar silinir (FK cascade ile
    -- wa_group_selection satırları da gider). Boş dizide v_jids '{}' -> hepsi silinir.
    v_jids := array(select distinct r->>'group_jid' from jsonb_array_elements(p_rows) r);

    delete from wa_groups g
    where g.agent_id = p_agent_id
      and not (g.group_jid = any(v_jids));

    -- Aynı JID iki kez gelirse tek satır (ON CONFLICT aynı satıra iki kez dokunamaz).
    insert into wa_groups (agent_id, group_jid, name, updated_at)
    select p.agent_id, p.group_jid, p.name, now()
    from (
        select distinct on (r->>'group_jid')
            p_agent_id as agent_id, r->>'group_jid' as group_jid, r->>'name' as name
        from jsonb_array_elements(p_rows) r
        order by r->>'group_jid'
    ) p
    on conflict (agent_id, group_jid) do update
    set name = excluded.name,
        updated_at = excluded.updated_at;

    return 'ok';
end;
$$;

revoke all on function upsert_wa_groups(uuid, jsonb) from public, anon, authenticated;
grant execute on function upsert_wa_groups(uuid, jsonb) to service_role;
