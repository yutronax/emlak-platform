do $$
declare
  affected_count integer;
begin
  with duplicates as (
    select id,
           row_number() over (partition by fingerprint order by created_at asc) as rn
    from raw_listings
    where status <> 'rejected'
  )
  update raw_listings
  set status = 'rejected'
  where id in (select id from duplicates where rn > 1);

  get diagnostics affected_count = row_count;
  raise notice 'fingerprint-unique-constraint: % mükerrer satır rejected durumuna çekildi (soft, audit)', affected_count;
end $$;

drop index if exists raw_listings_fingerprint_idx;
create unique index raw_listings_fingerprint_unique_idx
    on raw_listings (fingerprint)
    where status <> 'rejected';
