-- ============================================================================
-- Migration 145: Hermes Execution OS — producer on-ramp + executor + observ.
-- ============================================================================
-- Additief. Maakt Hermes uitvoerend:
--  - submit_routing_request(): elke cron/engine/trigger/dashboard kan producer worden.
--  - exec_claim(): de Hermes-executor claimt eigen gedispatchte analyse-taken.
--  - execution-observability views (producers/consumers/queue).
-- Bestaande engines blijven werken; dit is een NIEUWE consumer naast hen.
-- ============================================================================

-- Registreer de executor als host (claimed_by FK → hosts).
insert into hermes.hosts (host_id, label, role, capabilities, active)
values ('hermes-exec', 'Hermes Executor', 'ops', '["analysis","triage"]'::jsonb, true)
on conflict (host_id) do update set active=true, updated_at=now();

-- ── PRODUCER ON-RAMP (FASE 2) ───────────────────────────────────────────────
-- Eén SQL-call waarmee elke producer (pg_cron, engine, DB-trigger, dashboard via
-- RPC) een routing_request maakt i.p.v. zelf uit te voeren.
create or replace function hermes.submit_routing_request(
  p_company uuid, p_message text, p_source text default 'engine', p_incident boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into hermes.routing_requests(company_id, raw_message, source, requested_by, is_incident, status)
  values (p_company, p_message, p_source, p_source, p_incident, 'queued')
  returning id into v_id;
  return v_id;
end $$;
grant execute on function hermes.submit_routing_request(uuid, text, text, boolean) to service_role, authenticated;

-- ── DISPATCH EXECUTOR CLAIM (FASE 3) ────────────────────────────────────────
-- De Hermes-executor claimt zijn eigen gedispatchte items (source=hermes-orchestrator),
-- race-veilig, ongeacht target_host. Zet status='running'.
create or replace function hermes.exec_claim(p_limit int default 3)
returns setof hermes.dispatch_queue language plpgsql security definer set search_path = '' as $$
begin
  return query
  with c as (
    select d.id from hermes.dispatch_queue d
    where d.status='queued' and d.payload->>'source'='hermes-orchestrator'
    order by d.priority asc, d.created_at asc
    limit greatest(p_limit,0) for update skip locked
  )
  update hermes.dispatch_queue d
    set status='running', claimed_by='hermes-exec', claimed_at=now(), heartbeat_at=now(), updated_at=now()
  from c where d.id=c.id returning d.*;
end $$;
grant execute on function hermes.exec_claim(int) to service_role;

-- ── EXECUTION OBSERVABILITY (FASE 11) ───────────────────────────────────────
create or replace view hermes.v_producer_stats as
select source as producer,
  count(*) filter (where created_at > now()-interval '1 day')  as requests_24h,
  count(*) filter (where created_at > now()-interval '7 days') as requests_7d,
  count(*) filter (where created_at > now()-interval '30 days') as requests_30d
from hermes.routing_requests group by source order by requests_30d desc;

create or replace view hermes.v_consumer_stats as
select coalesce(claimed_by,'(onbewerkt)') as consumer,
  count(*) as items,
  count(*) filter (where status='done')    as done,
  count(*) filter (where status='failed')  as failed,
  count(*) filter (where status in ('queued','claimed','running')) as open
from hermes.dispatch_queue
where payload->>'source'='hermes-orchestrator'
group by 1 order by items desc;

create or replace view hermes.v_queue_health as
select
  count(*) filter (where status='queued')  as queued,
  count(*) filter (where status='claimed') as claimed,
  count(*) filter (where status='running') as running,
  count(*) filter (where status='done')    as done,
  count(*) filter (where status='failed')  as failed,
  count(*) filter (where status in ('claimed','running') and coalesce(heartbeat_at,claimed_at) < now()-interval '15 minutes') as stuck
from hermes.dispatch_queue
where payload->>'source'='hermes-orchestrator';

create or replace view hermes.v_engine_success as
select payload->>'skill' as skill,
  count(*) as dispatched,
  count(*) filter (where status='done')   as executed,
  count(*) filter (where status='failed') as failed,
  round(100.0*count(*) filter (where status='done')/nullif(count(*) filter (where status in ('done','failed')),0),1) as success_pct
from hermes.dispatch_queue
where payload->>'source'='hermes-orchestrator'
group by 1 order by dispatched desc;

do $$
declare v text;
begin
  foreach v in array array['v_producer_stats','v_consumer_stats','v_queue_health','v_engine_success'] loop
    execute format('grant select on hermes.%I to authenticated, service_role;', v);
  end loop;
end $$;
