-- ============================================================================
-- Migration 143: Feedback-loop sluiten (FASE 4) + routing-watchdog (FASE 6)
-- ============================================================================
-- Additief. Geen nieuwe architectuur — operationele closure + monitoring.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FASE 4 — close_routing_feedback(): schrijf success terug op routing_learning
--   op basis van de uitkomst van de gedispatchte dispatch_queue-taken.
--     alle 'done'            → success = true
--     één 'failed'           → success = false
--     geen dispatch (advies) → success = true (plan afgerond)
--     anders (nog bezig)     → blijft null
-- ----------------------------------------------------------------------------
create or replace function hermes.close_routing_feedback()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with ps as (
    select rl.id as learn_id,
      (select count(*) from jsonb_array_elements(rp.dispatched_actions) a
         join hermes.dispatch_queue d on d.id=(a->>'dispatch_queue_id')::uuid) as total,
      (select count(*) from jsonb_array_elements(rp.dispatched_actions) a
         join hermes.dispatch_queue d on d.id=(a->>'dispatch_queue_id')::uuid where d.status='done') as done_cnt,
      (select count(*) from jsonb_array_elements(rp.dispatched_actions) a
         join hermes.dispatch_queue d on d.id=(a->>'dispatch_queue_id')::uuid where d.status='failed') as failed_cnt
    from hermes.routing_learning rl
    join hermes.routing_plans rp on rp.id=rl.plan_id
    where rl.success is null
  )
  update hermes.routing_learning rl
  set success = case
        when ps.failed_cnt > 0 then false
        when ps.total > 0 and ps.done_cnt = ps.total then true
        when ps.total = 0 then true
        else null end,
      updated_at = now()
  from ps
  where rl.id = ps.learn_id
    and (ps.failed_cnt > 0 or (ps.total > 0 and ps.done_cnt = ps.total) or ps.total = 0);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function hermes.close_routing_feedback() to service_role;

-- ----------------------------------------------------------------------------
-- FASE 6 — routing_watchdog(): DB-observeerbare gezondheid + stuck-reclaim.
--   (Process-checks ai-router/Ollama online horen op CLI-L local-watchdog;
--    de DB kan localhost niet bereiken.)
-- ----------------------------------------------------------------------------
create or replace function hermes.routing_watchdog()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_reclaimed int; v_queued int; v_stuck int; v_failed int;
begin
  update hermes.routing_requests
    set status='queued', claimed_by=null, claimed_at=null, heartbeat_at=null
    where status in ('claimed','planning')
      and coalesce(heartbeat_at, claimed_at) < now() - interval '10 minutes';
  get diagnostics v_reclaimed = row_count;

  select count(*) into v_queued from hermes.routing_requests where status='queued';
  select count(*) into v_stuck  from hermes.routing_requests where status in ('claimed','planning');
  select count(*) into v_failed from hermes.routing_plans where status='failed' and created_at > now()-interval '1 day';

  insert into hermes.logs(level, event, message, context) values (
    case when v_failed>0 or v_reclaimed>0 then 'warn' else 'info' end,
    'routing_watchdog',
    format('queued=%s stuck=%s reclaimed=%s failed24h=%s', v_queued, v_stuck, v_reclaimed, v_failed),
    jsonb_build_object('queued',v_queued,'stuck',v_stuck,'reclaimed',v_reclaimed,'failed_24h',v_failed,'source','routing_watchdog')
  );
  return jsonb_build_object('queued',v_queued,'stuck',v_stuck,'reclaimed',v_reclaimed,'failed_24h',v_failed);
end $$;
grant execute on function hermes.routing_watchdog() to service_role;

-- ----------------------------------------------------------------------------
-- pg_cron — elke 15 min (idempotent: eerst unschedule indien aanwezig)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname='hermes_routing_feedback') then perform cron.unschedule('hermes_routing_feedback'); end if;
  if exists (select 1 from cron.job where jobname='hermes_routing_watchdog') then perform cron.unschedule('hermes_routing_watchdog'); end if;
  perform cron.schedule('hermes_routing_feedback', '*/15 * * * *', $c$select hermes.close_routing_feedback();$c$);
  perform cron.schedule('hermes_routing_watchdog', '*/15 * * * *', $c$select hermes.routing_watchdog();$c$);
end $$;
