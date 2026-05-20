-- Migration 076: Executive Intelligence Layer
-- C-suite voor de Media Holding: 6 LLM-gedreven agents (ATLAS, Viral Analyst,
-- Channel Managers, Algorithm Strategist, Retention Scientist, Content Fund
-- Manager) + Decision Engine + Alert Engine + Content Fund + autonome scaling.
--
-- Leest van bestaande tabellen (viral_opportunities, algorithm_gravity_events,
-- retention_lab_samples, hook_library, media_holding_metrics, monetization_*).
-- Schrijft naar nieuwe executive_* tabellen.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. executive_agents — registry van de 6 C-suite agents
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_agents (
  id                  uuid primary key default gen_random_uuid(),
  agent_key           text not null unique
                         check (agent_key in ('atlas','viral_analyst','channel_manager','algorithm_strategist','retention_scientist','content_fund_manager')),
  name                text not null,
  role_persona        text not null,
  system_prompt       text not null,
  model               text not null default 'claude-sonnet-4-6',
  max_tokens          integer not null default 4096,
  schedule_cron       text,
  enabled             boolean not null default true,
  last_run_at         timestamptz,
  last_run_status     text
                         check (last_run_status in ('idle','running','completed','failed')),
  config              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_executive_agents_enabled on executive_agents(enabled) where enabled;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. executive_agent_runs — audit-trail per run
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_agent_runs (
  id                  uuid primary key default gen_random_uuid(),
  agent_key           text not null references public.executive_agents(agent_key) on update cascade,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  status              text not null default 'running'
                         check (status in ('running','completed','failed','skipped')),
  input_snapshot      jsonb not null default '{}'::jsonb,
  output              jsonb not null default '{}'::jsonb,
  tokens_in           integer not null default 0,
  tokens_out          integer not null default 0,
  cost_usd            numeric(10,4) not null default 0,
  error               text,
  scope               jsonb not null default '{}'::jsonb
);
create index if not exists idx_executive_runs_agent on executive_agent_runs(agent_key, started_at desc);
create index if not exists idx_executive_runs_status on executive_agent_runs(status, started_at desc);
create index if not exists idx_executive_runs_scope_channel on executive_agent_runs((scope->>'channel_id'));
create index if not exists idx_executive_runs_scope_content on executive_agent_runs((scope->>'content_id'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. executive_decisions — Decision Engine output per kanaal per run
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_decisions (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid not null references public.media_holding_channels(id) on delete cascade,
  decided_at          timestamptz not null default now(),
  status              text not null
                         check (status in ('promising','breakout','scale_ready','saturated','underperforming','terminated')),
  confidence          numeric(4,3) not null default 0.0
                         check (confidence >= 0 and confidence <= 1),
  rationale           jsonb not null default '{}'::jsonb,
  metrics_snapshot    jsonb not null default '{}'::jsonb,
  source_run_id       uuid references public.executive_agent_runs(id) on delete set null
);
create index if not exists idx_executive_decisions_channel on executive_decisions(channel_id, decided_at desc);
create index if not exists idx_executive_decisions_status on executive_decisions(status, decided_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. channel_status_history — transitie-tijdslijn
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_status_history (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid not null references public.media_holding_channels(id) on delete cascade,
  from_status         text,
  to_status           text not null,
  changed_at          timestamptz not null default now(),
  reason              text,
  decision_id         uuid references public.executive_decisions(id) on delete set null
);
create index if not exists idx_channel_status_history_channel on channel_status_history(channel_id, changed_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. executive_reports — boardroom rapporten
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_reports (
  id                  uuid primary key default gen_random_uuid(),
  report_kind         text not null
                         check (report_kind in ('daily_briefing','weekly_boardroom','channel_deep_dive','viral_post_mortem','retention_intelligence','algorithm_strategy','fund_allocation')),
  period_start        timestamptz not null,
  period_end          timestamptz not null,
  title               text not null,
  summary_md          text not null default '',
  sections            jsonb not null default '[]'::jsonb,
  generated_by_agent  text references public.executive_agents(agent_key) on update cascade,
  generated_run_id    uuid references public.executive_agent_runs(id) on delete set null,
  scope               jsonb not null default '{}'::jsonb,
  generated_at        timestamptz not null default now()
);
create index if not exists idx_executive_reports_kind on executive_reports(report_kind, generated_at desc);
create index if not exists idx_executive_reports_period on executive_reports(period_start desc);
create index if not exists idx_executive_reports_scope_channel on executive_reports((scope->>'channel_id'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. executive_recommendations — concrete acties met CTA-binding
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_recommendations (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid references public.executive_reports(id) on delete cascade,
  action_kind         text not null
                         check (action_kind in ('scale_channel','kill_niche','clone_winner','amplify_variant','launch_swarm','pause_channel','approve_strategy','launch_expansion','increase_production','generate_better_hook','clone_retention_pattern','optimize_pacing','activate_swarm_mode','push_variants','increase_upload_frequency','analyze_competitor','clone_format','build_counter_strategy','increase_budget','reduce_spend','shift_resources','create_variant_wave','launch_new_channel')),
  target_kind         text not null
                         check (target_kind in ('channel','content','niche','competitor','allocation','ecosystem')),
  target_id           uuid,
  priority            integer not null default 3
                         check (priority between 1 and 5),
  rationale           text,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
                         check (status in ('pending','approved','dismissed','executed','expired')),
  executed_at         timestamptz,
  executed_by         text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_executive_recs_status on executive_recommendations(status, priority desc, created_at desc);
create index if not exists idx_executive_recs_target on executive_recommendations(target_kind, target_id);
create index if not exists idx_executive_recs_report on executive_recommendations(report_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. executive_alerts — realtime alerts met severity
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.executive_alerts (
  id                  uuid primary key default gen_random_uuid(),
  alert_kind          text not null
                         check (alert_kind in ('breakout','upload_failure','trend_explosion','saturation_warning','velocity_spike','high_retention','subscriber_acceleration')),
  severity            text not null default 'info'
                         check (severity in ('info','warn','critical')),
  target_kind         text not null
                         check (target_kind in ('channel','content','niche','competitor','ecosystem')),
  target_id           uuid,
  title               text not null,
  message             text not null default '',
  payload             jsonb not null default '{}'::jsonb,
  detected_at         timestamptz not null default now(),
  acknowledged_at     timestamptz,
  acknowledged_by     uuid references auth.users(id) on delete set null
);
create index if not exists idx_executive_alerts_severity on executive_alerts(severity, detected_at desc);
create index if not exists idx_executive_alerts_unack on executive_alerts(acknowledged_at) where acknowledged_at is null;
create index if not exists idx_executive_alerts_kind on executive_alerts(alert_kind, detected_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. content_fund_allocations — render-budget per kanaal per week
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.content_fund_allocations (
  id                  uuid primary key default gen_random_uuid(),
  period_start        date not null,
  period_end          date not null,
  channel_id          uuid references public.media_holding_channels(id) on delete cascade,
  niche               text,
  allocated_eur       numeric(10,2) not null default 0,
  spent_eur           numeric(10,2) not null default 0,
  views_attributed    bigint not null default 0,
  revenue_attributed  numeric(10,2) not null default 0,
  roi_estimate        numeric(8,3) not null default 0,
  status              text not null default 'active'
                         check (status in ('proposed','active','closed','overspent')),
  rationale           text,
  generated_run_id    uuid references public.executive_agent_runs(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_content_fund_alloc_period on content_fund_allocations(period_start desc);
create index if not exists idx_content_fund_alloc_channel on content_fund_allocations(channel_id, period_start desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ALTERs op bestaande tabellen
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.media_holding_channels
  add column if not exists kpi_targets         jsonb not null default '{}'::jsonb,
  add column if not exists current_status      text
                              check (current_status in ('promising','breakout','scale_ready','saturated','underperforming','terminated')),
  add column if not exists current_status_at   timestamptz;

alter table public.media_holding_content_items
  add column if not exists render_cost_eur     numeric(8,2) not null default 0,
  add column if not exists revenue_attributed  numeric(10,2) not null default 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. View: v_retention_intelligence_summary (per kanaal)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_retention_intelligence_summary as
select
  ci.channel_id                                                                          as channel_id,
  c.name                                                                                 as channel_name,
  c.niche                                                                                as niche,
  count(distinct ci.id)                                                                  as content_items_sampled,
  count(rls.id)                                                                          as samples_total,
  avg(rls.retention_pct) filter (where rls.second_index <= 3)                            as avg_first_3s,
  avg(rls.retention_pct) filter (where rls.second_index between 4 and 10)                as avg_first_10s,
  avg(rls.retention_pct)                                                                 as avg_overall,
  count(distinct ci.id) filter (where ci.retention_analysis is not null)                 as items_with_analysis,
  max(rls.collected_at)                                                                  as last_sample_at
from public.media_holding_content_items ci
join public.media_holding_channels c on c.id = ci.channel_id
left join public.retention_lab_samples rls on rls.content_item_id = ci.id
where ci.created_at > now() - interval '30 days'
group by ci.channel_id, c.name, c.niche;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. View: v_executive_kpis (ecosystem KPIs voor Overview page)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_executive_kpis as
select
  (select count(*) from public.media_holding_channels where status in ('live','scaling','incubating'))   as channels_active,
  (select coalesce(sum(views),0) from public.media_holding_metrics where snapshot_at > now() - interval '24 hours')  as views_24h,
  (select coalesce(sum(views),0) from public.media_holding_metrics where snapshot_at > now() - interval '7 days')    as views_7d,
  (select count(*) from public.executive_alerts where acknowledged_at is null and severity = 'critical') as critical_alerts_open,
  (select count(*) from public.executive_alerts where acknowledged_at is null)                           as alerts_open_total,
  (select count(*) from public.executive_recommendations where status = 'pending')                       as recs_pending,
  (select coalesce(avg(retention_pct),0) from public.media_holding_metrics where snapshot_at > now() - interval '7 days') as retention_avg_7d,
  (select coalesce(sum(revenue_attributed),0) from public.content_fund_allocations where period_end >= current_date - interval '30 days') as revenue_30d,
  (select coalesce(sum(allocated_eur),0) from public.content_fund_allocations where period_end >= current_date - interval '30 days')      as spend_30d;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Trigger: bij executive_decisions insert → channel_status_history bij verandering
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._executive_record_status_transition()
returns trigger
language plpgsql
as $f$
declare
  prev_status text;
begin
  select current_status into prev_status
    from public.media_holding_channels
   where id = new.channel_id;

  if prev_status is distinct from new.status then
    insert into public.channel_status_history (channel_id, from_status, to_status, reason, decision_id)
    values (new.channel_id, prev_status, new.status, 'decision_engine', new.id);

    update public.media_holding_channels
       set current_status = new.status,
           current_status_at = new.decided_at,
           updated_at = now()
     where id = new.channel_id;
  end if;

  return new;
end;
$f$;

drop trigger if exists trg_executive_decisions_history on public.executive_decisions;
create trigger trg_executive_decisions_history
  after insert on public.executive_decisions
  for each row execute function public._executive_record_status_transition();

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Trigger: kritieke alerts → autopilot_events (downstream chain)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._executive_alert_to_autopilot()
returns trigger
language plpgsql
as $f$
begin
  if new.severity = 'critical' then
    insert into public.autopilot_events (link_key, source_table, source_id, target_executor, details)
    values ('executive_alert_critical', 'executive_alerts', new.id, 'executive-layer',
            jsonb_build_object('alert_kind', new.alert_kind, 'target_kind', new.target_kind, 'target_id', new.target_id));
  end if;
  return new;
end;
$f$;

drop trigger if exists trg_executive_alerts_autopilot on public.executive_alerts;
create trigger trg_executive_alerts_autopilot
  after insert on public.executive_alerts
  for each row execute function public._executive_alert_to_autopilot();

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. updated_at triggers (consistente patroon)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._executive_touch_updated_at()
returns trigger language plpgsql as $f$
begin
  new.updated_at = now();
  return new;
end;
$f$;

drop trigger if exists trg_executive_agents_uat on public.executive_agents;
create trigger trg_executive_agents_uat
  before update on public.executive_agents
  for each row execute function public._executive_touch_updated_at();

drop trigger if exists trg_content_fund_alloc_uat on public.content_fund_allocations;
create trigger trg_content_fund_alloc_uat
  before update on public.content_fund_allocations
  for each row execute function public._executive_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Seeds: 6 executive agents
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.executive_agents (agent_key, name, role_persona, system_prompt, model, max_tokens, schedule_cron) values
  ('atlas',
   'ATLAS',
   'Media CEO',
   'You are ATLAS, the AI CEO of an autonomous media holding. You think in attention, momentum, retention, scalability, profitability and algorithm dominance. Daily you review the entire ecosystem, prioritize growth, allocate resources, identify scaling opportunities and weak performance, and coordinate the specialist agents. Your output is a structured daily briefing with executive summary, strategic priorities, and concrete recommendations bound to channel_ids and action_kinds.',
   'claude-opus-4-7',
   8192,
   '0 7 * * *'),
  ('viral_analyst',
   'Viral Analyst',
   'Post-publish forensic specialist',
   'You are the Viral Analyst. Per content item you analyse why it succeeded or failed: hook effectiveness, retention breakpoints, algorithm lift explanation, replicable patterns, audience signals. Output is structured JSON to drive hook_library learning and replication strategies.',
   'claude-sonnet-4-6',
   4096,
   '*/15 * * * *'),
  ('channel_manager',
   'Channel Manager',
   'Per-channel growth manager',
   'You are a Channel Manager for a single channel. You receive channel-scoped telemetry (uploads, retention trends, subscriber velocity, audience overlap, saturation index) and produce a weekly outlook, recommended uploads, weak items to archive, and format suggestions. Your goal is hitting kpi_targets while maintaining audience health.',
   'claude-sonnet-4-6',
   4096,
   '0 8 * * *'),
  ('algorithm_strategist',
   'Algorithm Strategist',
   'Platform momentum & timing specialist',
   'You are the Algorithm Strategist. You read algorithm_gravity_events, audio velocity, trend signals, upload-timing correlations and audience migration. You decide when to amplify, duplicate, pivot or stop. Output: recommended_upload_windows (per channel, next 48h), swarm_opportunities (content to clone/variant), pivot_signals (niches losing momentum).',
   'claude-sonnet-4-6',
   4096,
   '0 */6 * * *'),
  ('retention_scientist',
   'Retention Scientist',
   'Hook & pacing optimisation specialist',
   'You are the Retention Scientist. You aggregate retention curves, drop-offs, replay-spikes and completion-rates across the last 30 days. You identify best first-frames, worst drop-off patterns, replay triggers, optimal pacing and dopamine timing. You iterate hook_library success_scores based on recent uploads.',
   'claude-sonnet-4-6',
   4096,
   '30 8 * * *'),
  ('content_fund_manager',
   'Content Fund Manager',
   'Render budget & ROI allocator',
   'You are the Content Fund Manager. Weekly you allocate render budget across channels and niches based on render_cost_eur vs views vs revenue. You invest more in winners, reduce spend on weak niches, and shift resources to maximise ecosystem ROI. Output: content_fund_allocations rows + recommendations.',
   'claude-sonnet-4-6',
   4096,
   '0 9 * * 1')
on conflict (agent_key) do update set
  name = excluded.name,
  role_persona = excluded.role_persona,
  system_prompt = excluded.system_prompt,
  model = excluded.model,
  max_tokens = excluded.max_tokens,
  schedule_cron = excluded.schedule_cron,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Seeds: 6 worker registry entries (zichtbaar in bestaande Workers-tab)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_workers (name, kind, status, config) values
  ('atlas-ceo',                  'analyzer', 'idle', jsonb_build_object('agent_key','atlas','schedule','0 7 * * *','model','claude-opus-4-7')),
  ('viral-analyst',              'analyzer', 'idle', jsonb_build_object('agent_key','viral_analyst','schedule','*/15 * * * *','model','claude-sonnet-4-6')),
  ('channel-managers',           'analyzer', 'idle', jsonb_build_object('agent_key','channel_manager','schedule','0 8 * * *','model','claude-sonnet-4-6')),
  ('algorithm-strategist',       'analyzer', 'idle', jsonb_build_object('agent_key','algorithm_strategist','schedule','0 */6 * * *','model','claude-sonnet-4-6')),
  ('retention-scientist',        'analyzer', 'idle', jsonb_build_object('agent_key','retention_scientist','schedule','30 8 * * *','model','claude-sonnet-4-6')),
  ('content-fund-manager',       'analyzer', 'idle', jsonb_build_object('agent_key','content_fund_manager','schedule','0 9 * * 1','model','claude-sonnet-4-6'))
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. Seeds: 5 nieuwe autopilot_config links (default uit, drempel handmatig)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.autopilot_config (link_key, description, enabled, threshold) values
  ('breakout_to_clone',
   'Bij executive_alerts (breakout, critical) → trigger winner-extraction op gerelateerd content_item',
   false, 0),
  ('scale_ready_to_amplify',
   'Bij executive_decisions status=scale_ready → verhoog upload-frequentie in media_holding_channels.upload_strategy',
   false, 0),
  ('terminated_to_pause',
   'Bij executive_decisions status=terminated → media_holding_channels.status=paused',
   false, 0),
  ('winner_to_language_expansion',
   'Bij viral content > threshold views → automatische language_expansion_targets entries',
   false, 100000),
  ('recommendation_to_task',
   'Bij executive_recommendations status=approved → maak orchestrator_task obv action_kind',
   false, 0)
on conflict (link_key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. Module registry: nieuwe modules onder (vrije) fase voor Executive Layer
--     Voegt 11 modules toe; module_key is uniek per media_holding_modules.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_modules (fase_nr, module_key, naam, status, route, gebouwd_door, live_at)
values
  (7, 'executive-overview',        'Executive Overview',         'live', '/dashboard/media-holding/executive',                'orlando+claude', now()),
  (7, 'executive-boardroom',       'AI Boardroom',               'live', '/dashboard/media-holding/executive/boardroom',      'orlando+claude', now()),
  (7, 'executive-channels',        'Channel Command Center',     'live', '/dashboard/media-holding/executive/channels',       'orlando+claude', now()),
  (7, 'executive-retention',       'Retention Lab (executive)',  'live', '/dashboard/media-holding/executive/retention-lab',  'orlando+claude', now()),
  (7, 'executive-algorithm',       'Algorithm Gravity Engine',   'live', '/dashboard/media-holding/executive/algorithm',      'orlando+claude', now()),
  (7, 'executive-compete',         'Competitor Surveillance (exec)', 'live', '/dashboard/media-holding/executive/compete',    'orlando+claude', now()),
  (7, 'executive-fund',            'Content Fund',               'live', '/dashboard/media-holding/executive/fund',           'orlando+claude', now()),
  (7, 'executive-decision-engine', 'Decision Engine',            'live', '/api/executive-layer/cron/decision-engine',         'orlando+claude', now()),
  (7, 'executive-alert-engine',    'Alert Engine',               'live', '/api/executive-layer/cron/alert-engine',            'orlando+claude', now()),
  (7, 'executive-autonomous',      'Autonomous Scaling',         'live', '/api/executive-layer/cron/autonomous-scaling',      'orlando+claude', now()),
  (7, 'executive-engine-service',  'Executive Engine (Render)',  'live', 'executive-engine/',                                 'orlando+claude', now())
on conflict (module_key) do update set
  status   = excluded.status,
  route    = excluded.route,
  live_at  = excluded.live_at,
  updated_at = now();

insert into public.media_holding_phases (fase_nr, naam, omschrijving, status, voortgang, focus)
values
  (7, 'Executive Intelligence Layer',
   'AI C-suite (ATLAS + 5 specialists), Decision Engine, Alert Engine, Content Fund, autonomous scaling',
   'building', 10,
   'Transformeer Media Holding van content-machine naar AI-bestuurde media corporation')
on conflict (fase_nr) do update set
  naam = excluded.naam,
  omschrijving = excluded.omschrijving,
  focus = excluded.focus,
  updated_at = now();
