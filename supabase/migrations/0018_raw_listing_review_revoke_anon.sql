-- 0018_raw_listing_review_revoke_anon.sql
-- approve_raw_listing() ve reject_raw_listing() fonksiyonlarında anon execute yetkisini kaldırır.
-- Postmortem Koşum 4 bulgusu: 0002'deki "revoke ... from public" Supabase'in anon rolüne
-- verdiği ayrı grant'i kaldırmıyordu; canlıda anon execute=true idi.
-- Yalnızca oturumlu (authenticated) kullanıcılar çağırabilsin. Idempotent: tekrar çalıştırılabilir.

revoke execute on function approve_raw_listing(uuid) from anon;
revoke execute on function reject_raw_listing(uuid) from anon;
grant execute on function approve_raw_listing(uuid) to authenticated;
grant execute on function reject_raw_listing(uuid) to authenticated;
