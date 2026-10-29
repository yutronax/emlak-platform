-- 0019_trial_terms.down.sql
-- 0019 geri alma. Oluşmuş trial/abonelik satırları silinmez (subscriptions'a dokunulmaz).
-- Uyarı: terms_* kolonları drop edilince KVKK onay kayıtları da kaybolur.

drop function if exists start_trial();

alter table agents drop column if exists terms_version;
alter table agents drop column if exists terms_accepted_at;
alter table agents drop column if exists trial_started_at;
