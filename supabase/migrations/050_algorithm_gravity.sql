-- 050_algorithm_gravity.sql
-- Phase 3 — Algorithm Gravity Engine
--
-- Tracking van viral_opportunities velocity over tijd zodat breakouts
-- gedetecteerd kunnen worden door delta-vergelijking tussen snapshots.
-- Bij significante velocity-delta: log event + spawn winner_extraction_jobs.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Snapshots tabel — één rij per scan-occurrence
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.viral_opportunity_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  viral_opportunity_id uuid not null references public.viral_opportunities(id) on delete cascade,
  views               bigint not null default 0,
  view_velocity       numeric(14,2) not null default 0,
  virality_score      integer not null default 0,
  captured_at         timestamptz not null default now()
);

create index if not exists idx_viral_snapshots_opp
  on viral_opportunity_snapshots(viral_opportunity_id, captured_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Snapshot trigger op viral_opportunities — bij update van views/velocity/score
--    schrijf een snapshot zodat we delta's kunnen berekenen.
--    Bij INSERT wordt ook een baseline snapshot geschreven.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.capture_viral_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  -- Sla snapshot alleen op bij INSERT of bij meaningful change
  if tg_op = 'INSERT' or
     new.views is distinct from old.views or
     new.view_velocity is distinct from old.view_velocity or
     new.virality_score is distinct from old.virality_score then
    insert into public.viral_opportunity_snapshots (
      viral_opportunity_id, views, view_velocity, virality_score, captured_at
    ) values (
      new.id, new.views, new.view_velocity, new.virality_score, now()
    );
  end if;
  return new;
end
$f$;

drop trigger if exists trg_capture_viral_snapshot on public.viral_opportunities;
create trigger trg_capture_viral_snapshot
  after insert or update of views, view_velocity, virality_score
  on public.viral_opportunities
  for each row execute function public.capture_viral_snapshot();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Breakout-detectie functie. Vergelijkt huidige snapshot met de voorgaande
--    voor dezelfde viral_opportunity. Returnt magnitude (velocity_delta_pct)
--    + boolean of dit een breakout is.
--
--    Breakout-definitie:
--    - Velocity moet >= 50% gestegen zijn t.o.v. vorige snapshot
--    - Tijdsverschil tussen snapshots minimaal 5 minuten (anders ruis)
--    - Huidige velocity moet >= 1000 views/uur zijn (anders te klein)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.detect_viral_breakout(p_viral_opportunity_id uuid)
returns table (
  is_breakout         boolean,
  velocity_delta_pct  numeric,
  current_velocity    numeric,
  previous_velocity   numeric,
  seconds_between     integer
)
language plpgsql
stable
security definer
set search_path = public
as $f$
declare
  v_cur record;
  v_prev record;
  v_delta numeric;
  v_seconds_between integer;
begin
  -- Pak de twee meest recente snapshots
  select * into v_cur
    from public.viral_opportunity_snapshots
   where viral_opportunity_id = p_viral_opportunity_id
   order by captured_at desc limit 1;

  if v_cur is null then
    return query select false, 0::numeric, 0::numeric, 0::numeric, 0;
    return;
  end if;

  select * into v_prev
    from public.viral_opportunity_snapshots
   where viral_opportunity_id = p_viral_opportunity_id
     and captured_at < v_cur.captured_at
   order by captured_at desc limit 1;

  if v_prev is null then
    return query select false, 0::numeric, v_cur.view_velocity, 0::numeric, 0;
    return;
  end if;

  v_seconds_between := extract(epoch from (v_cur.captured_at - v_prev.captured_at))::int;

  if v_prev.view_velocity <= 0 then
    v_delta := 100;
  else
    v_delta := ((v_cur.view_velocity - v_prev.view_velocity) / v_prev.view_velocity) * 100;
  end if;

  return query select
    (v_delta >= 50 and v_seconds_between >= 300 and v_cur.view_velocity >= 1000),
    v_delta,
    v_cur.view_velocity,
    v_prev.view_velocity,
    v_seconds_between;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Executor enum uitbreiding voor 'gravity_detector'
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper view: latest snapshot per viral opportunity (voor dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_viral_with_gravity as
  select
    vo.*,
    (select count(*) from public.algorithm_gravity_events e where e.notes like '%' || vo.id::text || '%') AS gravity_event_count
  from public.viral_opportunities vo;
