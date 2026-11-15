-- Rollback 0035: sidecar_heartbeat.alerted_at kolonunu kaldırır. Idempotent.

begin;

alter table public.sidecar_heartbeat drop column if exists alerted_at;

commit;
