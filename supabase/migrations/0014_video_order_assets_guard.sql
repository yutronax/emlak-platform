-- 0014_video_order_assets_guard.sql
-- video_order_assets için sayı sınırı ve durum korumasını veritabanında atomik zorlar (RT-2, RT-3).
-- Idempotent: tekrar çalıştırılabilir.
-- Sayılar web/src/lib/video-orders/limits.ts MAX_PHOTOS / MAX_RAW_VIDEOS ile aynı olmalı.

create or replace function video_order_assets_guard() returns trigger
language plpgsql as $$
declare
    v_order_id uuid;
    v_status text;
    v_count integer;
begin
    v_order_id := case when tg_op = 'DELETE' then old.order_id else new.order_id end;

    -- Siparişi kilitle: submitVideoOrder'ın UPDATE'i ile serileşir.
    select status into v_status from video_orders where id = v_order_id for update;

    -- Sipariş silinme sürecinde (on delete cascade): silmeyi engelleme.
    if tg_op = 'DELETE' and not found then
        return old;
    end if;

    if not found or v_status <> 'draft' then
        raise exception 'ORDER_NOT_DRAFT' using errcode = 'P0001';
    end if;

    if tg_op = 'INSERT' then
        select count(*) into v_count
            from video_order_assets
            where order_id = new.order_id and kind = new.kind;
        if (new.kind = 'photo' and v_count >= 30) or (new.kind = 'raw_video' and v_count >= 5) then
            raise exception 'ASSET_LIMIT_REACHED' using errcode = 'P0001';
        end if;
        return new;
    end if;

    return old;
end;
$$;

drop trigger if exists video_order_assets_guard on video_order_assets;
create trigger video_order_assets_guard
    before insert or delete on video_order_assets
    for each row execute function video_order_assets_guard();

-- Gönderim (draft -> awaiting_payment) anında dosya sayısını kilitli satır üzerinde doğrular;
-- asset trigger'ı aynı satırı kilitlediği için silme ile gönderim yarışamaz.
-- Sayılar limits.ts MIN_PHOTOS ile aynı olmalı.
create or replace function video_orders_submit_guard() returns trigger
language plpgsql as $$
declare
    v_count integer;
begin
    if old.status = 'draft' and new.status = 'awaiting_payment' then
        select count(*) into v_count from video_order_assets where order_id = new.id;
        if (new.service_code = 'photos' and v_count < 3) or v_count < 1 then
            raise exception 'ASSETS_REQUIRED' using errcode = 'P0001';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists video_orders_submit_guard on video_orders;
create trigger video_orders_submit_guard
    before update of status on video_orders
    for each row execute function video_orders_submit_guard();
