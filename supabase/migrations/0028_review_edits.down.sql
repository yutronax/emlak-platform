-- 0028_review_edits.down.sql
drop index if exists public.raw_listings_pending_created_idx;
drop function if exists public.review_reject(uuid, text, text);
drop function if exists public.review_approve(uuid, jsonb);
alter table public.raw_listings drop constraint if exists raw_listings_reject_note_len;
alter table public.raw_listings drop constraint if exists raw_listings_reject_reason_check;
alter table public.raw_listings drop column if exists reject_note;
alter table public.raw_listings drop column if exists reject_reason;
