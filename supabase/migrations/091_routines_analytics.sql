-- ─────────────────────────────────────────────────────────────────────────
-- Migration 091 — Routines Analytics functions
-- ─────────────────────────────────────────────────────────────────────────
-- SQL fns voor /routines/analytics dashboard.
-- Geen extra tabellen — alle metrics zijn aggregations over routine_runs.

-- ── routine_metrics_window ───────────────────────────────────────────────
-- Hoofdfunctie: geeft KPI's voor een tijdsvenster.
create or replace function public.routine_metrics_window(p_days integer default 7)
returns jsonb language plpgsql stable as $fn$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_total integer;
  v_completed integer;
  v_failed integer;
  v_recovered integer;
  v_cancelled integer;
  v_avg_seconds numeric;
  v_total_cost_cents bigint;
  v_manual integer;
  v_automated integer;
  v_active_routines integer;
begin
  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'recovered'),
    count(*) filter (where status = 'cancelled'),
    avg(extract(epoch from (ended_at - started_at))) filter (where ended_at is not null),
    coalesce(sum(cost_cents), 0),
    count(*) filter (where trigger_kind in ('manual','retry')),
    count(*) filter (where trigger_kind not in ('manual','retry'))
  into
    v_total, v_completed, v_failed, v_recovered, v_cancelled,
    v_avg_seconds, v_total_cost_cents, v_manual, v_automated
  from public.routine_runs
  where started_at >= v_since;

  select count(distinct id) into v_active_routines
  from public.routines where status = 'active';

  return jsonb_build_object(
    'days',              p_days,
    'since',             v_since,
    'total_runs',        v_total,
    'completed',         v_completed,
    'failed',            v_failed,
    'recovered',         v_recovered,
    'cancelled',         v_cancelled,
    'success_rate',      case when v_total > 0 then round(100.0 * v_completed / v_total, 1) else 0 end,
    'failure_rate',      case when v_total > 0 then round(100.0 * v_failed    / v_total, 1) else 0 end,
    'avg_seconds',       coalesce(round(v_avg_seconds, 1), 0),
    'total_cost_cents',  v_total_cost_cents,
    'avg_cost_cents',    case when v_total > 0 then round(v_total_cost_cents::numeric / v_total, 1) else 0 end,
    'manual_runs',       v_manual,
    'automated_runs',    v_automated,
    'automation_ratio',  case when v_total > 0 then round(100.0 * v_automated / v_total, 1) else 0 end,
    'human_intervention_ratio', case when v_total > 0 then round(100.0 * v_manual / v_total, 1) else 0 end,
    'active_routines',   v_active_routines
  );
end$fn$;

grant execute on function public.routine_metrics_window(integer) to authenticated, service_role;

-- ── routine_metrics_by_day ───────────────────────────────────────────────
-- Per-dag breakdown voor sparkline / heatmap.
create or replace function public.routine_metrics_by_day(p_days integer default 7)
returns table (
  day            date,
  total_runs     bigint,
  completed      bigint,
  failed         bigint,
  avg_seconds    numeric
)
language sql stable as $fn$
  select
    date_trunc('day', rr.started_at)::date as day,
    count(*)                                as total_runs,
    count(*) filter (where rr.status = 'completed') as completed,
    count(*) filter (where rr.status = 'failed')    as failed,
    coalesce(round(avg(extract(epoch from (rr.ended_at - rr.started_at))) filter (where rr.ended_at is not null), 1), 0) as avg_seconds
  from public.routine_runs rr
  where rr.started_at >= now() - make_interval(days => p_days)
  group by 1
  order by 1 desc;
$fn$;

grant execute on function public.routine_metrics_by_day(integer) to authenticated, service_role;

-- ── routine_top_runners ──────────────────────────────────────────────────
-- Top routines op aantal runs in venster.
create or replace function public.routine_top_runners(p_days integer default 7, p_limit integer default 10)
returns table (
  routine_id    uuid,
  name          text,
  kind          text,
  status        text,
  total_runs    bigint,
  success_rate  numeric,
  avg_seconds   numeric,
  total_cost_cents bigint
)
language sql stable as $fn$
  select
    r.id,
    r.name,
    r.kind,
    r.status,
    count(rr.*)                                                                     as total_runs,
    case when count(rr.*) > 0
         then round(100.0 * count(*) filter (where rr.status = 'completed') / count(rr.*), 1)
         else 0
    end                                                                             as success_rate,
    coalesce(round(avg(extract(epoch from (rr.ended_at - rr.started_at))) filter (where rr.ended_at is not null), 1), 0) as avg_seconds,
    coalesce(sum(rr.cost_cents), 0)                                                 as total_cost_cents
  from public.routines r
  left join public.routine_runs rr on rr.routine_id = r.id
    and rr.started_at >= now() - make_interval(days => p_days)
  group by r.id, r.name, r.kind, r.status
  having count(rr.*) > 0
  order by total_runs desc, success_rate desc
  limit p_limit;
$fn$;

grant execute on function public.routine_top_runners(integer, integer) to authenticated, service_role;
