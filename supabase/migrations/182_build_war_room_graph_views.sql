-- 182_build_war_room_graph_views.sql
-- Build Tracker War Room — read-only graaf-views (ENTITEIT → PROGRAMMA → PROJECT →
-- MILESTONE → BUILD ITEM → PR → DEPENDENCY → RESULTAAT) + completion/blocker/risk/
-- revenue/timeline-engines. Afgeleid uit ECHTE tabellen (geen mock).
-- GEEN tabellen/workers/cron → Engine-Planner-regel n.v.t. Idempotent (create or replace).
-- Elke koppeling draagt confidence + source_reason (aanscherping 2). PR's = inferred (4).

-- ── helper: item → project match (fuzzy, transparant) ──────────────────────
create or replace view public.v_build_item_project_match as
select distinct on (i.id)
  i.id                                                          as item_id,
  b.id                                                          as project_id,
  c.slug                                                        as entity_slug,
  round(similarity(lower(i.title), lower(b.name))::numeric, 3)  as similarity,
  'title_fuzzy'::text                                           as source_reason
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
join public.build_tracker b on true
join public.companies c on c.id = b.company_id
where similarity(lower(i.title), lower(b.name)) >= 0.35
order by i.id, similarity(lower(i.title), lower(b.name)) desc;

-- ── NODES ──────────────────────────────────────────────────────────────────
create or replace view public.v_build_war_room_nodes as
-- 1) ENTITEIT
select
  'entity:'||c.slug                                      as node_id,
  'entity'::text                                         as node_type,
  c.name                                                 as label,
  case when p.slug is not null then 'entity:'||p.slug end as parent_id,
  c.slug                                                 as entity_slug,
  null::text                                             as status,
  null::int                                              as progress,
  null::numeric                                          as score,
  c.created_at                                           as created_at,
  null::timestamptz                                      as target_at,
  jsonb_build_object('type',c.type,'kvk',c.kvk_number,'parent_slug',p.slug,
                     'confidence',1,'source_reason','manual') as payload
from public.companies c
left join public.companies p on p.id = c.parent_id
where c.slug is not null

union all
-- 2) PROGRAMMA
select
  'program:'||pr.id, 'program', pr.label, 'entity:'||c.slug, c.slug,
  case when pr.is_proposed then 'proposed' else 'confirmed' end,
  null::int, null::numeric, pr.created_at, null,
  jsonb_build_object('program_key',pr.program_key,'description',pr.description,
    'is_proposed',pr.is_proposed,'source_docs',pr.source_docs,
    'confidence',1,'source_reason','manual')
from public.build_programs pr
join public.companies c on c.id = pr.entity_id

union all
-- 2b) TRACKER-DOC grouping (voor build-items zonder project-match)
select
  'tracker:'||d.scope, 'program', 'Tracker · '||d.scope, 'entity:osm', 'osm',
  'tracker_doc', null::int, null::numeric, d.synced_at, null,
  jsonb_build_object('source_file',d.source_file,'source_commit',d.source_commit,
    'kind','tracker_doc','confidence',1,'source_reason','manual')
from public.build_tracker_documents d where d.is_current

union all
-- 3) PROJECT
select
  'project:'||b.id, 'project', b.name,
  coalesce('program:'||b.program_id::text, 'entity:'||c.slug), c.slug,
  b.status, b.progress_pct, b.expected_revenue_amount, b.started_at, b.target_at,
  jsonb_build_object('owner',b.owner,'current_milestone',b.current_milestone,
    'description',left(coalesce(b.description,''),300),'account_status',b.account_status,
    'requires_account_setup',b.requires_account_setup,
    'expected_revenue_amount',b.expected_revenue_amount,'revenue_currency',b.revenue_currency,
    'last_update_at',b.last_update_at,'confidence',1,
    'source_reason', case when b.program_id is not null then 'manual' else 'entity_default' end)
from public.build_tracker b
join public.companies c on c.id = b.company_id

union all
-- 4) MILESTONE (holding-niveau → onder OSM-entiteit)
select
  'milestone:'||m.id, 'milestone', m.naam, 'entity:osm', 'osm',
  m.status, m.progress_pct, m.milestone_nr::numeric, m.created_at, null,
  jsonb_build_object('milestone_nr',m.milestone_nr,'value_stage',m.value_stage,
    'verdienmodel',m.verdienmodel,'fundament',m.fundament,'route',m.route,
    'notes',m.notes,'confidence',1,'source_reason','manual')
from public.holding_milestones m

union all
-- 5) BUILD ITEM (parent = gematcht project, anders tracker-doc; transparante confidence)
select
  'build_item:'||i.id, 'build_item', i.title,
  coalesce('project:'||mm.project_id::text, 'tracker:'||d.scope),
  coalesce(mm.entity_slug,'osm'),
  i.status_tag, null::int, mm.similarity, i.created_at, null,
  jsonb_build_object('section',i.section,'blocker_code',i.blocker_code,'owner',i.owner,
    'repo',i.repo,'route',i.route,'evidence',i.evidence,'deploy_allowed',i.deploy_allowed,
    'detail',left(coalesce(i.detail,''),300),'status_tag',i.status_tag,
    'confidence', coalesce(mm.similarity, 0.30),
    'source_reason', coalesce(mm.source_reason, 'inferred'))
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
left join public.v_build_item_project_match mm on mm.item_id = i.id

union all
-- 6) PR (inferred uit #nummer; gededupliceerd per repo+nummer)
select
  pr.node_id, 'pr', 'PR #'||pr.num, 'build_item:'||pr.item_id, pr.entity_slug,
  pr.status_tag, null::int, null::numeric, pr.created_at, null,
  jsonb_build_object('source','inferred_from_build_tracker_item','pr_number',pr.num,
    'repo',pr.repo,'confidence',0.5,'source_reason','inferred')
from (
  select distinct on (coalesce(i.repo,'?'), rx[1])
    'pr:'||coalesce(i.repo,'?')||'#'||rx[1]  as node_id,
    rx[1]                                     as num,
    i.id                                      as item_id,
    i.repo                                    as repo,
    coalesce(mm.entity_slug,'osm')            as entity_slug,
    case
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'merged' then 'MERGED'
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'draft'  then 'DRAFT'
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'closed' then 'CLOSED'
      else 'inferred' end                     as status_tag,
    i.created_at                              as created_at
  from public.build_tracker_items i
  join public.build_tracker_documents d on d.id = i.document_id and d.is_current
  left join public.v_build_item_project_match mm on mm.item_id = i.id
  cross join lateral regexp_matches(
    coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.raw_line,''),
    '#([0-9]+)', 'g') as rx
  order by coalesce(i.repo,'?'), rx[1], i.created_at desc
) pr

union all
-- 7) RESULTAAT / REVENUE (per project met verwachte omzet of account-setup)
select
  'revenue:'||b.id, 'revenue', coalesce(b.expected_revenue_model,'Omzet'),
  'project:'||b.id, c.slug, b.account_status, null::int,
  b.expected_revenue_amount, b.created_at, null,
  jsonb_build_object('expected_amount',b.expected_revenue_amount,'model',b.expected_revenue_model,
    'currency',b.revenue_currency,
    'actual_amount',(select coalesce(sum(ar.actual_amount),0) from public.account_setups s
        join public.account_revenues ar on ar.account_setup_id = s.id where s.build_task_id = b.id),
    'confidence',1,'source_reason','manual')
from public.build_tracker b
join public.companies c on c.id = b.company_id
where coalesce(b.expected_revenue_amount,0) > 0 or b.requires_account_setup;

-- ── EDGES ──────────────────────────────────────────────────────────────────
create or replace view public.v_build_war_room_edges as
select parent_id as source_id, node_id as target_id, 'spine'::text as edge_type
from public.v_build_war_room_nodes where parent_id is not null
union all
select 'project:'||dep.source_build_id, 'project:'||dep.target_build_id,
  case when dep.relationship_type = 'blocks' then 'blocker' else 'dependency' end
from public.build_project_dependencies dep
union all
select 'build_item:'||i.id, 'project:'||mm.project_id, 'blocker'
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
join public.v_build_item_project_match mm on mm.item_id = i.id
where i.section = 'C' and i.blocker_code is not null;

-- ── ENGINE: completion per entiteit (echte tellingen, geen handmatig %) ─────
create or replace view public.v_build_entity_completion as
select
  c.slug as entity_slug, c.name as entity_name, c.type as entity_type,
  count(b.*) as total,
  count(*) filter (where b.status = 'live')                          as done,
  count(*) filter (where b.status in ('building','testing','deploying')) as in_progress,
  count(*) filter (where b.status in ('planned'))                    as queued,
  count(*) filter (where b.status in ('failed','paused'))            as blocked,
  case when count(b.*) > 0
       then round(100.0 * count(*) filter (where b.status='live') / count(b.*))
       else 0 end                                                    as completion_pct,
  count(*) filter (where b.status in ('failed','paused'))            as blocker_count,
  count(*) filter (where b.last_update_at < now() - interval '14 days'
                     and b.status <> 'live')                         as stale_count
from public.companies c
left join public.build_tracker b on b.company_id = c.id
where c.slug is not null
group by c.slug, c.name, c.type;

-- ── ENGINE: blockers ───────────────────────────────────────────────────────
create or replace view public.v_build_blockers as
select 'project'::text as src, c.slug as entity_slug, null::text as code,
  b.name as title, 'status='||b.status as reason, b.owner, b.current_milestone as waiting_on,
  b.last_update_at as ts
from public.build_tracker b join public.companies c on c.id = b.company_id
where b.status in ('failed','paused')
union all
select 'tracker_item', coalesce(mm.entity_slug,'osm'), i.blocker_code,
  i.title, left(coalesce(i.detail, i.evidence,''),200), i.owner, i.route, i.created_at
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
left join public.v_build_item_project_match mm on mm.item_id = i.id
where i.section = 'C' and i.blocker_code is not null;

-- ── ENGINE: risico's ───────────────────────────────────────────────────────
create or replace view public.v_build_risks as
select 'stalled'::text as risk_type, c.slug as entity_slug, b.name as subject,
  'geen update sinds '||to_char(b.last_update_at,'YYYY-MM-DD') as detail,
  case when b.last_update_at < now() - interval '30 days' then 'high' else 'medium' end as severity,
  b.last_update_at as ts
from public.build_tracker b join public.companies c on c.id = b.company_id
where b.status <> 'live' and b.last_update_at < now() - interval '14 days'
union all
select 'missing_resource', c.slug, b.name,
  'account-setup vereist, status='||coalesce(b.account_status,'onbekend'), 'high', b.last_update_at
from public.build_tracker b join public.companies c on c.id = b.company_id
where b.requires_account_setup and coalesce(b.account_status,'') <> 'actief';

-- ── ENGINE: revenue-map ────────────────────────────────────────────────────
create or replace view public.v_build_revenue_map as
select c.slug as entity_slug, b.id as project_id, b.name as project,
  b.expected_revenue_model as model, coalesce(b.expected_revenue_amount,0) as expected,
  coalesce(b.revenue_currency,'EUR') as currency,
  coalesce((select sum(ar.actual_amount) from public.account_setups s
     join public.account_revenues ar on ar.account_setup_id = s.id
     where s.build_task_id = b.id),0) as actual
from public.build_tracker b join public.companies c on c.id = b.company_id
where coalesce(b.expected_revenue_amount,0) > 0;

-- ── ENGINE: timeline ───────────────────────────────────────────────────────
create or replace view public.v_build_timeline as
select b.started_at as ts, 'project_started'::text as event_type, c.slug as entity_slug,
  'project:'||b.id as node_id, b.name as label
from public.build_tracker b join public.companies c on c.id = b.company_id
where b.started_at is not null
union all
select b.target_at, 'project_target', c.slug, 'project:'||b.id, b.name
from public.build_tracker b join public.companies c on c.id = b.company_id
where b.target_at is not null
union all
select i.created_at, 'tracker_item_'||i.section, coalesce(mm.entity_slug,'osm'),
  'build_item:'||i.id, i.title
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
left join public.v_build_item_project_match mm on mm.item_id = i.id;

-- ── GRANTS ─────────────────────────────────────────────────────────────────
grant select on
  public.v_build_item_project_match, public.v_build_war_room_nodes,
  public.v_build_war_room_edges, public.v_build_entity_completion,
  public.v_build_blockers, public.v_build_risks,
  public.v_build_revenue_map, public.v_build_timeline
  to authenticated, anon;
