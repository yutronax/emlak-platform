-- 0020_feed_daily_limit.sql
-- EML-98 / EML-99 (faz2b-plan-limitleri): plan bazlı günlük ilan görüntüleme limiti.
-- Doğrudan listings okuma (listings_subscriber_select) kaldırılır; akış ve sayaçlar
-- security definer RPC'lerden okunur. Kimlik (auth.uid()) ve plan DB'den çözülür.
-- Idempotent: tekrar çalıştırılabilir.

-- 1) Abonelik + plan çözümü (yardımcı). Yalnız diğer definer fonksiyonlar çağırır; grant yok.
--    Erişim: en yeni active/trialing abonelik ve süresi dolmamış dönem.
--    Plan: kaydın plan_id'si. Plan bulunamazsa 10 (en düşük limit) + log.
--    max_listings null → sınırsız (lim null). <= 0 → 0 (tüm ilanlar kilitli) + log.
create or replace function feed_access()
returns table (has_access boolean, lim integer)
language plpgsql
security definer
set search_path = public
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

-- 2) Akış: filtreden ÖNCE gün başına N hesabı; filtre açık/kilitli kümeyi değiştirmez (AC-2).
--    p_filters yalnız bilinen anahtarları okur (il, ilce, grup, fiyatMin, fiyatMax, oda);
--    limit/agent_id/plan_id gibi anahtarlar yok sayılır (AC-S3).
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

-- 3) Filtre seçenekleri: yalnız il/ilçe/grup adları (ilan alanı yok, AC-S7).
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

-- 4) Okunmamış sayısı: zil kilitli ilanları da sayar (AC-7), üst sınır 100.
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

-- 5) Doğrudan okuma kapanır. listings_admin_select korunur.
drop policy if exists listings_subscriber_select on listings;
