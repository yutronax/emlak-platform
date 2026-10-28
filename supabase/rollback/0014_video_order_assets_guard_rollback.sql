-- 0014 rollback: video_order_assets koruma trigger'ını ve fonksiyonunu kaldırır.

drop trigger if exists video_order_assets_guard on video_order_assets;
drop function if exists video_order_assets_guard();
drop trigger if exists video_orders_submit_guard on video_orders;
drop function if exists video_orders_submit_guard();
