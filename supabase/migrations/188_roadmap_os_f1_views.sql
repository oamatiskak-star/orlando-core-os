-- 188_roadmap_os_f1_views.sql
-- Roadmap OS F1 — strategie-views (read-only, additief). Geen datamutatie.
-- v_build_roadmap_projects normaliseert build_tracker + aquier_projects tot één projectmodel
-- met genormaliseerde status/priority/datums. Einddatum = echte commitment óf transparante schatting
-- (end_source 'committed'|'estimated') — geen undated-lane, geen gefabriceerde opgeslagen deadline.

create or replace view public.v_build_roadmap_projects as
-- bron A: build_tracker
select
  'bt:'||b.id                                            as id,
  'build_tracker'::text                                  as source,
  c.slug                                                 as entity_slug,
  coalesce(pr.label, 'Ongegroepeerd')                    as program,
  b.name                                                 as name,
  case b.status
    when 'live' then 'done' when 'failed' then 'blocked' when 'paused' then 'blocked'
    when 'planned' then 'queued' else 'in_progress' end  as status_norm,
  coalesce(b.priority, b.suggested_priority)             as priority_norm,
  b.priority_source_reason                               as priority_source,
  b.progress_pct                                         as progress,
  b.started_at                                           as start_at,
  coalesce(b.target_at, b.started_at + interval '30 days') as end_at,
  case when b.target_at is not null then 'committed' else 'estimated' end as end_source,
  coalesce(b.expected_revenue_amount,0)                  as revenue,
  b.owner                                                as owner,
  b.current_milestone                                    as milestone
from public.build_tracker b
join public.companies c on c.id = b.company_id
left join public.build_programs pr on pr.id = b.program_id

union all
-- bron B: aquier_projects (masterplan, entiteit modiwe-software)
select
  'aq:'||ap.id, 'aquier', 'modiwe-software', 'AQUIER GLOBAL EXPANSION MASTERPLAN', ap.name,
  case ap.status when 'completed' then 'done' when 'in_progress' then 'in_progress' else 'queued' end,
  case ap.priority when 'critical' then 'P0' when 'high' then 'P1' when 'medium' then 'P2' else null end,
  'aquier_projects.priority',
  ap.progress_pct,
  ap.start_at,
  coalesce(ap.due_at, ap.start_at + interval '30 days'),
  case when ap.due_at is not null then 'committed' else 'estimated' end,
  0,
  ap.owner_agent,
  ap.code
from public.aquier_projects ap;

-- ── Agenda Vandaag (planning_items, gescoped op entiteit) ──────────────────
create or replace view public.v_build_today_agenda as
select
  p.id, c.slug as entity_slug, p.titel, p.type, p.status, p.priority, p.toegewezen,
  p.start_date, p.due_date
from public.planning_items p
left join public.companies c on c.id = p.company_id
where p.completed_at is null
  and (
    p.due_date::date = current_date
    or (p.start_date::date <= current_date and (p.due_date is null or p.due_date::date >= current_date))
  );

-- ── Komende Milestones (echte target_date eerst, dan op volgorde) ──────────
create or replace view public.v_build_upcoming_milestones as
select
  m.id, m.milestone_nr, m.naam, m.status, m.progress_pct, m.value_stage, m.verdienmodel, m.target_date
from public.holding_milestones m
order by
  case when m.target_date is not null then 0 else 1 end,
  m.target_date asc nulls last,
  m.milestone_nr asc;

-- ── Activiteit-feed (op v_build_timeline + recente project-status-updates) ─
create or replace view public.v_build_activity_feed as
select ts, event_type, entity_slug, node_id, label
from public.v_build_timeline
where ts is not null
union all
select b.last_update_at, 'project_update', c.slug, 'project:'||b.id, b.name || ' → ' || b.status
from public.build_tracker b
join public.companies c on c.id = b.company_id
where b.last_update_at is not null;

grant select on
  public.v_build_roadmap_projects, public.v_build_today_agenda,
  public.v_build_upcoming_milestones, public.v_build_activity_feed
  to authenticated, anon;
