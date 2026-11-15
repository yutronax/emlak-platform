-- 0034_revoke_anon_table_grants.sql
-- Güvenlik değerlendirmesi (2026-11-15) bulgu 5: anon rolünde gereksiz geniş tablo yetkileri.
-- RLS bugün koruyor (anon'a açık politikalar auth.uid() ister), ama tek bir hatalı politika
-- veri sızdırabilir. Derinlemesine savunma: anon'un tablo yetkileri kaldırılır.
-- İstisna: plans — fiyat sayfası oturumsuz okur (plans_public_select); yalnız SELECT kalır.
-- Idempotent. Rollback: supabase/rollback/0034_revoke_anon_table_grants_rollback.sql

begin;

revoke all on table
    public.agents,
    public.listings,
    public.parse_cache,
    public.payment_events,
    public.properties,
    public.property_videos,
    public.raw_listings,
    public.subscriptions,
    public.support_messages,
    public.video_order_assets,
    public.video_orders,
    public.video_services
from anon;

revoke all on table public.plans from anon;
grant select on table public.plans to anon;

commit;
