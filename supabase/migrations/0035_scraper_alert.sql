-- 0035_scraper_alert.sql
-- WhatsApp köprüsü (scraper) sinyal göndermeyi bırakınca admin'lere web push uyarısı için.
-- sidecar_heartbeat'e alerted_at eklenir: son uyarı zamanı. /api/cron/scraper-health bu değeri
-- okuyup aynı kesinti için tekrar uyarı göndermez; uyarı gönderildiğinde yazar.
-- Grant ve RLS politikaları DEĞİŞMEZ: tablo zaten yalnız servis rolüne açık (0023).
-- Idempotent. Rollback: supabase/rollback/0035_scraper_alert_rollback.sql

begin;

alter table public.sidecar_heartbeat add column if not exists alerted_at timestamptz;

commit;
