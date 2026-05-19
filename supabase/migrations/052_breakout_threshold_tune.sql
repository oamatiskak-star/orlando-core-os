-- 052_breakout_threshold_tune.sql
-- Eerste live demo (2026-05-19) toonde aan: 50% velocity-delta is te streng
-- voor real-time top mostPopular content. Universal Music India 'Mashooqa'
-- had +25.4% in 9 min — duidelijke trending signal die we wilden detecteren.
-- Verlaag naar 20% delta met behoud van interval-floor (≥5 min) en
-- absolute velocity-floor (≥1000/u).

create or replace function public.detect_viral_breakout(p_viral_opportunity_id uuid)
returns table (
  is_breakout boolean,
  velocity_delta_pct numeric,
  current_velocity numeric,
  previous_velocity numeric,
  seconds_between integer
) language plpgsql stable security definer set search_path = public as $f$
declare
  v_cur record;
  v_prev record;
  v_delta numeric;
  v_seconds_between integer;
begin
  select * into v_cur from public.viral_opportunity_snapshots
   where viral_opportunity_id = p_viral_opportunity_id
   order by captured_at desc limit 1;
  if v_cur is null then
    return query select false, 0::numeric, 0::numeric, 0::numeric, 0; return;
  end if;
  select * into v_prev from public.viral_opportunity_snapshots
   where viral_opportunity_id = p_viral_opportunity_id and captured_at < v_cur.captured_at
   order by captured_at desc limit 1;
  if v_prev is null then
    return query select false, 0::numeric, v_cur.view_velocity, 0::numeric, 0; return;
  end if;
  v_seconds_between := extract(epoch from (v_cur.captured_at - v_prev.captured_at))::int;
  if v_prev.view_velocity <= 0 then v_delta := 100;
  else v_delta := ((v_cur.view_velocity - v_prev.view_velocity) / v_prev.view_velocity) * 100;
  end if;
  -- THRESHOLD: 20% delta (was 50%) + minimaal 5 min interval + velocity >= 1000/u
  return query select
    (v_delta >= 20 and v_seconds_between >= 300 and v_cur.view_velocity >= 1000),
    v_delta, v_cur.view_velocity, v_prev.view_velocity, v_seconds_between;
end
$f$;
