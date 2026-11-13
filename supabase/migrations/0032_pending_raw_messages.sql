-- 0032_pending_raw_messages.sql
-- Parse'ı (Gemini) teknik hatayla biten WhatsApp mesajlarının kısa süreli bekletilmesi.
-- Gemini rate-limit/kesinti sırasında gelen gerçek ilan kaybolmasın diye scraper ham metni burada
-- tutar ve arka plan drain döngüsüyle yeniden işler; işlenen satır hemen silinir.
-- KVKK: ham metin en fazla 72 saat yaşar (expires_at); süresi dolan satırları scraper saatlik siler.
-- agent_id null = ortak havuz; dolu = emlakçının kişisel mesajı (bağlantı kesmede silinir, aşağıda 2).
-- Yazma ve okuma yalnız servis rolü istemcisiyle yapılır. Tablo RLS ile tamamen kapalı —
-- anon/authenticated'a hiçbir politika ve tablo grant'i açılmaz (0023/0024/0031 deseni).
-- Idempotent. Rollback: supabase/rollback/0032_pending_raw_messages_rollback.sql
-- (migrations/ altında .down.sql değil: ileri migration sanılma riskine karşı).

-- 1) Tablo ------------------------------------------------------------------

-- raw_text üst sınırı 20000 karakter: WhatsApp ilan mesajları birkaç yüz/bin karakterdir; sınır
-- gerçek ilanları kesmeden kötüye kullanımı (çok büyük gövde) ve saklanan kişisel veri hacmini sınırlar.
-- reason: scraper'ın içeriksiz neden kodu (rate_limit, timeout, ... , unknown); metin taşıyamaz.
create table if not exists public.pending_raw_messages (
    id uuid primary key default gen_random_uuid(),
    source_message_id text not null check (char_length(source_message_id) between 1 and 200),
    agent_id uuid null references public.agents(id) on delete cascade,
    source_group text,
    source_group_name text,
    raw_text text not null check (char_length(raw_text) between 1 and 20000),
    reason text not null check (reason ~ '^[a-z_]{1,40}$'),
    attempts integer not null default 0 check (attempts >= 0),
    status text not null default 'pending' check (status in ('pending', 'dead')),
    next_attempt_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '72 hours'
);

-- Aynı mesaj aynı sahip için iki kez bekletilmez (ortak havuzda agent_id null -> sabit uuid).
create unique index if not exists pending_raw_messages_message_owner_uidx
    on public.pending_raw_messages (
        source_message_id,
        coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- Drain sorgusu: status = 'pending' and next_attempt_at <= now() order by created_at.
create index if not exists pending_raw_messages_due_idx
    on public.pending_raw_messages (status, next_attempt_at);

-- Süresi dolanların temizliği: expires_at < now().
create index if not exists pending_raw_messages_expires_idx
    on public.pending_raw_messages (expires_at);

alter table public.pending_raw_messages enable row level security;
-- Bilinçli olarak hiç politika tanımlanmaz. Supabase'in anon/authenticated'a verdiği varsayılan
-- tablo grant'leri "from public" ile kalkmaz (0017/0018 dersi); ayrıca açıkça kaldırılır.
revoke all on table public.pending_raw_messages from public, anon, authenticated;

-- 2) RPC: kişisel veri silme (0024 §11) — davranış aynen korunur; ek olarak emlakçının
--    bekletilen ham mesajları da silinir (aynı türden WhatsApp kaynaklı kişisel veri).
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
    -- 0032: yeniden işlenmeyi bekleyen ham mesajlar (ortak havuz satırları agent_id null, etkilenmez).
    delete from pending_raw_messages where agent_id = v_uid;
    delete from wa_group_selection where agent_id = v_uid;
    delete from wa_groups where agent_id = v_uid;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function delete_my_wa_data() from public;
revoke execute on function delete_my_wa_data() from anon;
grant execute on function delete_my_wa_data() to authenticated;
