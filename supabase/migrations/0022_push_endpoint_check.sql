-- 0022_push_endpoint_check.sql
-- Red-team bulgusu (faz2c-web-push, KRİTİK): endpoint allowlist yalnız server action'daydı.
-- Oturumlu kullanıcı PostgREST insert ile keyfi endpoint yazabiliyor ve cron (service_role)
-- o adrese istek atıyordu (stored SSRF). Kural burada DB seviyesinde zorlanır.
-- Endpoint kümesi isAllowedPushEndpoint (web/src/lib/push/endpoint.ts) ile aynıdır.
-- Idempotent: önce kural dışı mevcut satırlar silinir, sonra constraint'ler drop if exists ile yeniden eklenir.

-- 1) Mevcut kural dışı satırları temizle (constraint eklenmeden önce; aksi halde ALTER başarısız olur).
delete from push_subscriptions
where not (
    char_length(endpoint) <= 1024
    and endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)+push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+notify\.windows\.com)(/|$)'
    and char_length(p256dh) <= 200
    and p256dh ~ '^[A-Za-z0-9_-]+$'
    and char_length(auth) <= 200
    and auth ~ '^[A-Za-z0-9_-]+$'
);

-- 2) Endpoint allowlist.
alter table push_subscriptions drop constraint if exists push_subscriptions_endpoint_allowlist;
alter table push_subscriptions add constraint push_subscriptions_endpoint_allowlist check (
    char_length(endpoint) <= 1024
    and endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)+push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+notify\.windows\.com)(/|$)'
);

-- 3) Abonelik anahtarları: base64url, en fazla 200 karakter (isValidKey ile aynı).
alter table push_subscriptions drop constraint if exists push_subscriptions_keys_format;
alter table push_subscriptions add constraint push_subscriptions_keys_format check (
    char_length(p256dh) <= 200
    and p256dh ~ '^[A-Za-z0-9_-]+$'
    and char_length(auth) <= 200
    and auth ~ '^[A-Za-z0-9_-]+$'
);
