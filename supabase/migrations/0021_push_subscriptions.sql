-- 0021_push_subscriptions.sql
-- EML-101 / EML-102 (faz2c-web-push): tarayıcı Web Push abonelikleri.
-- Her satır bir cihaz/tarayıcı aboneliği. Kayıt/silme sunucu action'ı (oturumlu emlakçı) yapar;
-- gönderim cron route'unda service_role ile okunur ve last_notified_at güncellenir.
-- Idempotent: tekrar çalıştırılabilir.

create table if not exists push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    last_notified_at timestamptz
);

create index if not exists push_subscriptions_agent_id_idx on push_subscriptions (agent_id);

-- RLS: yalnız kendi satırları. Update policy yok (satır güncellenmez: upsert ignore-duplicates kullanır).
alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_self_select on push_subscriptions;
create policy push_subscriptions_self_select on push_subscriptions
    for select to authenticated
    using (agent_id = auth.uid());

drop policy if exists push_subscriptions_self_insert on push_subscriptions;
create policy push_subscriptions_self_insert on push_subscriptions
    for insert to authenticated
    with check (agent_id = auth.uid());

drop policy if exists push_subscriptions_self_delete on push_subscriptions;
create policy push_subscriptions_self_delete on push_subscriptions
    for delete to authenticated
    using (agent_id = auth.uid());

-- Yetki: anon ve public'e hiçbir şey verilmez; yalnız oturumlu kullanıcı, RLS ile sınırlı.
revoke all on push_subscriptions from public;
revoke all on push_subscriptions from anon;
grant select, insert, delete on push_subscriptions to authenticated;
