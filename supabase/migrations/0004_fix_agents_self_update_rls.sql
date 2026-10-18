-- 0004_fix_agents_self_update_rls.sql
-- EML-18: agents_self_update policy'sinde WITH CHECK yoktu, authenticated
-- kullanıcı kendi satırında is_admin=true yapabiliyordu (privilege escalation).
-- Fix: BEFORE UPDATE trigger ile is_admin değişikliğini service_role dışında engelle.

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
  return new;
end;
$$;

create trigger agents_prevent_self_is_admin_escalation
  before update on agents
  for each row
  execute function prevent_self_is_admin_escalation();
