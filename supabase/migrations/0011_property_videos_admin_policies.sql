-- 0011_property_videos_admin_policies.sql

-- Admin: herhangi bir property'nin videolarını görebilir/ekleyebilir/güncelleyebilir.
create policy property_videos_admin_select on property_videos
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

create policy property_videos_admin_insert on property_videos
    for insert to authenticated
    with check (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

create policy property_videos_admin_update on property_videos
    for update to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

-- properties: admin herhangi bir property'yi SELECT edebilmeli (property seçici için).
create policy properties_admin_select on properties
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

-- Storage bucket (idempotent, private).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-videos', 'property-videos', false, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- storage.objects: admin property-videos bucket'ına yazabilir/okuyabilir.
create policy property_videos_storage_admin_select on storage.objects
    for select to authenticated
    using (bucket_id = 'property-videos' and exists (
        select 1 from agents a where a.id = auth.uid() and a.is_admin
    ));

create policy property_videos_storage_admin_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'property-videos' and exists (
        select 1 from agents a where a.id = auth.uid() and a.is_admin
    ));
