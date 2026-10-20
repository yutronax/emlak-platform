-- 0003_subscriptions_payment.sql
-- Abonelik ödeme entegrasyonu: plan kataloğu, sağlayıcı sütunları, ödeme olay günlüğü.

-- 1) Enum genişletme. PostgreSQL'de ADD VALUE ile eklenen bir değer aynı transaction
--    içinde kullanılamaz; bu yüzden yeni değerler aşağıda enum literal olarak
--    kullanılmıyor (partial index text karşılaştırması kullanır).
alter type subscription_status add value if not exists 'pending';
alter type subscription_status add value if not exists 'failed';
alter type subscription_status add value if not exists 'needs_review';

-- 2) Plan kataloğu. Fiyat sunucuda buradan okunur (istemci fiyatı yok sayılır).
create table plans (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    price_minor_unit integer not null,
    currency text not null default 'TRY',
    max_listings integer,
    created_at timestamptz not null default now()
);

alter table plans enable row level security;

-- Plan fiyatları herkese (giriş yapmış kullanıcılara) görünür; yazma policy'si yok.
create policy plans_authenticated_select on plans
    for select to authenticated using (true);

-- 3) subscriptions: mevcut `plan` sütunu KALDIRILMAZ (geçiş dönemi, deprecated).
--    Yeni sağlayıcı sütunları ve plan_id eklenir. Checkout pending satırı plan_id
--    ile oluşturduğu için eski `plan` ve `current_period_end` zorunluluğu kalkar.
alter table subscriptions
    add column plan_id uuid references plans(id),
    add column provider_subscription_id text,
    add column provider_customer_id text,
    alter column plan drop not null,
    alter column current_period_end drop not null;

comment on column subscriptions.plan is 'Deprecated: plan_id kullanılmalı. Kaldırma ayrı bir migration ile yapılacak.';

-- Bir emlakçının aynı anda en fazla bir bekleyen/aktif aboneliği olabilir.
-- Check-then-act yarışına karşı DB garantisi; ihlal uygulamada 23505 -> 409 olur.
create unique index subscriptions_one_open_per_agent_idx
    on subscriptions (agent_id)
    where status::text in ('pending', 'active');

-- 4) Ödeme olay günlüğü (idempotency + audit). Yalnızca service-role erişir:
--    RLS açık, policy yok (raw_listings deseni).
create table payment_events (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid references subscriptions(id) on delete cascade,
    provider_event_id text not null unique,
    event_type text not null,
    raw_payload jsonb not null,
    created_at timestamptz not null default now()
);

alter table payment_events enable row level security;
