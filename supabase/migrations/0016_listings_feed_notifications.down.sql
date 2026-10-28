-- 0016_listings_feed_notifications.down.sql
-- 0016 geri alma. Sıra önemli: önce approve_raw_listing 0002 hâline döner
-- (source_group_name kullanmaz), sonra kolonlar drop edilir.

drop index if exists listings_source_group_name_idx;
drop index if exists listings_created_at_idx;

drop function if exists mark_listings_seen();

-- approve_raw_listing: 0002_admin_review.sql tanımı (birebir).
create or replace function approve_raw_listing(p_raw_listing_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_parsed jsonb;
    v_listing_id uuid;
begin
    select parsed into v_parsed
    from raw_listings
    where id = p_raw_listing_id and status = 'pending';

    if v_parsed is null then
        raise exception 'raw_listing bulunamadı veya zaten incelenmiş: %', p_raw_listing_id;
    end if;

    insert into listings (raw_listing_id, title, price, currency, rooms, area_m2, city, district, neighborhood, description)
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
        v_parsed->>'description'
    )
    returning id into v_listing_id;

    update raw_listings
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id;

    return v_listing_id;
end;
$$;

alter table agents drop column if exists listings_seen_at;
alter table listings drop column if exists source_group_name;
