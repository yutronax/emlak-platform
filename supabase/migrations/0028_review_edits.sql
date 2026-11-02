-- 0028_review_edits.sql
-- Admin ilan inceleme: onayda düzeltme, ret gerekçesi, eşzamanlı işlemde "gone" sonucu.
-- SECURITY INVOKER: yetki raw_listings/listings admin RLS politikalarından; ayrıca açık admin kontrolü.
-- Eski approve_raw_listing/reject_raw_listing yerinde kalır. Idempotent. Rollback: 0028_review_edits.down.sql

alter table public.raw_listings add column if not exists reject_reason text;
alter table public.raw_listings add column if not exists reject_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'raw_listings_reject_reason_check') then
    alter table public.raw_listings add constraint raw_listings_reject_reason_check
      check (reject_reason is null or reject_reason in ('spam', 'duplicate', 'incomplete', 'not_listing', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'raw_listings_reject_note_len') then
    alter table public.raw_listings add constraint raw_listings_reject_note_len
      check (reject_note is null or char_length(reject_note) <= 500);
  end if;
end $$;

-- p_edits: yalnız izinli anahtarlar (snake_case), değişen alanlar. Sonuç: {ok:true,id} | {ok:false,error}
create or replace function public.review_approve(p_raw_listing_id uuid, p_edits jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_edits jsonb := coalesce(p_edits, '{}'::jsonb);
    v_raw raw_listings%rowtype;
    v_p jsonb;
    v_key text;
    v_listing_id uuid;
begin
    if not exists (select 1 from agents a where a.id = auth.uid() and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if jsonb_typeof(v_edits) <> 'object' then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    for v_key in select jsonb_object_keys(v_edits) loop
        if v_key not in ('title', 'price', 'currency', 'rooms', 'area_m2', 'city', 'district', 'neighborhood', 'description') then
            return jsonb_build_object('ok', false, 'error', 'invalid');
        end if;
    end loop;

    select * into v_raw from raw_listings where id = p_raw_listing_id for update;
    if not found or v_raw.status <> 'pending' then
        return jsonb_build_object('ok', false, 'error', 'gone');
    end if;

    v_p := coalesce(v_raw.parsed, '{}'::jsonb) || v_edits;

    -- Doğrulama (UI ile aynı kurallar).
    if char_length(btrim(coalesce(v_p->>'title', ''))) not between 3 and 140
       or (v_p ? 'price' and jsonb_typeof(v_p->'price') not in ('null')
           and not (jsonb_typeof(v_p->'price') = 'number' and (v_p->>'price')::numeric > 0 and (v_p->>'price')::numeric = trunc((v_p->>'price')::numeric)))
       or (v_p ? 'area_m2' and jsonb_typeof(v_p->'area_m2') not in ('null')
           and not (jsonb_typeof(v_p->'area_m2') = 'number' and (v_p->>'area_m2')::numeric > 0 and (v_p->>'area_m2')::numeric = trunc((v_p->>'area_m2')::numeric)))
       or coalesce(v_p->>'currency', 'TRY') not in ('TRY', 'USD', 'EUR')
       or char_length(coalesce(v_p->>'description', '')) > 5000
       or greatest(char_length(coalesce(v_p->>'rooms', '')), char_length(coalesce(v_p->>'city', '')),
                   char_length(coalesce(v_p->>'district', '')), char_length(coalesce(v_p->>'neighborhood', ''))) > 100
    then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;

    insert into listings (raw_listing_id, title, price, currency, rooms, area_m2, city, district, neighborhood, description, source_group_name, owner_agent_id)
    values (
        v_raw.id,
        btrim(v_p->>'title'),
        (v_p->>'price')::numeric,
        coalesce(v_p->>'currency', 'TRY'),
        nullif(btrim(v_p->>'rooms'), ''),
        (v_p->>'area_m2')::numeric,
        nullif(btrim(v_p->>'city'), ''),
        nullif(btrim(v_p->>'district'), ''),
        nullif(btrim(v_p->>'neighborhood'), ''),
        nullif(btrim(v_p->>'description'), ''),
        v_raw.source_group_name,
        v_raw.owner_agent_id
    )
    returning id into v_listing_id;

    -- parsed onaylanan haliyle güncellenir; ilk ayrıştırma ham metinden yeniden üretilebilir.
    update raw_listings
    set status = 'approved', parsed = v_p, reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_raw.id;

    return jsonb_build_object('ok', true, 'id', v_listing_id);
end;
$function$;

create or replace function public.review_reject(p_raw_listing_id uuid, p_reason text, p_note text default null)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
begin
    if not exists (select 1 from agents a where a.id = auth.uid() and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if p_reason is null or p_reason not in ('spam', 'duplicate', 'incomplete', 'not_listing', 'other')
       or char_length(coalesce(p_note, '')) > 500 then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;

    update raw_listings
    set status = 'rejected', reject_reason = p_reason, reject_note = nullif(btrim(p_note), ''),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id and status = 'pending';

    if not found then
        return jsonb_build_object('ok', false, 'error', 'gone');
    end if;
    return jsonb_build_object('ok', true);
end;
$function$;

revoke execute on function public.review_approve(uuid, jsonb) from public, anon;
revoke execute on function public.review_reject(uuid, text, text) from public, anon;
grant execute on function public.review_approve(uuid, jsonb) to authenticated;
grant execute on function public.review_reject(uuid, text, text) to authenticated;

-- Kuyruk sorgusu: bekleyenler tarih sırasıyla.
create index if not exists raw_listings_pending_created_idx on public.raw_listings (created_at) where status = 'pending';
