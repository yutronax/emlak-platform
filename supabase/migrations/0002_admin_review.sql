-- 0002_admin_review.sql
-- Admin rolü + raw_listings onay/red akışı (Faz 3).

alter table agents add column is_admin boolean not null default false;

-- Admin, incelenmemiş ham ilanları görebilir/durumunu güncelleyebilir.
create policy raw_listings_admin_select on raw_listings
    for select using (
        exists (select 1 from agents a where a.id = auth.uid() and a.is_admin)
    );

create policy raw_listings_admin_update on raw_listings
    for update using (
        exists (select 1 from agents a where a.id = auth.uid() and a.is_admin)
    );

-- Admin, onayladığı ilanı listings'e yazabilir / tüm ilanları yönetim amaçlı görebilir.
create policy listings_admin_insert on listings
    for insert with check (
        exists (select 1 from agents a where a.id = auth.uid() and a.is_admin)
    );

create policy listings_admin_select on listings
    for select using (
        exists (select 1 from agents a where a.id = auth.uid() and a.is_admin)
    );

-- Onay ve red, tek sorguda atomik yapılır (fingerprint/parsed okuma + yazma
-- arasında yarış durumu olmasın diye) ve SECURITY INVOKER ile çağıranın
-- RLS'i üzerinden çalışır — admin olmayan biri çağırırsa yukarıdaki policy'ler
-- zaten engeller, fonksiyon kendisi yetki yükseltmiyor.

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

create or replace function reject_raw_listing(p_raw_listing_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
    update raw_listings
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id and status = 'pending';

    if not found then
        raise exception 'raw_listing bulunamadı veya zaten incelenmiş: %', p_raw_listing_id;
    end if;
end;
$$;

revoke all on function approve_raw_listing(uuid) from public;
revoke all on function reject_raw_listing(uuid) from public;
grant execute on function approve_raw_listing(uuid) to authenticated;
grant execute on function reject_raw_listing(uuid) to authenticated;
