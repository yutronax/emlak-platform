-- 0031_parse_cache.sql
-- Ayrıştırma (Gemini) sonuç önbelleği: anahtar = normalize mesajın sürümlü SHA-256 özeti.
-- Ham mesaj, grup, kullanıcı, telefon veya URL için sütun YOKTUR; yalnız anahtar, sonuç
-- (parsed jsonb), is_listing, sürüm ve zaman damgaları tutulur.
-- Yazma ve okuma yalnız servis rolü istemcisiyle yapılır. Tablo RLS ile tamamen kapalı —
-- anon/authenticated'a hiçbir politika açılmaz. Idempotent. Rollback: 0031_parse_cache.down.sql

create table if not exists public.parse_cache (
  key text primary key,
  is_listing boolean not null,
  parsed jsonb,
  version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists parse_cache_expires_idx on public.parse_cache (expires_at);

alter table public.parse_cache enable row level security;
-- Bilinçli olarak hiç politika tanımlanmaz: anon/authenticated erişemez.
-- Süresi dolmuş satırlar scraper içindeki periyodik temizlikle silinir.
