-- 0033_admin_mfa.sql
-- Bulgu 1 (güvenlik değerlendirmesi 2026-11-15): admin hesapları yalnız parolayla korunuyordu.
-- Admin; ham WhatsApp mesajlarını (raw_listings), ilan onayını, emlakçı askıya almayı ve destek
-- mesajlarını yönetir. Bu migration veritabanı katmanında MFA şartı getirir: admin olan bir
-- kullanıcının admin verisine erişmesi için JWT'de aal2 gerekir. Uygulama katmanındaki /mfa kapısı
-- atlansa bile (örn. doğrudan REST çağrısıyla) veri okunamaz / yazılamaz.
--
-- Kısıtlayıcı (restrictive) politika mevcut politikalara VE ile eklenir: mevcut admin politikaları
-- değişmez, yalnız aal1 admin için ek bir kapı kapanır. Admin olmayan emlakçılar etkilenmez.
-- agents tablosu bilinçli olarak hariç tutulur: giriş akışı aal1 iken is_admin okumak zorundadır
-- (login sonrası /mfa yönlendirmesi bu okumaya dayanır).
-- service_role RLS'i zaten atladığı için scraper'ın yazma/okuma işlemleri etkilenmez.
-- Dört RPC (admin_get_threshold, admin_set_threshold, review_approve, review_reject) admin
-- kontrolünden hemen sonra aal2 denetimi yapar; diğer davranış birebir aynıdır.
-- feed_listings, feed_filter_options, feed_unread_count bilinçli olarak kapsam dışıdır: abonenin
-- zaten gördüğü yayınlanmış ilanları döndürürler, admin'e özel veri (ham mesaj, onay, askı, destek,
-- ayarlar) içermezler; MFA admin yetkilerini korur, feed yeni yetki vermez.
-- Idempotent: create or replace, drop policy if exists ... create policy.
-- Tek transaction: begin / commit arasında.
-- Rollback: supabase/rollback/0033_admin_mfa_rollback.sql
-- (migrations/ altında .down.sql değil: ileri migration sanılma riskine karşı).

begin;

-- 1) Yardımcı fonksiyonlar ----------------------------------------------------

-- Oturum açmış kullanıcı admin mi? Politikalarda ve RPC'lerde tekrar kullanılır.
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
    select exists (select 1 from public.agents a where a.id = auth.uid() and a.is_admin);
$$;

-- Oturum JWT'si MFA ile yükseltilmiş mi (aal2)?
create or replace function public.session_is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
    select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

revoke all on function public.session_is_aal2() from public, anon;
grant execute on function public.session_is_aal2() to authenticated;

-- 2) Tablolara kısıtlayıcı politika -------------------------------------------
-- Admin olmayan ya da aal2 olan kullanıcı geçer; aal1 admin hiçbir satıra erişemez.
-- Yardımcılar (select ...) ile sarılır: planner değeri satır başına değil sorgu başına hesaplar.

drop policy if exists admin_requires_mfa on public.raw_listings;
create policy admin_requires_mfa on public.raw_listings as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

drop policy if exists admin_requires_mfa on public.listings;
create policy admin_requires_mfa on public.listings as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

drop policy if exists admin_requires_mfa on public.properties;
create policy admin_requires_mfa on public.properties as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

drop policy if exists admin_requires_mfa on public.property_videos;
create policy admin_requires_mfa on public.property_videos as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

drop policy if exists admin_requires_mfa on public.video_orders;
create policy admin_requires_mfa on public.video_orders as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

drop policy if exists admin_requires_mfa on public.video_order_assets;
create policy admin_requires_mfa on public.video_order_assets as restrictive for all to authenticated
    using (not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (not (select public.is_admin_user()) or (select public.session_is_aal2()));

-- 3) storage.objects: yalnız admin bucket'ları ---------------------------------
-- Diğer bucket'lar (emlakçı yüklemeleri vb.) bu politikadan etkilenmez.

drop policy if exists admin_requires_mfa_admin_buckets on storage.objects;
create policy admin_requires_mfa_admin_buckets on storage.objects as restrictive for all to authenticated
    using (bucket_id not in ('property-videos', 'video-order-assets') or not (select public.is_admin_user()) or (select public.session_is_aal2()))
    with check (bucket_id not in ('property-videos', 'video-order-assets') or not (select public.is_admin_user()) or (select public.session_is_aal2()));

-- 4) RPC'ler: admin kontrolünden sonra aal2 denetimi ----------------------------
-- Tek değişiklik: "if not public.session_is_aal2()" bloğu. Diğer satırlar mevcut tanımla aynıdır.
-- create or replace mevcut grant'leri korur; grant'ler yeniden verilmez.

CREATE OR REPLACE FUNCTION public.admin_get_threshold()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_uid uuid := auth.uid();
    v_value jsonb;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if not exists (select 1 from agents a where a.id = v_uid and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if not public.session_is_aal2() then
        return jsonb_build_object('ok', false, 'error', 'mfa_required');
    end if;

    select s.value into v_value
    from app_settings s
    where s.key = 'personal_auto_approve_threshold';

    v_value := coalesce(v_value, '0.70'::jsonb);

    -- Sayı değilse (veya 0-1 dışıysa) okunamadı: frontend "okunamadı" olarak gösterir.
    if jsonb_typeof(v_value) is distinct from 'number' then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;
    if (v_value #>> '{}')::numeric not between 0 and 1 then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;

    return jsonb_build_object('ok', true, 'value', v_value);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_threshold(p_threshold numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;

    if not exists (select 1 from agents a where a.id = v_uid and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if not public.session_is_aal2() then
        return jsonb_build_object('ok', false, 'error', 'mfa_required');
    end if;

    if p_threshold is null or p_threshold = 'NaN'::numeric or p_threshold < 0 or p_threshold > 1 then
        return jsonb_build_object('ok', false, 'error', 'invalid_value');
    end if;

    insert into app_settings (key, value, updated_by, updated_at)
    values ('personal_auto_approve_threshold', to_jsonb(p_threshold), v_uid, now())
    on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

    return jsonb_build_object('ok', true, 'threshold', p_threshold);
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_approve(p_raw_listing_id uuid, p_edits jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_edits jsonb := coalesce(p_edits, '{}'::jsonb);
    v_raw raw_listings%rowtype;
    v_p jsonb;
    v_key text;
    v_listing_id uuid;
begin
    if not exists (select 1 from agents a where a.id = auth.uid() and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if not public.session_is_aal2() then
        return jsonb_build_object('ok', false, 'error', 'mfa_required');
    end if;

    if jsonb_typeof(v_edits) <> 'object' then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    for v_key in select jsonb_object_keys(v_edits) loop
        if v_key not in ('title', 'price', 'currency', 'rooms', 'area_m2', 'city', 'district', 'neighborhood', 'description') then
            return jsonb_build_object('ok', false, 'error', 'invalid');
        end if;
    end loop;

    select * into v_raw from raw_listings where id = p_raw_listing_id for update;
    if not found or v_raw.status <> 'pending' then
        return jsonb_build_object('ok', false, 'error', 'gone');
    end if;

    v_p := coalesce(v_raw.parsed, '{}'::jsonb) || v_edits;

    if char_length(btrim(coalesce(v_p->>'title', ''))) not between 3 and 140
       or (v_p ? 'price' and jsonb_typeof(v_p->'price') not in ('null')
           and not (jsonb_typeof(v_p->'price') = 'number' and (v_p->>'price')::numeric > 0 and (v_p->>'price')::numeric = trunc((v_p->>'price')::numeric)))
       or (v_p ? 'area_m2' and jsonb_typeof(v_p->'area_m2') not in ('null')
           and not (jsonb_typeof(v_p->'area_m2') = 'number' and (v_p->>'area_m2')::numeric > 0 and (v_p->>'area_m2')::numeric = trunc((v_p->>'area_m2')::numeric)))
       or coalesce(v_p->>'currency', 'TRY') not in ('TRY', 'USD', 'EUR')
       or char_length(coalesce(v_p->>'description', '')) > 5000
       or greatest(char_length(coalesce(v_p->>'rooms', '')), char_length(coalesce(v_p->>'city', '')),
                   char_length(coalesce(v_p->>'district', '')), char_length(coalesce(v_p->>'neighborhood', ''))) > 100
    then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;

    insert into listings (raw_listing_id, title, price, currency, rooms, area_m2, city, district, neighborhood, description, source_group_name, owner_agent_id)
    values (
        v_raw.id,
        btrim(v_p->>'title'),
        (v_p->>'price')::numeric,
        coalesce(v_p->>'currency', 'TRY'),
        nullif(btrim(v_p->>'rooms'), ''),
        (v_p->>'area_m2')::numeric,
        nullif(btrim(v_p->>'city'), ''),
        nullif(btrim(v_p->>'district'), ''),
        nullif(btrim(v_p->>'neighborhood'), ''),
        nullif(btrim(v_p->>'description'), ''),
        v_raw.source_group_name,
        v_raw.owner_agent_id
    )
    returning id into v_listing_id;

    update raw_listings
    set status = 'approved', parsed = v_p, reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_raw.id;

    return jsonb_build_object('ok', true, 'id', v_listing_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_reject(p_raw_listing_id uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if not exists (select 1 from agents a where a.id = auth.uid() and a.is_admin) then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;

    if not public.session_is_aal2() then
        return jsonb_build_object('ok', false, 'error', 'mfa_required');
    end if;

    if p_reason is null or p_reason not in ('spam', 'duplicate', 'incomplete', 'not_listing', 'other')
       or char_length(coalesce(p_note, '')) > 500 then
        return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;

    update raw_listings
    set status = 'rejected', reject_reason = p_reason, reject_note = nullif(btrim(p_note), ''),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_raw_listing_id and status = 'pending';

    if not found then
        return jsonb_build_object('ok', false, 'error', 'gone');
    end if;
    return jsonb_build_object('ok', true);
end;
$function$;

commit;
