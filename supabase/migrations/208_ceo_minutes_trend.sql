-- 208_ceo_minutes_trend.sql
-- CEO Minutes-trend: dagelijkse snapshot van v_ceo_minutes_daily → historie + trend-view.
-- Engine-Planner-conform: geregistreerd in engine_schedule (block 'janitor' 00-04u), cron 03:00,
-- gated op engine_window_open (fail-open zodat een ontbrekende gate de harmless snapshot niet breekt).
create table if not exists public.ceo_minutes_history (
  day date primary key,
  ceo_minutes int not null,
  manual_reviews int, failing_checks int, open_incidents int, open_escalations int,
  captured_at timestamptz not null default now()
);
create or replace function public.capture_ceo_minutes() returns void
language plpgsql security definer set search_path='' as $$
declare ok boolean;
begin
  begin ok := public.engine_window_open('ceo:minutes-snapshot'); exception when others then ok := true; end;
  if not ok then return; end if;
  insert into public.ceo_minutes_history (day, ceo_minutes, manual_reviews, failing_checks, open_incidents, open_escalations, captured_at)
  select day, ceo_minutes_estimate, manual_reviews, failing_checks, open_incidents, open_escalations, now()
  from public.v_ceo_minutes_daily
  on conflict (day) do update set
    ceo_minutes=excluded.ceo_minutes, manual_reviews=excluded.manual_reviews, failing_checks=excluded.failing_checks,
    open_incidents=excluded.open_incidents, open_escalations=excluded.open_escalations, captured_at=excluded.captured_at;
end$$;
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('ceo:minutes-snapshot','ceo','CEO Minutes dag-snapshot','janitor',true)
on conflict (engine_key) do nothing;
do $$ begin
  if exists (select 1 from cron.job where jobname='ceo-minutes-snapshot') then perform cron.unschedule('ceo-minutes-snapshot'); end if;
end $$;
select cron.schedule('ceo-minutes-snapshot','0 3 * * *', $cron$ select public.capture_ceo_minutes(); $cron$);
create or replace view public.v_ceo_minutes_trend as
select day, ceo_minutes, 20 as target_minutes
from public.ceo_minutes_history where day > current_date - 30 order by day;
insert into public.ceo_minutes_history (day, ceo_minutes, manual_reviews, failing_checks, open_incidents, open_escalations)
select day, ceo_minutes_estimate, manual_reviews, failing_checks, open_incidents, open_escalations
from public.v_ceo_minutes_daily on conflict (day) do update set ceo_minutes=excluded.ceo_minutes, captured_at=now();
grant select on public.ceo_minutes_history, public.v_ceo_minutes_trend to authenticated, anon;
