-- 0016_listings_feed_notifications.sql
-- İlan akışı (EML-85): ilanın kaynak grup adı + "yeni ilan" bildirim sayacı.
-- Idempotent: tekrar çalıştırılabilir.

-- 1) Kaynak grup adı. Admin onayı raw_listings.source_group_name'i kopyalar.
alter table listings add column if not exists source_group_name text;

-- Mevcut ilanlar: kaynak grup adı raw_listing üzerinden tek seferlik doldurulur.
update listings l
set source_group_name = r.source_group_name
from raw_listings r
where l.raw_listing_id = r.id and l.source_group_name is null;

-- 2) Onay fonksiyonu: source_group_name'i raw satırdan listings'e kopyalar.
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

-- 3) Bildirim: agent "son görme" zamanı. Null ise sayaç son 7 güne bakar.
alter table agents add column if not exists listings_seen_at timestamptz;

-- Yalnızca çağıranın kendi satırındaki listings_seen_at'ı yazar.
-- Hedef id istemciden alınmaz; agents_self_update policy'si başka satırı engeller.
-- Dönüş: etkilenen satır sayısı (0 ise yazma yapılmadı).
create or replace function mark_listings_seen() returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_count integer;
begin
    update agents set listings_seen_at = now() where id = auth.uid();
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

grant execute on function mark_listings_seen() to authenticated;

-- 4) Akış ve filtre sorguları için indeksler (mevcut listings(city, district) korunur).
create index if not exists listings_created_at_idx on listings (created_at desc);
create index if not exists listings_source_group_name_idx on listings (source_group_name);
