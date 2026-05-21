-- 079_organization_rpc_functions.sql
-- Supabase RPC functions for Organization Command System
-- Core query functions for dashboard and API endpoints

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_organization_overview() — Dashboard statistics
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_overview()
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'total_agents', (select count(*) from public.organization_agents),
    'active_agents', (select count(*) from public.organization_agents where status = 'active'),
    'idle_agents', (select count(*) from public.organization_agents where status = 'idle'),
    'paused_agents', (select count(*) from public.organization_agents where status = 'paused'),
    'failed_agents', (select count(*) from public.organization_agents where status = 'failed'),
    'total_workers', (select count(*) from public.organization_workers),
    'online_workers', (select count(*) from public.organization_workers where status != 'offline'),
    'offline_workers', (select count(*) from public.organization_workers where status = 'offline'),
    'total_llama_workers', (select count(*) from public.organization_llama_workers),
    'online_llama_workers', (select count(*) from public.organization_llama_workers where status != 'offline'),
    'open_tasks', (select count(*) from public.organization_tasks where status in ('new', 'queued', 'assigned')),
    'running_tasks', (select count(*) from public.organization_tasks where status = 'running'),
    'waiting_tasks', (select count(*) from public.organization_tasks where status in ('waiting_for_input', 'blocked')),
    'completed_tasks', (select count(*) from public.organization_tasks where status = 'completed'),
    'failed_tasks', (select count(*) from public.organization_tasks where status = 'failed'),
    'today_completed', (
      select count(*) from public.organization_tasks
      where status = 'completed' and created_at >= now()::date
    ),
    'clickup_imported_count', (
      select count(*) from public.organization_clickup_imports where sync_status = 'synced'
    ),
    'clickup_import_errors', (
      select count(*) from public.organization_clickup_imports where sync_status = 'error'
    )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_organization_agents() — List all agents with stats
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_agents(
  p_status text default null,
  p_system text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  agent_type text,
  role text,
  system text,
  status text,
  active_tasks_count integer,
  completed_tasks_count integer,
  failed_tasks_count integer,
  last_activity_at timestamptz,
  capabilities text[],
  metadata jsonb
)
language sql
security invoker
as $$
  select
    org.id,
    org.name,
    org.agent_type,
    org.role,
    org.system,
    org.status,
    org.active_tasks_count,
    org.completed_tasks_count,
    org.failed_tasks_count,
    org.last_activity_at,
    org.capabilities,
    org.metadata
  from public.organization_agents org
  where (p_status is null or org.status = p_status)
    and (p_system is null or org.system = p_system)
  order by org.last_activity_at desc nulls last
  limit p_limit
  offset p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_organization_tasks() — List tasks with filters
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_tasks(
  p_status text default null,
  p_agent_id uuid default null,
  p_worker_id uuid default null,
  p_source text default null,
  p_priority text default null,
  p_system text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  priority text,
  system text,
  assigned_agent_id uuid,
  assigned_worker_id uuid,
  status text,
  source text,
  source_task_id text,
  created_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  output_url text,
  follow_up_action text
)
language sql
security invoker
as $$
  select
    t.id,
    t.title,
    t.description,
    t.priority,
    t.system,
    t.assigned_agent_id,
    t.assigned_worker_id,
    t.status,
    t.source,
    t.source_task_id,
    t.created_at,
    t.started_at,
    t.finished_at,
    t.error,
    t.output_url,
    t.follow_up_action
  from public.organization_tasks t
  where (p_status is null or t.status = p_status)
    and (p_agent_id is null or t.assigned_agent_id = p_agent_id)
    and (p_worker_id is null or t.assigned_worker_id = p_worker_id)
    and (p_source is null or t.source = p_source)
    and (p_priority is null or t.priority = p_priority)
    and (p_system is null or t.system = p_system)
  order by t.created_at desc
  limit p_limit
  offset p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. get_organization_task_detail() — Get full task with logs and timeline
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_task_detail(p_task_id uuid)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'task', (
      select row_to_json(t)
      from (
        select
          ot.id,
          ot.title,
          ot.description,
          ot.priority,
          ot.system,
          ot.assigned_agent_id,
          ot.assigned_worker_id,
          ot.status,
          ot.source,
          ot.source_task_id,
          ot.created_at,
          ot.started_at,
          ot.finished_at,
          ot.error,
          ot.output_url,
          ot.follow_up_action,
          ot.dependencies
        from public.organization_tasks ot
        where ot.id = p_task_id
      ) t
    ),
    'agent', (
      select row_to_json(a) from public.organization_agents a
      where a.id = (select assigned_agent_id from public.organization_tasks where id = p_task_id)
    ),
    'worker', (
      select row_to_json(w) from public.organization_workers w
      where w.id = (select assigned_worker_id from public.organization_tasks where id = p_task_id)
    ),
    'logs', (
      select coalesce(jsonb_agg(row_to_json(l)), '[]'::jsonb)
      from (
        select id, timestamp, action, actor_type, actor_id, details
        from public.organization_task_logs
        where task_id = p_task_id
        order by timestamp asc
      ) l
    ),
    'assignments', (
      select coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb)
      from (
        select agent_id, assigned_at, unassigned_at, reason
        from public.organization_agent_assignments
        where task_id = p_task_id
        order by assigned_at desc
      ) a
    )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. get_agent_timeline() — Get chronological task history for an agent
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_agent_timeline(p_agent_id uuid)
returns table (
  task_id uuid,
  title text,
  status text,
  priority text,
  created_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint,
  worker_name text,
  error text
)
language sql
security invoker
as $$
  select
    t.id,
    t.title,
    t.status,
    t.priority,
    t.created_at,
    t.started_at,
    t.finished_at,
    extract(epoch from (coalesce(t.finished_at, now()) - t.started_at))::bigint * 1000,
    w.worker_name,
    t.error
  from public.organization_tasks t
  left join public.organization_workers w on t.assigned_worker_id = w.id
  where t.assigned_agent_id = p_agent_id
  order by t.created_at desc;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. get_organization_workers() — List all workers with status
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_workers(
  p_status text default null,
  p_worker_type text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  worker_name text,
  worker_type text,
  host text,
  port integer,
  status text,
  current_task_id uuid,
  queue_length integer,
  last_heartbeat timestamptz,
  heartbeat_age_seconds integer,
  metadata jsonb
)
language sql
security invoker
as $$
  select
    w.id,
    w.worker_name,
    w.worker_type,
    w.host,
    w.port,
    w.status,
    w.current_task_id,
    w.queue_length,
    w.last_heartbeat,
    (extract(epoch from (now() - w.last_heartbeat)))::integer,
    w.metadata
  from public.organization_workers w
  where (p_status is null or w.status = p_status)
    and (p_worker_type is null or w.worker_type = p_worker_type)
  order by w.last_heartbeat desc nulls last
  limit p_limit
  offset p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_organization_llama_workers() — List llama.cpp workers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_organization_llama_workers(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  worker_name text,
  host text,
  port integer,
  model_name text,
  context_size integer,
  threads integer,
  gpu_layers integer,
  status text,
  current_task_id uuid,
  queue_length integer,
  last_heartbeat timestamptz,
  heartbeat_age_seconds integer,
  tokens_per_second real,
  memory_usage_mb integer,
  error text
)
language sql
security invoker
as $$
  select
    l.id,
    l.worker_name,
    l.host,
    l.port,
    l.model_name,
    l.context_size,
    l.threads,
    l.gpu_layers,
    l.status,
    l.current_task_id,
    l.queue_length,
    l.last_heartbeat,
    (extract(epoch from (now() - l.last_heartbeat)))::integer,
    l.tokens_per_second,
    l.memory_usage_mb,
    l.error
  from public.organization_llama_workers l
  where (p_status is null or l.status = p_status)
  order by l.last_heartbeat desc nulls last
  limit p_limit
  offset p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. log_task_action() — Helper to log task actions
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.log_task_action(
  p_task_id uuid,
  p_action text,
  p_actor_type text default null,
  p_actor_id uuid default null,
  p_details jsonb default null
)
returns uuid
language sql
security invoker
as $$
  insert into public.organization_task_logs (
    task_id,
    action,
    actor_type,
    actor_id,
    details
  ) values (p_task_id, p_action, p_actor_type, p_actor_id, coalesce(p_details, '{}'::jsonb))
  returning id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. claim_organization_task() — Atomically assign task to agent/worker
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.claim_organization_task(
  p_task_id uuid,
  p_agent_id uuid,
  p_worker_id uuid default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_task record;
  v_result jsonb;
begin
  -- Lock and check task
  select * into v_task from public.organization_tasks
  where id = p_task_id
  for update;

  if v_task is null then
    return jsonb_build_object('success', false, 'error', 'Task not found');
  end if;

  -- Update task
  update public.organization_tasks
  set
    assigned_agent_id = p_agent_id,
    assigned_worker_id = p_worker_id,
    status = case
      when p_worker_id is not null then 'assigned'
      else 'assigned'
    end,
    started_at = now()
  where id = p_task_id;

  -- Log assignment
  perform public.log_task_action(
    p_task_id,
    'assigned',
    'system',
    null,
    jsonb_build_object('agent_id', p_agent_id, 'worker_id', p_worker_id)
  );

  -- Record assignment history
  insert into public.organization_agent_assignments (
    agent_id, task_id, reason
  ) values (p_agent_id, p_task_id, 'dispatch');

  return jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'agent_id', p_agent_id,
    'worker_id', p_worker_id
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. update_task_status() — Update task status with logging
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.update_task_status(
  p_task_id uuid,
  p_new_status text,
  p_error text default null,
  p_output_url text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_old_status text;
begin
  -- Get current status
  select status into v_old_status from public.organization_tasks where id = p_task_id;

  if v_old_status is null then
    return jsonb_build_object('success', false, 'error', 'Task not found');
  end if;

  -- Update task
  update public.organization_tasks
  set
    status = p_new_status,
    error = p_error,
    output_url = coalesce(p_output_url, output_url),
    finished_at = case
      when p_new_status in ('completed', 'failed', 'cancelled') then now()
      else finished_at
    end
  where id = p_task_id;

  -- Log status change
  perform public.log_task_action(
    p_task_id,
    'status_changed',
    'system',
    null,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_new_status,
      'error', p_error
    )
  );

  return jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
end $$;
