-- 0032 rollback: delete_my_wa_data() 0024 haline döner, pending_raw_messages kaldırılır.
-- Not: bekleyen (henüz yeniden işlenmemiş) ham mesajlar silinir; o mesajlar kalıcı olarak kaybolur.
-- Geri almadan önce scraper'ın 0032'ye bağlı sürümü durdurulmalı / geri alınmalı; aksi halde
-- park ve drain çağrıları "relation does not exist" hatası loglar (worker düşmez).
-- Bilinçli olarak supabase/migrations/ altında .down.sql DEĞİL: ileri migration sanılma riski.

-- 1) RPC: 0024 §11 gövdesi (pending_raw_messages satırı yok).
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

-- 2) Tablo (fonksiyon artık ona başvurmuyor; önce fonksiyon, sonra tablo).
drop index if exists public.pending_raw_messages_expires_idx;
drop index if exists public.pending_raw_messages_due_idx;
drop index if exists public.pending_raw_messages_message_owner_uidx;
drop table if exists public.pending_raw_messages;
