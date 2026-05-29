-- ============================================================================
-- Migration 110: Hermes Dispatch (P5 — CLI-L/CLI-R Local Worker Dispatcher)
-- ============================================================================
-- Depends on: 104 (hermes schema + touch_updated_at)
-- Doel: Hermes bepaalt de werkverdeling over hosts. Werk krijgt target_host
--       (cli-l | cli-r | any); elke host claimt atomisch zijn werk. Additief.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HOSTS — register van uitvoerende machines
-- ----------------------------------------------------------------------------
create table if not exists hermes.hosts (
  host_id      text primary key,                 -- 'cli-l' | 'cli-r' | 'render' | ...
  label        text not null,
  role         text not null default 'worker',   -- dev|worker|orchestrator
  capabilities jsonb not null default '[]'::jsonb,
  active       boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into hermes.hosts (host_id, label, role, capabilities) values
  ('cli-l', 'CLI-L (Mac mini — dev/orchestration)', 'orchestrator',
   '["governance","frontend","orchestration","validation"]'::jsonb),
  ('cli-r', 'CLI-R (Mac mini — heavy workers)', 'worker',
   '["scraping","ocr","rendering","llm","aquier-product"]'::jsonb)
on conflict (host_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. DISPATCH_QUEUE — werk met target_host + lifecycle
-- ----------------------------------------------------------------------------
create table if not exists hermes.dispatch_queue (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  workstream   text,                              -- bv. 'P1','P4','infra'
  repo         text,                              -- 'aquire' | 'orlando-core-os'
  target_host  text not null default 'any' check (target_host in ('cli-l','cli-r','any')),
  priority     int not null default 5,            -- lager = eerder
  status       text not null default 'queued'
                 check (status in ('queued','claimed','running','done','failed','blocked')),
  payload      jsonb not null default '{}'::jsonb,
  depends_on   uuid[] not null default '{}',
  claimed_by   text references hermes.hosts(host_id) on delete set null,
  claimed_at   timestamptz,
  heartbeat_at timestamptz,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists hermes_dispatch_queue_claimable_idx
  on hermes.dispatch_queue (target_host, priority, created_at) where status='queued';
create index if not exists hermes_dispatch_queue_host_idx
  on hermes.dispatch_queue (claimed_by, status);

-- ----------------------------------------------------------------------------
-- 3. dispatch_claim — atomair claimen per host (race-veilig)
--    Pakt queued werk voor deze host of 'any', skip rijen met open dependencies.
-- ----------------------------------------------------------------------------
create or replace function hermes.dispatch_claim(p_host text, p_limit int default 5)
returns setof hermes.dispatch_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- heartbeat host
  update hermes.hosts set last_seen_at = now(), updated_at = now() where host_id = p_host;

  return query
  with claimable as (
    select q.id
    from hermes.dispatch_queue q
    where q.status = 'queued'
      and q.target_host in (p_host, 'any')
      and not exists (
        select 1 from unnest(q.depends_on) dep
        join hermes.dispatch_queue d on d.id = dep
        where d.status <> 'done'
      )
    order by q.priority asc, q.created_at asc
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update hermes.dispatch_queue q
  set status = 'claimed', claimed_by = p_host, claimed_at = now(),
      heartbeat_at = now(), updated_at = now()
  from claimable c
  where q.id = c.id
  returning q.*;
end $$;

-- ----------------------------------------------------------------------------
-- 4. RLS — service_role full + authenticated read (patroon mig 106/109)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['hosts','dispatch_queue'] loop
    execute format('alter table hermes.%I enable row level security;', t);
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='service_role_full') then
      execute format($p$create policy "service_role_full" on hermes.%I as permissive for all to service_role using (true) with check (true);$p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='auth_read') then
      execute format($p$create policy "auth_read" on hermes.%I for select to authenticated using (true);$p$, t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Triggers + grants
-- ----------------------------------------------------------------------------
drop trigger if exists trg_hosts_touch on hermes.hosts;
create trigger trg_hosts_touch before update on hermes.hosts
  for each row execute function hermes.touch_updated_at();
drop trigger if exists trg_dispatch_queue_touch on hermes.dispatch_queue;
create trigger trg_dispatch_queue_touch before update on hermes.dispatch_queue
  for each row execute function hermes.touch_updated_at();

grant usage on schema hermes to service_role;
grant all on hermes.hosts to service_role;
grant all on hermes.dispatch_queue to service_role;
grant select on hermes.hosts to authenticated;
grant select on hermes.dispatch_queue to authenticated;
grant execute on function hermes.dispatch_claim(text, int) to service_role;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop function if exists hermes.dispatch_claim(text,int);
-- drop table if exists hermes.dispatch_queue;
-- drop table if exists hermes.hosts;
