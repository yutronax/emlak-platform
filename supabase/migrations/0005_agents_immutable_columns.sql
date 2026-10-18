-- 0005_agents_immutable_columns.sql
-- EML-18 / AC-2: agents tablosunda id ve created_at alanları authenticated
-- kullanıcı tarafından hiçbir şekilde (service_role istisnası dahi olmadan)
-- değiştirilemez. prevent_self_is_admin_escalation() fonksiyonu genişletildi.

create or replace function prevent_self_is_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_admin alanı bu yoldan değiştirilemez'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'id ve created_at alanları değiştirilemez'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
