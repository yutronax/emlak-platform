-- 0017_mark_listings_seen_revoke_public.sql
-- mark_listings_seen() fonksiyonunda PUBLIC ve anon execute yetkisini kaldırır (EML-85 red-team bulgusu).
-- Yalnızca oturumlu (authenticated) kullanıcılar çağırabilsin. Idempotent: tekrar çalıştırılabilir.

revoke all on function mark_listings_seen() from public;
revoke execute on function mark_listings_seen() from anon;
grant execute on function mark_listings_seen() to authenticated;
