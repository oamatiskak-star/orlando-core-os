-- ============================================================================
-- Migration 144: Hermes Observability Layer (FASE 2-7)
-- ============================================================================
-- ALLEEN views op bestaande tabellen (routing_plans, routing_learning,
-- model_trace, dispatch_queue, logs). Geen nieuwe tabellen/skills/agents.
-- Aggregaties voor usage-, token-, self-optimization- en failure-intelligence.
-- ============================================================================

-- ── FASE 2: SKILL USAGE (24u / 7d / 30d) ────────────────────────────────────
create or replace view hermes.v_skill_usage as
select s.name as skill,
  count(*) filter (where rp.created_at > now()-interval '1 day')  as uses_24h,
  count(*) filter (where rp.created_at > now()-interval '7 days') as uses_7d,
  count(*) filter (where rp.created_at > now()-interval '30 days') as uses_30d
from hermes.routing_plans rp, jsonb_array_elements(rp.candidate_skills) e
  cross join lateral (select e->>'name' as name) s
group by s.name order by uses_30d desc;

-- ── FASE 2: AGENT USAGE ─────────────────────────────────────────────────────
create or replace view hermes.v_agent_usage as
select a.name as agent,
  count(*) filter (where rp.created_at > now()-interval '1 day')  as uses_24h,
  count(*) filter (where rp.created_at > now()-interval '7 days') as uses_7d,
  count(*) filter (where rp.created_at > now()-interval '30 days') as uses_30d
from hermes.routing_plans rp, jsonb_array_elements(rp.candidate_agents) e
  cross join lateral (select e->>'name' as name) a
group by a.name order by uses_30d desc;

-- ── FASE 2: PLAYBOOK USAGE ──────────────────────────────────────────────────
create or replace view hermes.v_playbook_usage as
select rp.final_selection->>'playbook' as playbook,
  count(*) filter (where rp.created_at > now()-interval '1 day')  as uses_24h,
  count(*) filter (where rp.created_at > now()-interval '7 days') as uses_7d,
  count(*) filter (where rp.created_at > now()-interval '30 days') as uses_30d
from hermes.routing_plans rp
where rp.final_selection->>'playbook' is not null
group by 1 order by uses_30d desc;

-- ── FASE 2: PROJECT USAGE (alle 10 projecten, ook 0) ────────────────────────
create or replace view hermes.v_project_usage as
with projects(name) as (values
  ('Aquier'),('SterkCalc'),('Vastgoed Core OS'),('STRKBOUW'),('STRKBEHEER'),
  ('YouTube Engine'),('Affiliate Engine'),('Trading Engine'),('Administratie'),('Marketing'))
select p.name as project,
  count(rp.id) filter (where rp.created_at > now()-interval '1 day')  as plans_24h,
  count(rp.id) filter (where rp.created_at > now()-interval '7 days') as plans_7d,
  count(rp.id) filter (where rp.created_at > now()-interval '30 days') as plans_30d
from projects p
left join hermes.routing_plans rp on rp.active_project = p.name
group by p.name order by plans_30d desc;

-- ── FASE 2/3: MODEL USAGE (provider: calls/tokens/kosten) ───────────────────
create or replace view hermes.v_model_usage as
select t->>'provider' as provider,
  count(*) as calls,
  sum((t->>'inputTokens')::bigint)  as in_tokens,
  sum((t->>'outputTokens')::bigint) as out_tokens,
  round(sum((t->>'cost')::numeric), 5) as cost_usd,
  count(*) filter (where rp.created_at > now()-interval '1 day') as calls_24h
from hermes.routing_plans rp, jsonb_array_elements(rp.model_trace) t
group by 1 order by calls desc;

-- ── FASE 3: TOKEN INTELLIGENCE (24u: werkelijk vs all-Claude theoretisch) ────
-- Claude Sonnet 4.6 referentieprijs: $3/Mtok in, $15/Mtok out.
create or replace view hermes.v_token_intelligence as
with tr as (
  select t->>'provider' as provider,
    (t->>'inputTokens')::bigint it, (t->>'outputTokens')::bigint ot, (t->>'cost')::numeric c
  from hermes.routing_plans rp, jsonb_array_elements(rp.model_trace) t
  where rp.created_at > now()-interval '1 day'
)
select
  count(*) filter (where provider='ollama')    as local_calls,
  count(*) filter (where provider='openai')     as gpt_calls,
  count(*) filter (where provider='anthropic')  as claude_calls,
  count(*)                                       as total_calls,
  round(100.0*count(*) filter (where provider='ollama')/nullif(count(*),0),1) as local_pct,
  sum(it) as in_tokens, sum(ot) as out_tokens,
  round(sum(c),5)                                as actual_cost_usd,
  round(sum(it)/1e6*3 + sum(ot)/1e6*15, 5)       as theoretical_all_claude_usd,
  round(sum(it)/1e6*3 + sum(ot)/1e6*15 - sum(c), 5) as savings_usd
from tr;

-- ── FASE 4: SELF-OPTIMIZATION (skill/agent succesratio uit learning) ────────
create or replace view hermes.v_skill_performance as
select sk as skill,
  count(*) as runs,
  count(*) filter (where rl.success is true)  as successes,
  count(*) filter (where rl.success is false) as failures,
  round(100.0*count(*) filter (where rl.success is true)/nullif(count(*) filter (where rl.success is not null),0),1) as success_pct
from hermes.routing_learning rl, jsonb_array_elements_text(rl.chosen_skills) sk
group by sk order by runs desc;

create or replace view hermes.v_agent_performance as
select ag as agent,
  count(*) as runs,
  count(*) filter (where rl.success is true)  as successes,
  round(100.0*count(*) filter (where rl.success is true)/nullif(count(*) filter (where rl.success is not null),0),1) as success_pct
from hermes.routing_learning rl, jsonb_array_elements_text(rl.chosen_agents) ag
group by ag order by runs desc;

create or replace view hermes.v_project_routes as
select active_project, problem_type, escalation,
  count(*) as runs,
  round(100.0*count(*) filter (where success is true)/nullif(count(*) filter (where success is not null),0),1) as success_pct,
  round(avg(confidence)::numeric,3) as avg_confidence
from hermes.routing_learning
group by 1,2,3 order by runs desc;

-- ── FASE 5: FAILURE INTELLIGENCE (incident-playbooks: freq + succes) ────────
create or replace view hermes.v_failure_intelligence as
select rl.problem_type as failure_type, rl.active_project as project,
  count(*) as frequency,
  count(*) filter (where rl.success is true)  as resolved,
  count(*) filter (where rl.success is false) as unresolved,
  round(100.0*count(*) filter (where rl.success is true)/nullif(count(*) filter (where rl.success is not null),0),1) as resolution_pct,
  count(*) filter (where rl.escalation in ('claude','council')) as escalated
from hermes.routing_learning rl
where rl.problem_type is not null and rl.problem_type not in ('general')
group by 1,2 order by frequency desc;

-- ── FASE 6: CONTROL CENTER (routing-rollup vandaag) ─────────────────────────
create or replace view hermes.v_control_center as
select
  (select count(*) from hermes.routing_requests where created_at > now()-interval '1 day') as requests_24h,
  (select count(*) from hermes.routing_plans    where created_at > now()-interval '1 day') as plans_24h,
  (select count(*) from hermes.routing_requests where status='queued')                     as queue_depth,
  (select count(*) from hermes.routing_requests where status in ('claimed','planning'))    as in_flight,
  (select count(*) from hermes.routing_plans where priority='P1' and created_at > now()-interval '1 day') as incidents_24h,
  (select count(*) from hermes.routing_learning where success is true)  as learning_success,
  (select count(*) from hermes.routing_learning where success is false) as learning_failed,
  (select round(100.0*count(*) filter (where success is true)/nullif(count(*) filter (where success is not null),0),1)
     from hermes.routing_learning) as success_rate_pct,
  (select count(*) from hermes.routing_plans where (final_selection->>'escalation') in ('gpt','claude','council')
     and created_at > now()-interval '1 day') as escalations_24h;

-- ── Grants ──────────────────────────────────────────────────────────────────
do $$
declare v text;
begin
  foreach v in array array['v_skill_usage','v_agent_usage','v_playbook_usage','v_project_usage',
    'v_model_usage','v_token_intelligence','v_skill_performance','v_agent_performance',
    'v_project_routes','v_failure_intelligence','v_control_center'] loop
    execute format('grant select on hermes.%I to authenticated, service_role;', v);
  end loop;
end $$;
