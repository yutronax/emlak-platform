-- 0010_plans_anon_select.sql'in ters migration'ı — acil durumda elle veya
-- migration olarak çalıştırılabilir. supabase/migrations/ İÇİNDE DEĞİL
-- (otomatik uygulanmaması için ayrı supabase/rollback/ dizininde).
drop policy if exists plans_public_select on plans;

create policy plans_authenticated_select on plans
    for select to authenticated using (true);
