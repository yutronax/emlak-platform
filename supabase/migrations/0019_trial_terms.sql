-- 0019_trial_terms.sql
-- EML-90 / EML-93 (p0-vitrin-guven): 14 gün deneme + KVKK onay kaydı.
-- Idempotent: tekrar çalıştırılabilir.

-- 1) agents: deneme kullanıldı işareti + KVKK onay kaydı (sunucu yazar).
alter table agents add column if not exists trial_started_at timestamptz;
alter table agents add column if not exists terms_accepted_at timestamptz;
alter table agents add column if not exists terms_version text;

-- Mevcut ajanların deneme hakkı kapatılır (abonelik oluşturulmaz). Kullanıcı kararı 2026-10-28.
update agents set trial_started_at = created_at where trial_started_at is null;

-- 2) Deneme başlatma. Argüman almaz: hedef auth.uid(), süre ve plan sabit.
--    Satır kilidi (update ... where trial_started_at is null) eşzamanlı ikinci çağrıyı 0 satıra düşürür.
--    Exception transaction'ı geri alır: trial_started_at de geri döner, kullanıcı tekrar deneyebilir.
create or replace function start_trial()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_plan uuid;
begin
    update agents
    set trial_started_at = now()
    where id = auth.uid()
      and trial_started_at is null
      and not exists (select 1 from subscriptions where agent_id = auth.uid());

    if not found then
        return false;
    end if;

    select id into v_plan from plans order by price_minor_unit asc limit 1;
    if v_plan is null then
        raise exception 'plan bulunamadı';
    end if;

    insert into subscriptions (agent_id, plan_id, status, current_period_end)
    values (auth.uid(), v_plan, 'trialing', now() + interval '14 days');

    return true;
end;
$$;

-- 3) Yetki: yalnız oturumlu kullanıcılar. Supabase anon rolü ayrı grant aldığı için anon da açıkça kaldırılır.
revoke all on function start_trial() from public;
revoke execute on function start_trial() from anon;
grant execute on function start_trial() to authenticated;
