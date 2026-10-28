-- 0015_property_videos_order_unique.sql
-- Sipariş başına tek teslim videosu. Idempotent: tekrar çalıştırılabilir.
-- Mevcut property_videos satırlarında order_id null olduğu için indeks mevcut veriyi etkilemez.

create unique index if not exists property_videos_order_id_unique
    on property_videos (order_id)
    where order_id is not null;
