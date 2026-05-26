-- ─────────────────────────────────────────────────────────────────────────
-- Migration 090 — Routines Intelligence Engine
-- ─────────────────────────────────────────────────────────────────────────
-- Voegt 4 detectie-functies + 1 dispatcher toe die periodiek bevindingen
-- inserts in `executive_recommendations` (target_kind='routine') of
-- `executive_alerts` (target_kind='routine').
--
-- Detecties:
--   1) routines_detect_duplications  → meerdere routines die dezelfde HTTP
--                                       URL aanroepen (action.config.url)
--   2) routines_detect_bottlenecks   → avg duration > 30 min over recent
--                                       50 runs
--   3) routines_detect_dead_routines → active routine met 0 runs in 14d
--   4) routines_detect_recovery_gaps → failed runs zonder retry binnen 1u
--
-- Anti-spam: elke detectie checkt of er al een unack'd alert / pending
-- recommendation voor diezelfde target_id bestaat voor we een nieuwe inserten.

-- ── 1. duplications ──────────────────────────────────────────────────────
create or replace function public.routines_detect_duplications()
returns integer language plpgsql security definer as $fn$
declare
  v_inserted integer := 0;
  v_url      text;
  v_routine_ids uuid[];
begin
  for v_url, v_routine_ids in
    select
      (s.config->'url')::text,
      array_agg(distinct s.routine_id)
    from public.routine_steps s
    join public.routines r on r.id = s.routine_id
    where s.type = 'action'
      and s.config ? 'url'
      and r.status in ('active','paused')
    group by (s.config->'url')
    having count(distinct s.routine_id) > 1
  loop
    -- Skip als al een open recommendation voor deze URL
    if exists (
      select 1 from public.executive_recommendations
      where target_kind = 'routine'
        and status     = 'pending'
        and payload->>'finding'   = 'duplication'
        and payload->>'subject'   = v_url
    ) then
      continue;
    end if;

    insert into public.executive_recommendations (action_kind, target_kind, target_id, priority, rationale, payload, status)
    values (
      'dedupe_routines',
      'routine',
      v_routine_ids[1],
      4,
      format('Meerdere routines (%s stuks) roepen dezelfde URL %s aan. Overweeg deduplicatie via shared workflow.',
             array_length(v_routine_ids, 1), trim(both '"' from v_url)),
      jsonb_build_object(
        'finding',     'duplication',
        'subject',     v_url,
        'routine_ids', to_jsonb(v_routine_ids)
      ),
      'pending'
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end$fn$;

-- ── 2. bottlenecks ───────────────────────────────────────────────────────
create or replace function public.routines_detect_bottlenecks()
returns integer language plpgsql security definer as $fn$
declare
  v_inserted integer := 0;
  v_routine_id uuid;
  v_avg_seconds numeric;
  v_sample_size integer;
  v_routine_name text;
begin
  for v_routine_id, v_avg_seconds, v_sample_size, v_routine_name in
    with stats as (
      select
        rr.routine_id,
        avg(extract(epoch from (rr.ended_at - rr.started_at))) as avg_seconds,
        count(*) as sample_size
      from public.routine_runs rr
      where rr.status in ('completed','failed','recovered')
        and rr.ended_at is not null
        and rr.started_at > now() - interval '7 days'
      group by rr.routine_id
      having count(*) >= 5
    )
    select s.routine_id, s.avg_seconds, s.sample_size, r.name
    from stats s
    join public.routines r on r.id = s.routine_id
    where s.avg_seconds > 1800     -- 30 minuten
  loop
    if exists (
      select 1 from public.executive_alerts
      where target_kind = 'routine'
        and target_id   = v_routine_id
        and alert_kind  = 'bottleneck'
        and acknowledged_at is null
    ) then
      continue;
    end if;

    insert into public.executive_alerts (alert_kind, severity, target_kind, target_id, title, message, payload)
    values (
      'bottleneck',
      case when v_avg_seconds > 3600 then 'high' else 'medium' end,
      'routine',
      v_routine_id,
      format('Routine "%s" gemiddeld %s min/run', v_routine_name, round(v_avg_seconds / 60.0, 1)),
      format('Over de laatste %s runs (7 dagen) duurt elke run gemiddeld %s seconden. Overweeg opsplitsen of optimaliseren.',
             v_sample_size, round(v_avg_seconds, 0)),
      jsonb_build_object(
        'avg_seconds',  v_avg_seconds,
        'sample_size',  v_sample_size,
        'threshold_seconds', 1800
      )
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end$fn$;

-- ── 3. dead routines ─────────────────────────────────────────────────────
create or replace function public.routines_detect_dead_routines()
returns integer language plpgsql security definer as $fn$
declare
  v_inserted integer := 0;
  v_routine_id uuid;
  v_routine_name text;
  v_last_run_at timestamptz;
begin
  for v_routine_id, v_routine_name, v_last_run_at in
    select r.id, r.name, max(rr.started_at)
    from public.routines r
    left join public.routine_runs rr on rr.routine_id = r.id
    where r.status = 'active'
      and r.created_at < now() - interval '14 days'
    group by r.id, r.name
    having coalesce(max(rr.started_at), '-infinity'::timestamptz) < now() - interval '14 days'
  loop
    if exists (
      select 1 from public.executive_recommendations
      where target_kind = 'routine'
        and target_id   = v_routine_id
        and status      = 'pending'
        and payload->>'finding' = 'dead_routine'
    ) then
      continue;
    end if;

    insert into public.executive_recommendations (action_kind, target_kind, target_id, priority, rationale, payload, status)
    values (
      'archive_dead_routine',
      'routine',
      v_routine_id,
      5,
      format('Routine "%s" is active maar heeft geen runs in 14 dagen (laatste: %s). Overweeg disabled of archiveren.',
             v_routine_name, coalesce(v_last_run_at::text, 'nooit')),
      jsonb_build_object(
        'finding',      'dead_routine',
        'routine_name', v_routine_name,
        'last_run_at',  v_last_run_at
      ),
      'pending'
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end$fn$;

-- ── 4. recovery gaps ─────────────────────────────────────────────────────
create or replace function public.routines_detect_recovery_gaps()
returns integer language plpgsql security definer as $fn$
declare
  v_inserted integer := 0;
  v_count integer;
begin
  -- Tel failed runs in laatste 24u die geen retry-run hebben
  select count(*) into v_count
  from public.routine_runs failed
  where failed.status = 'failed'
    and failed.ended_at > now() - interval '24 hours'
    and not exists (
      select 1 from public.routine_runs retry
      where retry.parent_run_id = failed.id
        and retry.started_at > failed.ended_at
    );

  if v_count = 0 then return 0; end if;

  -- 1 globale alert (target_id NULL — meta-finding voor het hele systeem)
  if not exists (
    select 1 from public.executive_alerts
    where alert_kind = 'recovery_gap'
      and target_kind = 'routine'
      and acknowledged_at is null
      and detected_at > now() - interval '24 hours'
  ) then
    insert into public.executive_alerts (alert_kind, severity, target_kind, target_id, title, message, payload)
    values (
      'recovery_gap',
      case when v_count > 5 then 'high' when v_count > 1 then 'medium' else 'low' end,
      'routine',
      null,
      format('%s failed runs zonder retry (24u)', v_count),
      'Een aantal failed runs heeft geen automatische of handmatige restart gehad. Overweeg auto_recover toggle aan te zetten in Settings.',
      jsonb_build_object('failed_without_retry_24h', v_count)
    );
    v_inserted := 1;
  end if;

  return v_inserted;
end$fn$;

-- ── 5. Dispatcher: routines_intelligence_tick ────────────────────────────
create or replace function public.routines_intelligence_tick()
returns jsonb language plpgsql security definer as $fn$
declare
  v_dup integer;
  v_bot integer;
  v_dead integer;
  v_recov integer;
begin
  v_dup   := public.routines_detect_duplications();
  v_bot   := public.routines_detect_bottlenecks();
  v_dead  := public.routines_detect_dead_routines();
  v_recov := public.routines_detect_recovery_gaps();

  insert into public.routine_audit_log (action, actor, detail)
  values (
    'intelligence.tick',
    'system',
    jsonb_build_object(
      'duplications',   v_dup,
      'bottlenecks',    v_bot,
      'dead_routines',  v_dead,
      'recovery_gaps',  v_recov,
      'at',             now()
    )
  );

  return jsonb_build_object(
    'duplications',   v_dup,
    'bottlenecks',    v_bot,
    'dead_routines',  v_dead,
    'recovery_gaps',  v_recov
  );
end$fn$;

-- ── 6. pg_cron schedule (elke 15 minuten) ────────────────────────────────
do $blk$
begin
  if exists (select 1 from cron.job where jobname = 'routines_intelligence_tick') then
    perform cron.unschedule('routines_intelligence_tick');
  end if;
end$blk$;

select cron.schedule(
  'routines_intelligence_tick',
  '*/15 * * * *',
  'select public.routines_intelligence_tick();'
);
