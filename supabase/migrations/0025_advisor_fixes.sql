-- 0025: Supabase advisor bulguları (2026-11-02).
-- Davranış değişikliği yok: politikaların mantığı, rolleri ve komutları aynen korunur.

-- 1) Tetikleyici fonksiyonları RPC olarak çağrılamasın (0028/0029 lint).
--    Tetikleyiciler çalışırken EXECUTE yetkisi kontrol edilmez; yalnız /rest/v1/rpc/... yolu kapanır.
revoke execute on function public.prevent_self_is_admin_escalation() from public, anon, authenticated;
revoke execute on function public.video_order_assets_guard() from public, anon, authenticated;
revoke execute on function public.video_orders_set_updated_at() from public, anon, authenticated;
revoke execute on function public.video_orders_submit_guard() from public, anon, authenticated;

-- 2) Sabit search_path (0011 lint).
alter function public.video_order_assets_guard() set search_path = public;
alter function public.video_orders_set_updated_at() set search_path = public;
alter function public.video_orders_submit_guard() set search_path = public;

-- 3) auth.uid() satır başına değil sorgu başına bir kez değerlendirilsin (0003 lint).
alter policy agents_self_insert on public.agents
  with check ((id = (select auth.uid())) and (coalesce(is_admin, false) = false));
alter policy agents_self_select on public.agents using (id = (select auth.uid()));
alter policy agents_self_update on public.agents using (id = (select auth.uid()));

alter policy listings_admin_insert on public.listings
  with check (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy listings_admin_select on public.listings
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));

alter policy properties_admin_select on public.properties
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy properties_owner_insert on public.properties with check (agent_id = (select auth.uid()));
alter policy properties_owner_select on public.properties using (agent_id = (select auth.uid()));
alter policy properties_owner_update on public.properties using (agent_id = (select auth.uid()));

alter policy property_videos_admin_insert on public.property_videos
  with check (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy property_videos_admin_select on public.property_videos
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy property_videos_admin_update on public.property_videos
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy property_videos_owner_insert on public.property_videos
  with check (exists (select 1 from public.properties p
                      where p.id = property_videos.property_id and p.agent_id = (select auth.uid())));
alter policy property_videos_owner_select on public.property_videos
  using (exists (select 1 from public.properties p
                 where p.id = property_videos.property_id and p.agent_id = (select auth.uid())));

alter policy push_subscriptions_self_delete on public.push_subscriptions using (agent_id = (select auth.uid()));
alter policy push_subscriptions_self_insert on public.push_subscriptions with check (agent_id = (select auth.uid()));
alter policy push_subscriptions_self_select on public.push_subscriptions using (agent_id = (select auth.uid()));

alter policy raw_listings_admin_select on public.raw_listings
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy raw_listings_admin_update on public.raw_listings
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));

alter policy subscriptions_self_select on public.subscriptions using (agent_id = (select auth.uid()));

alter policy video_order_assets_admin_select on public.video_order_assets
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy video_order_assets_owner_select on public.video_order_assets
  using (exists (select 1 from public.video_orders o
                 where o.id = video_order_assets.order_id and o.agent_id = (select auth.uid())));

alter policy video_orders_admin_select on public.video_orders
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy video_orders_admin_update on public.video_orders
  using (exists (select 1 from public.agents a where a.id = (select auth.uid()) and a.is_admin));
alter policy video_orders_owner_select on public.video_orders using (agent_id = (select auth.uid()));

-- 4) İndekssiz yabancı anahtarlar (0001 lint).
create index if not exists app_settings_updated_by_idx on public.app_settings (updated_by);
create index if not exists listings_raw_listing_id_idx on public.listings (raw_listing_id);
create index if not exists payment_events_subscription_id_idx on public.payment_events (subscription_id);
create index if not exists payment_events_video_order_id_idx on public.payment_events (video_order_id);
create index if not exists raw_listings_owner_agent_id_idx on public.raw_listings (owner_agent_id);
create index if not exists raw_listings_reviewed_by_idx on public.raw_listings (reviewed_by);
create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index if not exists video_orders_property_id_idx on public.video_orders (property_id);
create index if not exists video_orders_service_code_idx on public.video_orders (service_code);
