-- Planning module: tasks and milestones

create table if not exists public.planning_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete set null,
  type         text not null default 'taak',     -- taak | mijlpaal | fase
  status       text not null default 'open',     -- open | bezig | gereed | geblokkeerd
  priority     text not null default 'normaal',  -- laag | normaal | hoog | urgent
  titel        text not null,
  beschrijving text,
  toegewezen   text,                              -- name of assignee
  start_date   date,
  due_date     date,
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists planning_project_idx on public.planning_items(project_id);
create index if not exists planning_status_idx  on public.planning_items(status);
create index if not exists planning_due_idx     on public.planning_items(due_date asc nulls last);
