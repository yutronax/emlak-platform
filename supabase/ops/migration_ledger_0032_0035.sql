-- SQL Editor'da elle uygulanan migration'ları Supabase kayıt tablosuna işler (güvenlik değerlendirmesi 2026-11-16).
-- Böylece `supabase db push` bunları yeniden çalıştırmaya kalkmaz. Şemayı DEĞİŞTİRMEZ; idempotent.
-- 0035'i yalnız 0035_scraper_alert.sql'i uyguladıktan sonra bu dosyayla birlikte çalıştırın.
insert into supabase_migrations.schema_migrations (version, name)
values
    ('20261115120000', '0032_pending_raw_messages'),
    ('20261115180000', '0033_admin_mfa'),
    ('20261116000000', '0034_revoke_anon_table_grants'),
    ('20261116020000', '0035_scraper_alert')
on conflict (version) do nothing;
