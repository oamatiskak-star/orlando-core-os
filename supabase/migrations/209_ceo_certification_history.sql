-- 209_ceo_certification_history.sql
-- Certification-historie: "is de fabriek al N dagen aaneengesloten gecertificeerd?".
-- Hergebruikt de bestaande dagelijkse snapshot-job (capture_ceo_minutes, cron 03:00) — GEEN nieuwe job.
create table if not exists public.ceo_certification_history (
  day date primary key, all_pass boolean not null, status text, criteria_passed int, ceo_minutes int,
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
  on conflict (day) do update set ceo_minutes=excluded.ceo_minutes, manual_reviews=excluded.manual_reviews,
    failing_checks=excluded.failing_checks, open_incidents=excluded.open_incidents, open_escalations=excluded.open_escalations, captured_at=excluded.captured_at;
  insert into public.ceo_certification_history (day, all_pass, status, criteria_passed, ceo_minutes, captured_at)
  select current_date, all_pass, status,
    (c1_no_human_7d::int + c2_uploads_flowing::int + c3_channels_healthy::int + c4_winners_proxy::int + c5_strategy_improving::int
     + c6_incidents_detected::int + c7_incidents_diagnosed::int + c8_incidents_healed::int + c9_recovery_validated::int + c10_low_escalation::int),
    ceo_minutes_estimate, now()
  from public.v_media_factory_certification
  on conflict (day) do update set all_pass=excluded.all_pass, status=excluded.status, criteria_passed=excluded.criteria_passed,
    ceo_minutes=excluded.ceo_minutes, captured_at=excluded.captured_at;
end$$;
create or replace view public.v_ceo_certification_streak as
with flagged as (
  select day, all_pass, sum(case when all_pass then 0 else 1 end) over (order by day desc) as breaks
  from public.ceo_certification_history
)
select coalesce((select count(*) from flagged where breaks=0 and all_pass),0)::int as green_streak_days,
  (select max(day) from public.ceo_certification_history where all_pass) as last_green_day,
  coalesce((select all_pass from public.ceo_certification_history where day=current_date),false) as green_today,
  (select count(*) from public.ceo_certification_history)::int as days_tracked;
insert into public.ceo_certification_history (day, all_pass, status, criteria_passed, ceo_minutes)
select current_date, all_pass, status,
  (c1_no_human_7d::int + c2_uploads_flowing::int + c3_channels_healthy::int + c4_winners_proxy::int + c5_strategy_improving::int
   + c6_incidents_detected::int + c7_incidents_diagnosed::int + c8_incidents_healed::int + c9_recovery_validated::int + c10_low_escalation::int),
  ceo_minutes_estimate
from public.v_media_factory_certification
on conflict (day) do update set all_pass=excluded.all_pass, status=excluded.status, criteria_passed=excluded.criteria_passed, captured_at=now();
grant select on public.ceo_certification_history, public.v_ceo_certification_streak to authenticated, anon;
