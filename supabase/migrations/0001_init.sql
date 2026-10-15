-- 0001_init.sql
-- Emlak platformu temel şema: emlakçılar, abonelikler, ilanlar, mülk videoları.

create extension if not exists "pgcrypto";

-- Emlakçılar: auth.users ile bire bir ilişkili profil
create table agents (
    id uuid primary key references auth.users(id) on delete cascade,
    company_name text not null,
    phone text,
    created_at timestamptz not null default now()
);

create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    plan text not null,
    status subscription_status not null default 'trialing',
    current_period_end timestamptz not null,
    created_at timestamptz not null default now()
);

create index subscriptions_agent_id_idx on subscriptions (agent_id);

-- Scraper'ın WhatsApp gruplarından topladığı ham ilanlar.
-- Append-only: onay/red durumu dışında güncellenmez, silinmez.
create table raw_listings (
    id uuid primary key default gen_random_uuid(),
    source text not null,              -- örn. 'whatsapp'
    source_group text,                 -- kaynak grup adı/id
    source_message_id text,
    raw_text text not null,
    parsed jsonb not null,             -- AI parser çıktısı (fiyat, oda, m2, konum ...)
    fingerprint text not null,         -- dedup: konum+fiyat+oda+m2 normalize edilmiş hash
    quality_score numeric(3,2),        -- quality gate güven skoru (0-1)
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    reviewed_by uuid references agents(id),
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index raw_listings_source_message_idx
    on raw_listings (source, source_message_id)
    where source_message_id is not null;

create index raw_listings_fingerprint_idx on raw_listings (fingerprint);
create index raw_listings_status_idx on raw_listings (status);

-- Onaylanmış, abonelere görünen ilanlar.
create table listings (
    id uuid primary key default gen_random_uuid(),
    raw_listing_id uuid references raw_listings(id),
    title text not null,
    price numeric,
    currency text not null default 'TRY',
    rooms text,                        -- örn. '2+1'
    area_m2 numeric,
    city text,
    district text,
    neighborhood text,
    description text,
    created_at timestamptz not null default now()
);

create index listings_city_district_idx on listings (city, district);

-- Emlakçının kendi mülkü (video modülü).
create table properties (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    title text not null,
    address text,
    created_at timestamptz not null default now()
);

create index properties_agent_id_idx on properties (agent_id);

-- Bitmiş, editör tarafından kurgulanmış videolar (Supabase Storage referansı).
create table property_videos (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    storage_path text not null,        -- Supabase Storage bucket içindeki yol
    status text not null default 'draft' check (status in ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz not null default now()
);

create index property_videos_property_id_idx on property_videos (property_id);

-- RLS
alter table agents enable row level security;
alter table subscriptions enable row level security;
alter table raw_listings enable row level security;
alter table listings enable row level security;
alter table properties enable row level security;
alter table property_videos enable row level security;

-- agents: kendi satırını görür/günceller
create policy agents_self_select on agents
    for select using (id = auth.uid());
create policy agents_self_update on agents
    for update using (id = auth.uid());

-- subscriptions: emlakçı kendi aboneliğini görür
create policy subscriptions_self_select on subscriptions
    for select using (agent_id = auth.uid());

-- raw_listings: yalnızca service-role (scraper/admin) erişir, normal kullanıcıya politika yok
-- (RLS açık + policy yok = tüm normal kullanıcılar için erişim reddedilir)

-- listings: sadece aktif/trialing aboneliği olan emlakçılar okuyabilir
create policy listings_subscriber_select on listings
    for select using (
        exists (
            select 1 from subscriptions s
            where s.agent_id = auth.uid()
              and s.status in ('active', 'trialing')
              and s.current_period_end > now()
        )
    );

-- properties: emlakçı sadece kendi mülkünü görür/yönetir
create policy properties_owner_select on properties
    for select using (agent_id = auth.uid());
create policy properties_owner_insert on properties
    for insert with check (agent_id = auth.uid());
create policy properties_owner_update on properties
    for update using (agent_id = auth.uid());

-- property_videos: emlakçı sadece kendi property'sine bağlı videoları görür/yönetir;
-- public galeri sayfası için 'published' olanlar ayrıca anon policy ile açılabilir (Faz 5'te eklenecek).
create policy property_videos_owner_select on property_videos
    for select using (
        exists (
            select 1 from properties p
            where p.id = property_videos.property_id
              and p.agent_id = auth.uid()
        )
    );
create policy property_videos_owner_insert on property_videos
    for insert with check (
        exists (
            select 1 from properties p
            where p.id = property_videos.property_id
              and p.agent_id = auth.uid()
        )
    );
