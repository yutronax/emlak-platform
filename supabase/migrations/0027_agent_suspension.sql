-- 0027_agent_suspension.sql
-- Admin emlakçı askısı: askıdaki hesap paneli kullanamaz, akış boş döner, WhatsApp bağlanamaz, deneme başlatamaz.
-- Askıyı yalnız admin sunucu işlemi (servis rolü) yazar; authenticated'ın sütun grant'i yok (0026).
-- Idempotent. Rollback: 0027_agent_suspension.down.sql

alter table public.agents add column if not exists suspended_at timestamptz;

-- 1) Akış erişimi: askıdaysa abonelik olsa da erişim yok (feed_listings/feed_unread_count/feed_filter_options buradan okur).
create or replace function public.feed_access()
 returns table(has_access boolean, lim integer)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_plan_id uuid;
    v_max integer;
begin
    if exists (select 1 from agents a where a.id = auth.uid() and a.suspended_at is not null) then
        return query select false, null::integer;
        return;
    end if;

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
$function$;

-- 2) WhatsApp: askıdaki hesap bağlanamaz (bağlantıyı kesmek serbest).
create or replace function public.request_wa_action(p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_uid uuid := auth.uid();
    v_row wa_connections%rowtype;
    v_recent integer;
    v_attempt uuid;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if p_action is null or p_action not in ('connect', 'disconnect') then
        return jsonb_build_object('ok', false, 'error', 'invalid_action');
    end if;

    if p_action = 'connect' then
        if exists (select 1 from agents a where a.id = v_uid and a.suspended_at is not null) then
            return jsonb_build_object('ok', false, 'error', 'suspended');
        end if;

        if not exists (
            select 1 from agents a
            where a.id = v_uid
              and a.wa_consent_accepted_at is not null
        ) then
            return jsonb_build_object('ok', false, 'error', 'consent_required');
        end if;

        if not exists (
            select 1 from subscriptions s
            where s.agent_id = v_uid
              and s.status in ('active', 'trialing', 'past_due')
              and s.current_period_end > now()
        ) then
            return jsonb_build_object('ok', false, 'error', 'subscription_required');
        end if;

        select count(*) into v_recent
        from wa_connection_events e
        where e.agent_id = v_uid
          and e.requested_action = 'connect'
          and e.to_status = 'pending'
          and e.created_at > now() - interval '10 minutes';

        if v_recent >= 3 then
            return jsonb_build_object('ok', false, 'error', 'rate_limited');
        end if;

        select * into v_row from wa_connections where agent_id = v_uid for update;

        if v_row.status in ('pending', 'qr', 'connected') then
            return jsonb_build_object('ok', true, 'status', v_row.status);
        end if;

        v_attempt := gen_random_uuid();

        insert into wa_connections (
            agent_id, status, requested_action, requested_at, attempt_id,
            qr, qr_expires_at, qr_count, phone_masked, error_code, updated_at
        )
        values (
            v_uid, 'pending', 'connect', now(), v_attempt,
            null, null, 0, null, null, now()
        )
        on conflict (agent_id) do update
        set status = 'pending',
            requested_action = 'connect',
            requested_at = now(),
            attempt_id = excluded.attempt_id,
            qr = null,
            qr_expires_at = null,
            qr_count = 0,
            phone_masked = null,
            error_code = null,
            updated_at = now();

        insert into wa_connection_events (agent_id, attempt_id, from_status, to_status, error_code, requested_action)
        values (v_uid, v_attempt, v_row.status, 'pending', null, 'connect');

        return jsonb_build_object('ok', true, 'status', 'pending');
    end if;

    -- disconnect
    select * into v_row from wa_connections where agent_id = v_uid for update;

    if not found then
        return jsonb_build_object('ok', true, 'status', 'none');
    end if;

    update wa_connections
    set requested_action = 'disconnect',
        requested_at = now(),
        updated_at = now()
    where agent_id = v_uid;

    insert into wa_connection_events (agent_id, attempt_id, from_status, to_status, error_code, requested_action)
    values (v_uid, v_row.attempt_id, v_row.status, 'pending', null, 'disconnect');

    return jsonb_build_object('ok', true, 'status', 'pending');
end;
$function$;

-- 3) Deneme: askıdaki hesap başlatamaz.
create or replace function public.start_trial()
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_plan uuid;
begin
    update agents
    set trial_started_at = now()
    where id = auth.uid()
      and trial_started_at is null
      and suspended_at is null
      and not exists (select 1 from subscriptions where agent_id = auth.uid());

    if not found then
        return false;
    end if;

    select id into v_plan from plans order by price_minor_unit asc limit 1;
    if v_plan is null then
        raise exception 'plan bulunamadı';
    end if;

    insert into subscriptions (agent_id, plan_id, status, current_period_end)
    values (auth.uid(), v_plan, 'trialing', now() + interval '14 days');

    return true;
end;
$function$;

-- 4) Admin listesi filtre/sıralama için.
create index if not exists agents_created_at_idx on public.agents (created_at desc);
