-- Rollback 0034: anon tablo yetkilerini Supabase varsayılanına geri verir. Idempotent.
begin;

grant all on table
    public.agents,
    public.listings,
    public.parse_cache,
    public.payment_events,
    public.plans,
    public.properties,
    public.property_videos,
    public.raw_listings,
    public.subscriptions,
    public.support_messages,
    public.video_order_assets,
    public.video_orders,
    public.video_services
to anon;

commit;
