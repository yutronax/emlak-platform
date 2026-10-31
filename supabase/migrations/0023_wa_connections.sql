-- 0023_wa_connections.sql
-- EML-105 (faz3a-whatsapp-baglama, EML-104): emlakçının kendi WhatsApp hesabını QR ile bağlaması.
-- Tablolar: wa_connections (agent başına durum), wa_connection_events (geçiş kaydı),
-- sidecar_heartbeat (tek satır, operatör görünürlüğü).
-- Doğrudan erişim kapalı: RLS açık, policy yok, authenticated/anon'a tablo grant'i yok.
-- Okuma/yazma yalnız security definer RPC'lerle (auth.uid()); agent_id argümanı yok.
-- Sidecar service_role ile yazar (RLS'i bypass eder).
-- Idempotent: tekrar çalıştırılabilir.

-- 1) agents: onay kanıtı (sunucu yazar). AC-1, AC-S7.
alter table agents add column if not exists wa_consent_accepted_at timestamptz;
alter table agents add column if not exists wa_consent_version text;

-- 2) Bağlantı durumu. qr yalnız get_my_wa_status() ile (süresi dolmamışsa) okunur (AC-S2).
create table if not exists wa_connections (
    agent_id uuid primary key references agents(id) on delete cascade,
    status text not null check (status in ('pending', 'qr', 'connected', 'disconnected', 'logged_out', 'error')),
    qr text,
    qr_expires_at timestamptz,
    qr_count int not null default 0,
    phone_masked text,
    error_code text,
    requested_action text check (requested_action in ('connect', 'disconnect')),
    requested_at timestamptz,
    attempt_id uuid,
    last_seen_at timestamptz,
    updated_at timestamptz not null default now()
);

-- 3) Geçiş kaydı (operatör görünürlüğü + connect hız sınırı sayımı, AC-S4).
--    requested_action yalnız istek kaynaklı geçişlerde dolu ('connect' / 'disconnect').
create table if not exists wa_connection_events (
    id bigserial primary key,
    agent_id uuid not null references agents(id) on delete cascade,
    attempt_id uuid,
    from_status text,
    to_status text,
    error_code text,
    requested_action text check (requested_action in ('connect', 'disconnect')),
    created_at timestamptz not null default now()
);

create index if not exists wa_connection_events_agent_created_idx
    on wa_connection_events (agent_id, created_at desc);

-- 4) Sidecar canlılık kaydı. Tek satır (id = 1); sidecar 30 sn'de bir yazar.
create table if not exists sidecar_heartbeat (
    id int primary key check (id = 1),
    last_beat_at timestamptz,
    sessions_open int not null default 0,
    misconfigured boolean not null default false,
    counters jsonb not null default '{}'::jsonb
);

-- 5) RLS açık, policy yok. Tablo grant'leri kaldırılır (Supabase varsayılan grant'leri dahil).
alter table wa_connections enable row level security;
alter table wa_connection_events enable row level security;
alter table sidecar_heartbeat enable row level security;

revoke all on table wa_connections, wa_connection_events, sidecar_heartbeat from public, anon, authenticated;

-- 6) RPC: onay kaydı. Sürüm sabit '2026-10'; sunucu zamanı ve sürümü yazar (AC-1, AC-S7).
create or replace function accept_wa_consent(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if p_version is distinct from '2026-10' then
        return jsonb_build_object('ok', false, 'error', 'invalid_version');
    end if;

    update agents
    set wa_consent_accepted_at = now(),
        wa_consent_version = p_version
    where id = v_uid;

    if not found then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function accept_wa_consent(text) from public;
revoke execute on function accept_wa_consent(text) from anon;
grant execute on function accept_wa_consent(text) to authenticated;

-- 7) RPC: bağlama / kesme isteği. connect: onay + erişim (active/trialing/past_due, dönem sonu
--    geçmemiş) + 10 dk'da en fazla 3 connect (AC-S4). disconnect: erişim kontrolü yok (AC-3).
create or replace function request_wa_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function request_wa_action(text) from public;
revoke execute on function request_wa_action(text) from anon;
grant execute on function request_wa_action(text) to authenticated;

-- 8) RPC: durum okuma. QR yalnız status='qr' ve süresi dolmamışken döner (AC-S2).
--    Zaman aşımı: pending 30 sn + sidecar heartbeat bayat -> error/sidecar_timeout (AC-7).
--    QR yok: pending/qr 45 sn -> error/no_qr_generated (AC-7). Yalnız kendi satırı.
-- Not side-effect-free: zaman aşımı (sidecar_timeout/no_qr_generated) geçişini yazar ve event üretir; yalnız sahibinin satırı.
create or replace function get_my_wa_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_row wa_connections%rowtype;
    v_from text;
    v_beat timestamptz;
    v_out jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    select * into v_row from wa_connections where agent_id = v_uid for update;

    if not found then
        return jsonb_build_object('ok', true, 'status', 'none');
    end if;

    v_from := v_row.status;

    select h.last_beat_at into v_beat from sidecar_heartbeat h where h.id = 1;

    if v_row.status = 'pending'
       and v_row.requested_at < now() - interval '30 seconds'
       and (v_beat is null or v_beat < now() - interval '30 seconds') then

        update wa_connections
        set status = 'error',
            error_code = 'sidecar_timeout',
            requested_action = null,
            updated_at = now()
        where agent_id = v_uid;

        insert into wa_connection_events (agent_id, attempt_id, from_status, to_status, error_code, requested_action)
        values (v_uid, v_row.attempt_id, v_from, 'error', 'sidecar_timeout', null);

        v_row.status := 'error';
        v_row.error_code := 'sidecar_timeout';
        v_row.requested_action := null;

    elsif v_row.status in ('pending', 'qr')
          and v_row.requested_at < now() - interval '45 seconds'
          and v_row.qr is null then

        update wa_connections
        set status = 'error',
            error_code = 'no_qr_generated',
            requested_action = null,
            updated_at = now()
        where agent_id = v_uid;

        insert into wa_connection_events (agent_id, attempt_id, from_status, to_status, error_code, requested_action)
        values (v_uid, v_row.attempt_id, v_from, 'error', 'no_qr_generated', null);

        v_row.status := 'error';
        v_row.error_code := 'no_qr_generated';
        v_row.requested_action := null;
    end if;

    v_out := jsonb_build_object(
        'ok', true,
        'status', v_row.status,
        'error_code', v_row.error_code,
        'phone_masked', v_row.phone_masked
    );

    if v_row.status = 'qr' and v_row.qr is not null and v_row.qr_expires_at > now() then
        v_out := v_out || jsonb_build_object('qr', v_row.qr, 'qr_expires_at', v_row.qr_expires_at);
    end if;

    return v_out;
end;
$$;

revoke all on function get_my_wa_status() from public;
revoke execute on function get_my_wa_status() from anon;
grant execute on function get_my_wa_status() to authenticated;
