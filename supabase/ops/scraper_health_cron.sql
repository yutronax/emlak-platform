-- Scraper sağlık kontrolü: her 10 dakikada Vercel'deki /api/cron/scraper-health ucunu çağırır.
-- Köprü 10 dk'dan uzun sessizse uç, admin(ler)e bir kez web push gönderir (0035_scraper_alert).
--
-- ÖNKOŞUL (bir kez, SQL Editor'da, gizli değeri buraya/repoya YAZMADAN):
--   select vault.create_secret('<Vercel CRON_SECRET değeri>', 'cron_secret');
-- Gizli anahtar Vault'tan okunur; bu dosyada yoktur.
--
-- Geri almak için:  select cron.unschedule('scraper-health');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
    'scraper-health',
    '*/10 * * * *',
    $$
    select net.http_get(
        url := 'https://emlak-platform-iota.vercel.app/api/cron/scraper-health',
        headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
        ),
        timeout_milliseconds := 10000
    );
    $$
);
