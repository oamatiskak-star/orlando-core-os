-- 080_projects_table.sql
-- Projects table for managing multi-channel strategies and monitoring
-- Tracks project status, goals, team members, and progress

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  description         text,
  type                text not null default 'strategy'
                         check (type in ('strategy', 'campaign', 'ab_test', 'monetization', 'analysis')),
  status              text not null default 'active'
                         check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  owner_id            uuid references auth.users(id) on delete set null,
  project_manager_id  uuid references auth.users(id) on delete set null,
  start_date          date,
  end_date            date,
  goal_description    text,
  success_metrics     jsonb not null default '[]'::jsonb,
  channels            jsonb not null default '[]'::jsonb,
  clusters            jsonb not null default '[]'::jsonb,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_type on projects(type);
create index if not exists idx_projects_owner on projects(owner_id);
create index if not exists idx_projects_manager on projects(project_manager_id);

-- Insert the 12-channel strategy project
insert into public.projects (
  name,
  description,
  type,
  status,
  goal_description,
  success_metrics,
  clusters,
  metadata
) values (
  '12-Channel A/B-Test Monetization Strategy',
  'Comprehensive multi-cluster A/B-testing strategy for 12 YouTube channels across 3 clusters. Goal: Achieve monetization thresholds while avoiding inauthentic content detection through phased roll-out.',
  'strategy',
  'active',
  'Deploy 12-channel A/B-test strategy across 3 clusters (Shorts US, NL long-form, Aquier control) with phased roll-out (Golf 1, 1b, 2, 3) to reach monetization thresholds without triggering YouTube penalties.',
  '[
    {"metric": "Subscriber conversion rate", "target": "1 per 280 views", "current": "varies by channel"},
    {"metric": "Monetization eligibility", "target": "All 12 channels meet 1000 subs + watch time", "current": "In progress"},
    {"metric": "A/B-test validity", "target": "Single variable per cluster", "current": "Configured"},
    {"metric": "Phase transition schedule", "target": "Complete Golf 1-3 in 60 days", "current": "Starting"}
  ]'::jsonb,
  '[
    {
      "name": "Shorts US",
      "channels": 4,
      "test_variable": "Hook style (Impossible Reveal vs Process Tension vs Diagnosis)",
      "control": false
    },
    {
      "name": "NL long-form",
      "channels": 4,
      "test_variable": "Title/thumbnail formula optimization",
      "control": false
    },
    {
      "name": "Aquier control",
      "channels": 4,
      "test_variable": "Baseline measurement (no changes)",
      "control": true
    }
  ]'::jsonb,
  '{
    "total_channels": 12,
    "phases": ["Golf 1", "Golf 1b", "Golf 2", "Golf 3"],
    "daily_standup_time": "09:00",
    "reporting_cadence": "daily, weekly, monthly",
    "key_agents": ["YouTube Channel Analyst", "Marketing Orchestrator", "Project Manager"],
    "monetization_thresholds": {
      "shorts": "1000 subscribers + 10M views in 90 days",
      "long_form": "1000 subscribers + 4000 watch hours in 12 months"
    }
  }'::jsonb
) on conflict (name) do update set updated_at = now();
