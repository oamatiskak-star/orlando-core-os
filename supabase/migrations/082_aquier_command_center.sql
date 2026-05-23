-- ─────────────────────────────────────────────────────────────────────────
-- Migration 082 — Aquier Command Center
-- ─────────────────────────────────────────────────────────────────────────
-- Tabellen voor de Aquier Software-map in het dashboard:
--   - aquier_projects     — projecten in het masterplan (25 modules + extra)
--   - aquier_sprints      — wekelijkse sprintplanning
--   - aquier_tasks        — taken binnen projecten/sprints
--   - aquier_agenda       — agenda items (meetings, deadlines, milestones)
--   - aquier_ai_lead_state — state voor de AI Project Leider
--   - aquier_ai_lead_briefs — dagelijkse briefs (output van AI Project Leider)
--   - aquier_monitor_events — dagelijkse monitoring events (KPI deltas, alerts, advies)
--   - aquier_approvals    — Approve/Decline queue (strategie/verbeteringen/storingen)
--
-- Vereist: gen_random_uuid() (pgcrypto), draait op het public schema.

-- ── PROJECTS ──────────────────────────────────────────────────────────────
create table if not exists public.aquier_projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  module_ref text,
  description text,
  status text not null default 'planned'
    check (status in ('planned','in_progress','blocked','completed','on_hold','cancelled')),
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  owner_agent text,
  start_at timestamptz,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aquier_projects_status_idx
  on public.aquier_projects (status, priority, due_at);

-- ── SPRINTS ───────────────────────────────────────────────────────────────
create table if not exists public.aquier_sprints (
  id uuid primary key default gen_random_uuid(),
  sprint_code text unique not null,
  starts_on date not null,
  ends_on date not null,
  theme text,
  status text not null default 'planned'
    check (status in ('planned','active','completed','cancelled')),
  capacity_hours int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aquier_sprints_active_idx
  on public.aquier_sprints (status, starts_on desc);

-- ── TASKS ─────────────────────────────────────────────────────────────────
create table if not exists public.aquier_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.aquier_projects(id) on delete set null,
  sprint_id uuid references public.aquier_sprints(id) on delete set null,
  title text not null,
  body text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','blocked','completed','deferred','cancelled')),
  priority text not null default 'medium'
    check (priority in ('critical','high','medium','low')),
  owner_agent text,
  estimate_hours numeric(6,2),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aquier_tasks_project_idx on public.aquier_tasks (project_id, status);
create index if not exists aquier_tasks_sprint_idx on public.aquier_tasks (sprint_id, status);
create index if not exists aquier_tasks_due_idx on public.aquier_tasks (due_at) where status not in ('completed','cancelled');

-- ── AGENDA ────────────────────────────────────────────────────────────────
create table if not exists public.aquier_agenda (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'meeting'
    check (type in ('meeting','deadline','milestone','review','launch','kickoff','external')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  url text,
  description text,
  related_project_id uuid references public.aquier_projects(id) on delete set null,
  attendees jsonb not null default '[]'::jsonb,
  status text not null default 'scheduled'
    check (status in ('scheduled','done','cancelled','postponed')),
  created_at timestamptz not null default now()
);

create index if not exists aquier_agenda_when_idx on public.aquier_agenda (starts_at);

-- ── AI PROJECT LEIDER ─────────────────────────────────────────────────────
create table if not exists public.aquier_ai_lead_state (
  id text primary key default 'singleton',
  agent_name text not null default 'CHRONOS-AQ',
  model text not null default 'claude-opus-4-7',
  status text not null default 'ready'
    check (status in ('ready','running','paused','error')),
  current_sprint_id uuid references public.aquier_sprints(id) on delete set null,
  last_brief_at timestamptz,
  next_brief_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  guardrails jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.aquier_ai_lead_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_type text not null
    check (brief_type in ('daily','weekly','adhoc','kickoff','launch')),
  generated_at timestamptz not null default now(),
  for_date date not null,
  headline text not null,
  summary text,
  priorities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  delivered boolean not null default false
);

create index if not exists aquier_briefs_date_idx
  on public.aquier_ai_lead_briefs (for_date desc, brief_type);

-- ── DAILY MONITORING ──────────────────────────────────────────────────────
create table if not exists public.aquier_monitor_events (
  id uuid primary key default gen_random_uuid(),
  event_at timestamptz not null default now(),
  severity text not null default 'info'
    check (severity in ('info','success','warning','error','critical')),
  category text not null
    check (category in ('kpi','growth','engineering','market','funding','risk','operations','ai','customer','sales')),
  source_agent text,
  title text not null,
  detail text,
  metric_key text,
  metric_value numeric,
  metric_target numeric,
  variance_pct numeric,
  advice text,
  acknowledged boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists aquier_monitor_recent_idx
  on public.aquier_monitor_events (event_at desc);
create index if not exists aquier_monitor_severity_idx
  on public.aquier_monitor_events (severity, event_at desc);
create index if not exists aquier_monitor_category_idx
  on public.aquier_monitor_events (category, event_at desc);

-- ── APPROVE / DECLINE QUEUE ───────────────────────────────────────────────
create table if not exists public.aquier_approvals (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  category text not null
    check (category in ('strategie','verbetering','storing','spend','hire','partnership','launch','pricing','overig')),
  title text not null,
  rationale text,
  proposed_action text,
  alternatives jsonb not null default '[]'::jsonb,
  impact text,
  estimated_cost_eur numeric(12,2),
  proposed_by_agent text,
  related_project_id uuid references public.aquier_projects(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','approved','declined','deferred','auto_executed')),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  evidence jsonb not null default '{}'::jsonb
);

create index if not exists aquier_approvals_pending_idx
  on public.aquier_approvals (status, requested_at desc);
create index if not exists aquier_approvals_category_idx
  on public.aquier_approvals (category, status);

-- ── update_at triggers ────────────────────────────────────────────────────
create or replace function public.aquier_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_aquier_projects_updated on public.aquier_projects;
create trigger trg_aquier_projects_updated
  before update on public.aquier_projects
  for each row execute function public.aquier_touch_updated_at();

drop trigger if exists trg_aquier_tasks_updated on public.aquier_tasks;
create trigger trg_aquier_tasks_updated
  before update on public.aquier_tasks
  for each row execute function public.aquier_touch_updated_at();

drop trigger if exists trg_aquier_ai_lead_state_updated on public.aquier_ai_lead_state;
create trigger trg_aquier_ai_lead_state_updated
  before update on public.aquier_ai_lead_state
  for each row execute function public.aquier_touch_updated_at();

-- ── SEED — 25 masterplan-modules als projecten + kickoff sprint ──────────
insert into public.aquier_projects (code, name, module_ref, description, status, priority, progress_pct, owner_agent, start_at, due_at) values
  ('AQ-M00', 'Executive Summary', '00_EXECUTIVE_SUMMARY', 'Investor-grade samenvatting', 'completed', 'critical', 100, 'CHRONOS-AQ', null, null),
  ('AQ-M01', 'Market Research',     '01_MARKET_RESEARCH', 'TAM/SAM/SOM + PropTech segmentatie', 'completed', 'high', 100, 'COMPASS-INT', null, null),
  ('AQ-M02', 'Competitor Analysis', '02_COMPETITOR_ANALYSIS', '13 spelers benchmarked', 'completed', 'high', 100, 'COMPASS-INT', null, null),
  ('AQ-M03', 'Global Country Strategy', '03_GLOBAL_COUNTRY_STRATEGY', '14 landen Tier 1+2 dossiers', 'in_progress', 'high', 90, 'COMPASS-INT', null, null),
  ('AQ-M04', 'Pricing Models',      '04_PRICING_MODELS', '10 omzetlagen pricing matrix', 'completed', 'critical', 100, 'MIDAS-REV', null, null),
  ('AQ-M05', 'Membership Models',   '05_MEMBERSHIP_MODELS', 'Pro+Team tier funnel + retention', 'in_progress', 'high', 55, 'MIDAS-REV', null, null),
  ('AQ-M06', 'Enterprise Strategy', '06_ENTERPRISE_STRATEGY', 'Enterprise sales + SLA + deployment', 'in_progress', 'high', 60, 'TITAN-S', null, null),
  ('AQ-M07', 'White-label Strategy','07_WHITE_LABEL_STRATEGY', 'Multi-tenant + partner onboarding', 'in_progress', 'high', 60, 'ENVOY-SP', null, null),
  ('AQ-M08', 'Content Engine',      '08_CONTENT_ENGINE', 'Content strategy alle kanalen', 'in_progress', 'high', 60, 'HERALD-C', null, null),
  ('AQ-M09', 'Sales Funnels',       '09_SALES_FUNNELS', 'Outbound + inbound + PLG funnels', 'in_progress', 'high', 60, 'TITAN-S', null, null),
  ('AQ-M10', 'LinkedIn Strategy',   '10_LINKEDIN_STRATEGY', 'Founder + Aquier + team voices', 'in_progress', 'medium', 55, 'HERALD-C', null, null),
  ('AQ-M11', 'YouTube Strategy',    '11_YOUTUBE_STRATEGY', 'Authority YouTube + SEO', 'in_progress', 'medium', 55, 'HERALD-C', null, null),
  ('AQ-M12', 'Facebook Group Strategy', '12_FACEBOOK_GROUP_STRATEGY', 'Private community + network effect', 'in_progress', 'medium', 55, 'HERALD-C', null, null),
  ('AQ-M13', 'Paid Ads Strategy',   '13_PAID_ADS_STRATEGY', 'LinkedIn + Google + Meta + sponsored', 'in_progress', 'high', 60, 'HELIOS-G', null, null),
  ('AQ-M14', 'JV & Partnerships',   '14_JV_PARTNERSHIPS', 'JV matching + distribution + data partners', 'in_progress', 'high', 60, 'ENVOY-SP', null, null),
  ('AQ-M15', 'Investor Relations',  '15_INVESTOR_RELATIONS', 'Funding roadmap + VC landscape + deck', 'completed', 'critical', 100, 'ORACLE-IR', null, null),
  ('AQ-M16', 'API Monetization',    '16_API_MONETIZATION', 'API as product line', 'in_progress', 'medium', 60, 'VULCAN-INFRA', null, null),
  ('AQ-M17', 'Data Monetization',   '17_DATA_MONETIZATION', 'Bulk data feeds + licensing', 'in_progress', 'medium', 60, 'SAGE-LAB', null, null),
  ('AQ-M18', 'Financial Forecasts', '18_FINANCIAL_FORECASTS', '3 scenarios + CSV/Excel-ready', 'completed', 'critical', 100, 'TREASURY-AI', null, null),
  ('AQ-M19', 'Growth Models',       '19_GROWTH_MODELS', 'Growth loops + viral + network effects', 'in_progress', 'high', 60, 'HELIOS-G', null, null),
  ('AQ-M20', 'Automation Systems',  '20_AUTOMATION_SYSTEMS', 'Orchestrator + agent workflows', 'in_progress', 'high', 60, 'VULCAN-INFRA', null, null),
  ('AQ-M21', 'AI Agent Structure',  '21_AI_AGENT_STRUCTURE', 'AI CEO + Orchestrator + Planner + 12 teams', 'completed', 'critical', 100, 'ATLAS-A', null, null),
  ('AQ-M22', 'Operational Infrastructure', '22_OPERATIONAL_INFRASTRUCTURE', 'Tech stack + security + compliance', 'in_progress', 'high', 60, 'VULCAN-INFRA', null, null),
  ('AQ-M23', 'Risk Analysis',       '23_RISK_ANALYSIS', 'Risk register + mitigation + scenarios', 'in_progress', 'high', 80, 'COMPLIANCE-AI', null, null),
  ('AQ-M24', 'Scaling Blueprint',   '24_SCALING_BLUEPRINT', 'Validation layer + comparable intel', 'in_progress', 'critical', 85, 'SAGE-LAB', null, null),
  ('AQ-M25', 'Implementation Roadmap', '25_IMPLEMENTATION_ROADMAP', '12-mnd plan + AI→human transitie', 'completed', 'critical', 100, 'CHRONOS-AQ', null, null)
on conflict (code) do nothing;

-- Sprint 1 (week 22 → maandag 2026-05-25)
insert into public.aquier_sprints (sprint_code, starts_on, ends_on, theme, status, capacity_hours)
values ('SP-2026-W22', '2026-05-25', '2026-05-31', 'Maandag kickoff — Foundation week: MVP scope freeze + design partner outreach + pre-seed prep', 'planned', 50)
on conflict (sprint_code) do nothing;

-- AI Project Leider state init
insert into public.aquier_ai_lead_state (id, agent_name, model, status, current_sprint_id, context, guardrails)
select
  'singleton',
  'CHRONOS-AQ',
  'claude-opus-4-7',
  'ready',
  s.id,
  jsonb_build_object(
    'masterplan_path', '~/Desktop/AQUIER_GLOBAL_EXPANSION_MASTERPLAN/',
    'launch_date', '2026-05-25',
    'y1_target_eur', 3000000,
    'y1_stretch_eur', 5400000,
    'tier1_countries', jsonb_build_array('NL','UK','UAE','DE','ES','US'),
    'first_launch_country', 'NL',
    'first_launch_quarter', 'Q3-2026'
  ),
  jsonb_build_object(
    'auto_execute_limit_eur', 2000,
    'requires_approval_above_eur', 25000,
    'pause_on_critical_kpi_miss_pct', 30,
    'human_approval_categories', jsonb_build_array('hire','pricing','launch','partnership','spend>25k','press')
  )
from public.aquier_sprints s where s.sprint_code = 'SP-2026-W22'
on conflict (id) do update set
  current_sprint_id = excluded.current_sprint_id,
  context = excluded.context,
  guardrails = excluded.guardrails,
  updated_at = now();

-- Kickoff agenda items voor maandag 25 mei 2026
insert into public.aquier_agenda (title, type, starts_at, ends_at, description) values
  ('Aquier Project Kickoff', 'kickoff', '2026-05-25 09:00:00+02', '2026-05-25 10:30:00+02', 'AI Project Leider presenteert week 1 sprint plan + Q3 launch sequence'),
  ('Design Partner Outreach Wave 1', 'milestone', '2026-05-25 11:00:00+02', '2026-05-25 12:00:00+02', '15 prospects gecontacteerd via LinkedIn DM + Orlando-netwerk'),
  ('Sprint Review Week 22', 'review', '2026-05-29 16:00:00+02', '2026-05-29 17:00:00+02', 'Eind week review; KPI delta + sprint W23 voorbereiden')
on conflict do nothing;

-- Initial monitor event = system online
insert into public.aquier_monitor_events (severity, category, source_agent, title, detail, advice)
values ('success', 'operations', 'CHRONOS-AQ', 'Aquier Command Center geactiveerd', 'Alle tabellen geseed, 26 projecten gekoppeld aan 25 masterplan-modules, sprint W22 staat klaar voor maandag 2026-05-25', 'Bevestig kickoff agenda + check design partner pipeline')
on conflict do nothing;
