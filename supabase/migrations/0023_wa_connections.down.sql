-- 0023_wa_connections.down.sql
-- 0023 geri alma. RPC'ler, tablolar ve agents onay kolonları kaldırılır.
-- Uyarı: frontend (/agent/whatsapp) ve sidecar commit'leri de geri alınmalı; aksi halde RPC'ler yok olur.

drop function if exists get_my_wa_status();
drop function if exists request_wa_action(text);
drop function if exists accept_wa_consent(text);

drop table if exists wa_connection_events;
drop table if exists wa_connections;
drop table if exists sidecar_heartbeat;

alter table agents drop column if exists wa_consent_version;
alter table agents drop column if exists wa_consent_accepted_at;
