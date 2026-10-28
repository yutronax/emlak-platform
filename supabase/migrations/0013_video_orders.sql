-- 0013_video_orders.sql
-- Reklam videosu siparişi: hizmet kataloğu, siparişler, yüklenen dosyalar.
-- Idempotent: tekrar çalıştırılabilir.
-- Agent için video_orders / video_order_assets üzerinde YAZMA policy'si yok;
-- tüm yazmalar sunucuda service-role ile, sahiplik kodda doğrulandıktan sonra yapılır.

-- 1) Hizmet kataloğu. Fiyat sunucuda buradan okunur (istemci fiyatı yok sayılır).
create table if not exists video_services (
    code text primary key check (code in ('photos', 'raw_video', 'onsite')),
    name text not null,
    price_minor_unit integer,
    currency text not null default 'TRY',
    sort_order integer not null default 0
);

insert into video_services (code, name, price_minor_unit, sort_order) values
    ('photos', 'Fotoğraflardan video', 75000, 1),
    ('raw_video', 'Kendi videonuzdan', 75000, 2),
    ('onsite', 'Yerinde çekim', null, 3)
on conflict (code) do nothing;

-- 2) Siparişler.
create table if not exists video_orders (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    property_id uuid not null references properties(id) on delete restrict,
    service_code text not null references video_services(code),
    status text not null default 'draft' check (status in (
        'draft', 'quote_pending', 'awaiting_payment', 'payment_failed',
        'in_progress', 'delivered', 'canceled'
    )),
    price_minor_unit integer,
    currency text not null default 'TRY',
    onsite_preferred_time text,
    rejection_reason text,
    paid_at timestamptz,
    due_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists video_orders_agent_created_idx
    on video_orders (agent_id, created_at desc);
create index if not exists video_orders_status_due_idx
    on video_orders (status, due_at);

create or replace function video_orders_set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists video_orders_set_updated_at on video_orders;
create trigger video_orders_set_updated_at
    before update on video_orders
    for each row execute function video_orders_set_updated_at();

-- 3) Sipariş dosyaları (fotoğraf / ham video). Satır, yükleme onaylanınca yazılır.
create table if not exists video_order_assets (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references video_orders(id) on delete cascade,
    kind text not null check (kind in ('photo', 'raw_video')),
    storage_path text not null unique,
    size_bytes bigint not null,
    created_at timestamptz not null default now()
);

create index if not exists video_order_assets_order_idx
    on video_order_assets (order_id);

-- 4) Mevcut tablolara nullable bağlantılar.
alter table property_videos add column if not exists order_id uuid references video_orders(id);
create index if not exists property_videos_order_id_idx on property_videos (order_id);

alter table payment_events add column if not exists video_order_id uuid references video_orders(id);

-- Mevcut satırlar subscription_id dolu olduğu için NOT VALID + ayrı validate güvenli.
alter table payment_events drop constraint if exists payment_events_one_owner_check;
alter table payment_events add constraint payment_events_one_owner_check
    check (num_nonnulls(subscription_id, video_order_id) = 1) not valid;
alter table payment_events validate constraint payment_events_one_owner_check;

-- 5) RLS
alter table video_services enable row level security;
alter table video_orders enable row level security;
alter table video_order_assets enable row level security;

drop policy if exists video_services_authenticated_select on video_services;
create policy video_services_authenticated_select on video_services
    for select to authenticated using (true);

drop policy if exists video_orders_owner_select on video_orders;
create policy video_orders_owner_select on video_orders
    for select to authenticated using (agent_id = auth.uid());

drop policy if exists video_orders_admin_select on video_orders;
create policy video_orders_admin_select on video_orders
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

drop policy if exists video_orders_admin_update on video_orders;
create policy video_orders_admin_update on video_orders
    for update to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

drop policy if exists video_order_assets_owner_select on video_order_assets;
create policy video_order_assets_owner_select on video_order_assets
    for select to authenticated
    using (exists (
        select 1 from video_orders o
        where o.id = video_order_assets.order_id and o.agent_id = auth.uid()
    ));

drop policy if exists video_order_assets_admin_select on video_order_assets;
create policy video_order_assets_admin_select on video_order_assets
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

-- 6) Storage: private bucket. Yükleme yalnızca sunucunun ürettiği imzalı URL ile yapılır
--    (service-role), bu yüzden agent için insert policy'si YOK.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-order-assets', 'video-order-assets', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic',
              'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

drop policy if exists video_order_assets_storage_owner_select on storage.objects;
create policy video_order_assets_storage_owner_select on storage.objects
    for select to authenticated
    using (bucket_id = 'video-order-assets'
        and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists video_order_assets_storage_admin_select on storage.objects;
create policy video_order_assets_storage_admin_select on storage.objects
    for select to authenticated
    using (bucket_id = 'video-order-assets' and exists (
        select 1 from agents a where a.id = auth.uid() and a.is_admin
    ));
