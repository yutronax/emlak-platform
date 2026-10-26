-- 0011 rollback: admin policy'lerini ve property-videos bucket'ını kaldırır.
-- Not: bucket'ta dosya varsa delete başarısız olur; önce storage objelerini temizleyin.
-- 0001_init.sql'deki owner policy'lerine DOKUNULMAZ.

drop policy if exists property_videos_storage_admin_select on storage.objects;
drop policy if exists property_videos_storage_admin_insert on storage.objects;

delete from storage.buckets where id = 'property-videos';

drop policy if exists properties_admin_select on properties;

drop policy if exists property_videos_admin_update on property_videos;
drop policy if exists property_videos_admin_insert on property_videos;
drop policy if exists property_videos_admin_select on property_videos;
