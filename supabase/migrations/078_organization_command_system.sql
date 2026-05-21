-- 078_organization_command_system.sql
-- Organization-wide Agent Command & Planning System
-- Unified task tracking, worker monitoring, and ClickUp integration layer
-- All tables use UUID primary keys, created_at/updated_at, and RLS-compatible structure

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organization_agents — Central registry of all agents across all systems
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_agents (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  agent_type            text not null check (agent_type in ('persona', 'external', 'system')),
  role                  text not null,
  system                text not null,
  status                text not null default 'idle'
                          check (status in ('active', 'idle', 'paused', 'failed')),
  active_tasks_count    integer not null default 0,
  completed_tasks_count integer not null default 0,
  failed_tasks_count    integer not null default 0,
  last_activity_at      timestamptz,
  capabilities          text[] not null default '{}',
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_org_agents_status on public.organization_agents(status);
create index if not exists idx_org_agents_type on public.organization_agents(agent_type);
create index if not exists idx_org_agents_last_activity on public.organization_agents(last_activity_at);
create index if not exists idx_org_agents_system on public.organization_agents(system);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. organization_workers — Unified registry of all workers/executors
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_workers (
  id                    uuid primary key default gen_random_uuid(),
  worker_name           text not null unique,
  worker_type           text not null check (worker_type in (
                          'orchestrator', 'ai_node', 'local_cli', 'youtube',
                          'mail', 'finance', 'custom'
                        )),
  host                  text not null,
  port                  integer,
  status                text not null default 'offline'
                          check (status in ('idle', 'busy', 'paused', 'offline', 'error')),
  current_task_id       uuid,
  queue_length          integer not null default 0,
  last_heartbeat        timestamptz,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_org_workers_status on public.organization_workers(status);
create index if not exists idx_org_workers_type on public.organization_workers(worker_type);
create index if not exists idx_org_workers_last_heartbeat on public.organization_workers(last_heartbeat);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. organization_llama_workers — Registry for llama.cpp inference workers
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_llama_workers (
  id                    uuid primary key default gen_random_uuid(),
  worker_name           text not null unique,
  host                  text not null,
  port                  integer not null,
  model_path            text,
  model_name            text not null,
  context_size          integer,
  threads               integer,
  gpu_layers            integer,
  status                text not null default 'offline'
                          check (status in ('idle', 'busy', 'loading', 'offline', 'error')),
  current_task_id       uuid,
  queue_length          integer not null default 0,
  last_heartbeat        timestamptz,
  tokens_per_second     real,
  memory_usage_mb       integer,
  error                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_org_llama_workers_status on public.organization_llama_workers(status);
create index if not exists idx_org_llama_workers_last_heartbeat on public.organization_llama_workers(last_heartbeat);
create index if not exists idx_org_llama_workers_host on public.organization_llama_workers(host);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. organization_tasks — Unified task view across all sources
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  priority              text not null default 'normal'
                          check (priority in ('critical', 'high', 'normal', 'low', 'backlog')),
  system                text not null,
  assigned_agent_id     uuid references public.organization_agents(id) on delete set null,
  assigned_worker_id    uuid references public.organization_workers(id) on delete set null,
  status                text not null default 'new'
                          check (status in (
                            'new', 'queued', 'assigned', 'running',
                            'waiting_for_input', 'blocked', 'completed', 'failed', 'cancelled'
                          )),
  source                text not null check (source in (
                          'clickup', 'supabase', 'local', 'llama_cpp', 'manual'
                        )),
  source_task_id        text,
  executor_task_id      uuid,
  ai_task_id            uuid,
  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  finished_at           timestamptz,
  error                 text,
  output_url            text,
  follow_up_action      text,
  dependencies          jsonb not null default '[]'::jsonb,
  updated_at            timestamptz not null default now(),

  unique (source, source_task_id) where source_task_id is not null
);

create index if not exists idx_org_tasks_status on public.organization_tasks(status);
create index if not exists idx_org_tasks_agent on public.organization_tasks(assigned_agent_id);
create index if not exists idx_org_tasks_worker on public.organization_tasks(assigned_worker_id);
create index if not exists idx_org_tasks_source on public.organization_tasks(source);
create index if not exists idx_org_tasks_priority on public.organization_tasks(priority);
create index if not exists idx_org_tasks_created on public.organization_tasks(created_at);
create index if not exists idx_org_tasks_started on public.organization_tasks(started_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. organization_task_logs — Audit trail for every task action
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_task_logs (
  id                    uuid primary key default gen_random_uuid(),
  task_id               uuid not null references public.organization_tasks(id) on delete cascade,
  timestamp             timestamptz not null default now(),
  action                text not null check (action in (
                          'queued', 'assigned', 'started', 'completed',
                          'failed', 'retried', 'cancelled', 'status_changed'
                        )),
  actor_type            text check (actor_type in ('agent', 'worker', 'system', 'user')),
  actor_id              uuid,
  details               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists idx_org_task_logs_task on public.organization_task_logs(task_id);
create index if not exists idx_org_task_logs_created on public.organization_task_logs(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. organization_clickup_imports — Metadata for ClickUp sync tracking
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_clickup_imports (
  id                    uuid primary key default gen_random_uuid(),
  clickup_workspace_id  text,
  clickup_space_id      text,
  clickup_folder_id     text,
  clickup_list_id       text,
  clickup_task_id       text not null,
  internal_task_id      uuid references public.organization_tasks(id) on delete cascade,
  migrated_at           timestamptz not null default now(),
  last_synced_at        timestamptz,
  sync_status           text not null default 'pending'
                          check (sync_status in ('pending', 'synced', 'error')),
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (clickup_task_id, internal_task_id)
);

create index if not exists idx_org_clickup_imports_status on public.organization_clickup_imports(sync_status);
create index if not exists idx_org_clickup_imports_task_id on public.organization_clickup_imports(clickup_task_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. organization_task_dependencies — Task graph / prerequisites
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_task_dependencies (
  id                    uuid primary key default gen_random_uuid(),
  parent_task_id        uuid not null references public.organization_tasks(id) on delete cascade,
  child_task_id         uuid not null references public.organization_tasks(id) on delete cascade,
  dependency_type       text not null default 'depends_on'
                          check (dependency_type in ('blocks', 'depends_on', 'related')),
  created_at            timestamptz not null default now(),

  unique (parent_task_id, child_task_id)
);

create index if not exists idx_org_task_deps_parent on public.organization_task_dependencies(parent_task_id);
create index if not exists idx_org_task_deps_child on public.organization_task_dependencies(child_task_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. organization_agent_assignments — History of agent-to-task assignments
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organization_agent_assignments (
  id                    uuid primary key default gen_random_uuid(),
  agent_id              uuid not null references public.organization_agents(id) on delete cascade,
  task_id               uuid not null references public.organization_tasks(id) on delete cascade,
  assigned_at           timestamptz not null default now(),
  unassigned_at         timestamptz,
  reason                text check (reason in ('dispatch', 'escalation', 'fallback', 'reassignment')),
  created_at            timestamptz not null default now()
);

create index if not exists idx_org_agent_assignments_agent on public.organization_agent_assignments(agent_id);
create index if not exists idx_org_agent_assignments_task on public.organization_agent_assignments(task_id);
create index if not exists idx_org_agent_assignments_assigned_at on public.organization_agent_assignments(assigned_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper trigger for updated_at timestamps
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_organization_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Apply triggers to tables with updated_at
drop trigger if exists trg_org_agents_updated_at on public.organization_agents;
create trigger trg_org_agents_updated_at before update on public.organization_agents
  for each row execute function public.touch_organization_updated_at();

drop trigger if exists trg_org_workers_updated_at on public.organization_workers;
create trigger trg_org_workers_updated_at before update on public.organization_workers
  for each row execute function public.touch_organization_updated_at();

drop trigger if exists trg_org_llama_workers_updated_at on public.organization_llama_workers;
create trigger trg_org_llama_workers_updated_at before update on public.organization_llama_workers
  for each row execute function public.touch_organization_updated_at();

drop trigger if exists trg_org_tasks_updated_at on public.organization_tasks;
create trigger trg_org_tasks_updated_at before update on public.organization_tasks
  for each row execute function public.touch_organization_updated_at();

drop trigger if exists trg_org_clickup_imports_updated_at on public.organization_clickup_imports;
create trigger trg_org_clickup_imports_updated_at before update on public.organization_clickup_imports
  for each row execute function public.touch_organization_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies (disable for now, can be refined per deployment)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organization_agents enable row level security;
alter table public.organization_workers enable row level security;
alter table public.organization_llama_workers enable row level security;
alter table public.organization_tasks enable row level security;
alter table public.organization_task_logs enable row level security;
alter table public.organization_clickup_imports enable row level security;
alter table public.organization_task_dependencies enable row level security;
alter table public.organization_agent_assignments enable row level security;

-- Allow authenticated users read access to all organization data
create policy "Allow authenticated read" on public.organization_agents for select using (true);
create policy "Allow authenticated read" on public.organization_workers for select using (true);
create policy "Allow authenticated read" on public.organization_llama_workers for select using (true);
create policy "Allow authenticated read" on public.organization_tasks for select using (true);
create policy "Allow authenticated read" on public.organization_task_logs for select using (true);
create policy "Allow authenticated read" on public.organization_clickup_imports for select using (true);
create policy "Allow authenticated read" on public.organization_task_dependencies for select using (true);
create policy "Allow authenticated read" on public.organization_agent_assignments for select using (true);

-- Allow service role full access for backend operations
create policy "Allow service role all" on public.organization_agents for all using (true);
create policy "Allow service role all" on public.organization_workers for all using (true);
create policy "Allow service role all" on public.organization_llama_workers for all using (true);
create policy "Allow service role all" on public.organization_tasks for all using (true);
create policy "Allow service role all" on public.organization_task_logs for all using (true);
create policy "Allow service role all" on public.organization_clickup_imports for all using (true);
create policy "Allow service role all" on public.organization_task_dependencies for all using (true);
create policy "Allow service role all" on public.organization_agent_assignments for all using (true);
