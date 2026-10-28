-- 0013 rollback: video sipariş tablolarını, bucket'ı ve 0013'ün mevcut tablolara eklediği kolonları kaldırır.
-- Not: bucket'ta dosya varsa delete başarısız olur; önce storage objelerini temizleyin.
-- Not: payment_events.video_order_id dolu satır varsa kolon silinir (o satırların video bağlantısı kaybolur); önce karar verin.

drop policy if exists video_order_assets_storage_admin_select on storage.objects;
drop policy if exists video_order_assets_storage_owner_select on storage.objects;

delete from storage.buckets where id = 'video-order-assets';

alter table payment_events drop constraint if exists payment_events_one_owner_check;
alter table payment_events drop column if exists video_order_id;

drop index if exists property_videos_order_id_idx;
alter table property_videos drop column if exists order_id;

drop table if exists video_order_assets;

drop trigger if exists video_orders_set_updated_at on video_orders;
drop table if exists video_orders;
drop function if exists video_orders_set_updated_at();

drop table if exists video_services;
