-- 0030_support_messages.sql
-- Destek mesajı: ziyaretçi (giriş yapmamış da olabilir) "Destek" formundan mesaj bırakır;
-- WhatsApp'a yönlendirme yok. Yazma yalnız sunucudan (servis rolü) server action ile yapılır;
-- okuma yalnız admin. Tablo RLS ile tamamen kapalı — anon/authenticated'a hiçbir politika açılmaz,
-- servis rolü RLS'i baypas eder. Idempotent. Rollback: 0030_support_messages.down.sql

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null,
  -- Giriş yapmış kullanıcıdan geldiyse ilişkilendirme (anon'da null).
  agent_id uuid references public.agents(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_messages_name_len check (char_length(btrim(name)) between 2 and 80),
  constraint support_messages_contact_len check (char_length(btrim(contact)) between 3 and 120),
  constraint support_messages_message_len check (char_length(btrim(message)) between 5 and 2000)
);

create index if not exists support_messages_created_idx on public.support_messages (created_at desc);

alter table public.support_messages enable row level security;
-- Bilinçli olarak hiç politika tanımlanmaz: anon/authenticated erişemez.
-- Yazma (server action) ve okuma (admin sayfası) servis rolü istemcisiyle yapılır.
