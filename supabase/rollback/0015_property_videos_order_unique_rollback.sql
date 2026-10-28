-- 0015 rollback: sipariş başına tek teslim videosu indeksini kaldırır.

drop index if exists property_videos_order_id_unique;
