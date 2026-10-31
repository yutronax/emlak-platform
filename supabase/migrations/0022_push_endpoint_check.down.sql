-- 0022 geri alma. Yalnız endpoint ve anahtar CHECK kısıtlarını düşürür; tablo 0021 down ile düşer.
-- Silinmiş kural dışı satırlar geri gelmez.

alter table push_subscriptions drop constraint if exists push_subscriptions_keys_format;
alter table push_subscriptions drop constraint if exists push_subscriptions_endpoint_allowlist;
