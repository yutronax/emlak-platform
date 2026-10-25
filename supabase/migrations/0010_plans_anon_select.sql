-- 0010_plans_anon_select.sql
-- plans fiyat kataloğu herkese açık bilgi; anonim ziyaretçi de görebilmeli.
drop policy if exists plans_authenticated_select on plans;

create policy plans_public_select on plans
    for select to anon, authenticated using (true);
