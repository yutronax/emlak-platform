-- 0020_feed_daily_limit.down.sql
-- 0020 geri alma. RPC'ler kaldırılır, listings_subscriber_select 0001 tanımıyla geri oluşturulur.
-- Uyarı: frontend commit'i de revert edilmeli; aksi halde eski istemci 0 satır görür.

drop function if exists feed_unread_count(timestamptz);
drop function if exists feed_filter_options(text);
drop function if exists feed_listings(jsonb, integer);
drop function if exists feed_access();

create policy listings_subscriber_select on listings
    for select using (
        exists (
            select 1 from subscriptions s
            where s.agent_id = auth.uid()
              and s.status in ('active', 'trialing')
              and s.current_period_end > now()
        )
    );
