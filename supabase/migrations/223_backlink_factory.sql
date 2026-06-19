-- ─────────────────────────────────────────────────────────────────────────
-- Migration 223 — Backlink Factory (target-registry + KPI)
-- ─────────────────────────────────────────────────────────────────────────
-- Operationele cockpit voor linkbuilding (aquier.com + later andere sites).
-- Spiegelt affiliate_programs (mig 100): registry van targets (directories,
-- communities, owned, outreach) met submit-status + verkregen placement-URL.
-- Ratio-model: tel referring DOMAINS, vloer ~1 per 10 pagina's, concentreer op
-- pillars (tier 1). Idempotent. RLS service_all + authenticated_read.

create table if not exists public.backlink_targets (
  id             uuid primary key default gen_random_uuid(),
  site           text not null default 'aquier.com',
  name           text not null,
  category       text not null default 'directory_saas'
                   check (category in ('owned','directory_saas','directory_ai','directory_nl','community','blog_outreach','pr','other')),
  url            text,
  domain_rating  int,                       -- DR/autoriteit van de bron (voor prioritering)
  dofollow       boolean,
  cost           text not null default 'free' check (cost in ('free','freemium','paid')),
  tier           int  not null default 2,   -- 1=pillar-prioriteit · 2=standaard · 3=long-tail
  submit_status  text not null default 'not_started'
                   check (submit_status in ('not_started','queued','submitted','pending','live','rejected','na')),
  target_page    text,                       -- welke aquier-pillar we hiermee linken
  placement_url  text,                       -- live backlink-URL zodra verkregen
  notes          text,
  assigned_agent text,
  next_action_at timestamptz,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (site, name)
);
create index if not exists idx_backlink_site     on public.backlink_targets (site);
create index if not exists idx_backlink_status   on public.backlink_targets (submit_status);
create index if not exists idx_backlink_category on public.backlink_targets (category);
create index if not exists idx_backlink_tier     on public.backlink_targets (tier);

-- hergebruik bestaande touch-functie (mig 100)
drop trigger if exists trg_backlink_targets_updated_at on public.backlink_targets;
create trigger trg_backlink_targets_updated_at before update on public.backlink_targets
  for each row execute function public.affiliate_programs_touch_updated_at();

-- KPI: per site totalen + live referring domains (distinct host van placement_url).
create or replace view public.v_backlink_overview
with (security_invoker = on) as
select
  site,
  count(*)                                              as total_targets,
  count(*) filter (where submit_status = 'live')        as live,
  count(*) filter (where submit_status in ('submitted','pending','queued')) as in_progress,
  count(*) filter (where submit_status = 'not_started') as todo,
  count(distinct case when submit_status = 'live' and placement_url is not null
    then split_part(regexp_replace(placement_url, '^https?://(www\.)?', ''), '/', 1) end) as referring_domains_live
from public.backlink_targets
group by site;

comment on view public.v_backlink_overview is
  'Backlink Factory KPI: per site total/live/in_progress/todo + distinct live referring domains. Bron voor dashboard.';

-- RLS
alter table public.backlink_targets enable row level security;
drop policy if exists backlink_targets_service_all on public.backlink_targets;
create policy backlink_targets_service_all on public.backlink_targets
  for all to service_role using (true) with check (true);
drop policy if exists backlink_targets_authenticated_read on public.backlink_targets;
create policy backlink_targets_authenticated_read on public.backlink_targets
  for select to authenticated using (true);
grant select on public.v_backlink_overview to authenticated, service_role;
