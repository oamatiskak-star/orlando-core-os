-- 186_build_war_room_aquier_masterplan.sql
-- Surface de Aquier Global Expansion Masterplan in de War Room voor entiteit modiwe-software.
-- Het masterplan staat AL als 43 modules in public.aquier_projects (= de Software "Projecten"-afdeling,
-- /dashboard/aquier/projecten). De War Room las alleen build_tracker → masterplan onzichtbaar.
-- Deze migratie laat de nodes-view OOK aquier_projects lezen onder een synthetische programma-node,
-- zodat War Room en Projecten-afdeling dezelfde ECHTE bron tonen.
-- GEEN nieuwe rijen, GEEN datamutatie, GEEN duplicatie naar build_tracker, GEEN schema-wijziging.
-- Bouwt voort op 185 (entity-attributie classifier) — bevat de volledige view + 2 nieuwe branches.
-- Rollback = view-definitie 185 opnieuw toepassen.

create or replace view public.v_build_war_room_nodes as
-- 1) ENTITEIT
select 'entity:'||c.slug as node_id, 'entity'::text as node_type, c.name as label,
  case when p.slug is not null then 'entity:'||p.slug end as parent_id, c.slug as entity_slug,
  null::text as status, null::int as progress, null::numeric as score, c.created_at as created_at, null::timestamptz as target_at,
  jsonb_build_object('type',c.type,'kvk',c.kvk_number,'parent_slug',p.slug,'confidence',1,'source_reason','manual') as payload
from public.companies c left join public.companies p on p.id = c.parent_id where c.slug is not null
union all
-- 2) PROGRAMMA (uit build_programs)
select 'program:'||pr.id, 'program', pr.label, 'entity:'||c.slug, c.slug,
  case when pr.is_proposed then 'proposed' else 'confirmed' end, null::int, null::numeric, pr.created_at, null,
  jsonb_build_object('program_key',pr.program_key,'description',pr.description,'is_proposed',pr.is_proposed,'source_docs',pr.source_docs,'confidence',1,'source_reason','manual')
from public.build_programs pr join public.companies c on c.id = pr.entity_id
union all
-- 2b) TRACKER-DOC grouping
select 'tracker:'||d.scope, 'program', 'Tracker · '||d.scope, 'entity:osm', 'osm', 'tracker_doc', null::int, null::numeric, d.synced_at, null,
  jsonb_build_object('source_file',d.source_file,'source_commit',d.source_commit,'kind','tracker_doc','confidence',1,'source_reason','manual')
from public.build_tracker_documents d where d.is_current
union all
-- 3) PROJECT (build_tracker)
select 'project:'||b.id, 'project', b.name, coalesce('program:'||b.program_id::text, 'entity:'||c.slug), c.slug,
  b.status, b.progress_pct, b.expected_revenue_amount, b.started_at, b.target_at,
  jsonb_build_object('owner',b.owner,'current_milestone',b.current_milestone,'description',left(coalesce(b.description,''),300),'account_status',b.account_status,
    'requires_account_setup',b.requires_account_setup,'expected_revenue_amount',b.expected_revenue_amount,'revenue_currency',b.revenue_currency,
    'last_update_at',b.last_update_at,'confidence',1,'source_reason', case when b.program_id is not null then 'manual' else 'entity_default' end)
from public.build_tracker b join public.companies c on c.id = b.company_id
union all
-- 4) MILESTONE (holding-niveau onder osm; ONGEWIJZIGD)
select 'milestone:'||m.id, 'milestone', m.naam, 'entity:osm', 'osm', m.status, m.progress_pct, m.milestone_nr::numeric, m.created_at, null,
  jsonb_build_object('milestone_nr',m.milestone_nr,'value_stage',m.value_stage,'verdienmodel',m.verdienmodel,'fundament',m.fundament,'route',m.route,'notes',m.notes,'confidence',1,'source_reason','manual')
from public.holding_milestones m
union all
-- 5) BUILD ITEM (keyword-classifier — 185)
select 'build_item:'||i.id, 'build_item', i.title, coalesce('project:'||mm.project_id::text, 'tracker:'||d.scope),
  coalesce(mm.entity_slug, k.ke, 'osm'), i.status_tag, null::int, mm.similarity, i.created_at, null,
  jsonb_build_object('section',i.section,'blocker_code',i.blocker_code,'owner',i.owner,'repo',i.repo,'route',i.route,'evidence',i.evidence,'deploy_allowed',i.deploy_allowed,
    'detail',left(coalesce(i.detail,''),300),'status_tag',i.status_tag,
    'confidence', case when mm.entity_slug is not null then greatest(coalesce(mm.similarity,0.6),0.6) when k.ke is not null then 0.5 else 0.30 end,
    'source_reason', case when mm.entity_slug is not null then coalesce(mm.source_reason,'title_fuzzy') when k.ke is not null then 'keyword' else 'inferred' end)
from public.build_tracker_items i
join public.build_tracker_documents d on d.id = i.document_id and d.is_current
left join public.v_build_item_project_match mm on mm.item_id = i.id
cross join lateral (
  select nullif(case
    when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'sterkcalc|stabu|calculat|bouwkost|aannemer|offerte|strkbouw' then 'strkbouw'
    when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'funda|off.?market|veiling|leegstand|kadaster|acquisit|vastgoed|projectontwikkel|strkbeheer|investor' then 'strkbeheer'
    when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'youtube|channel|kanaal|video|thumbnail|short|viral|render|hook|publishing|affiliate|monetiz|content.?factory|cf2' then 'modiwe-media'
    when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'aquier|membership|stripe|moneybird|seo|deal.?flow|dealcard|checkout|rapport|report|financing|makelaar|funnel|kennisbank|hermes|core.?os|build.?tracker|agent|api|dashboard|infra|orlando' then 'modiwe-software'
    else '' end, '') as ke
) k
union all
-- 6) PR (inferred; erft entiteit via classifier — 185)
select pr.node_id, 'pr', 'PR #'||pr.num, 'build_item:'||pr.item_id, pr.entity_slug, pr.status_tag, null::int, null::numeric, pr.created_at, null,
  jsonb_build_object('source','inferred_from_build_tracker_item','pr_number',pr.num,'repo',pr.repo,'confidence',0.5,'source_reason','inferred','entity_reason',pr.entity_reason)
from (
  select distinct on (coalesce(i.repo,'?'), rx[1])
    'pr:'||coalesce(i.repo,'?')||'#'||rx[1] as node_id, rx[1] as num, i.id as item_id, i.repo as repo,
    coalesce(mm.entity_slug, k.ke, 'osm') as entity_slug,
    case when mm.entity_slug is not null then 'title_fuzzy' when k.ke is not null then 'keyword' else 'inferred' end as entity_reason,
    case
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'merged' then 'MERGED'
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'draft'  then 'DRAFT'
      when (coalesce(i.detail,'')||' '||coalesce(i.raw_line,'')||' '||coalesce(i.status_tag,'')) ~* 'closed' then 'CLOSED'
      else 'inferred' end as status_tag, i.created_at as created_at
  from public.build_tracker_items i
  join public.build_tracker_documents d on d.id = i.document_id and d.is_current
  left join public.v_build_item_project_match mm on mm.item_id = i.id
  cross join lateral (
    select nullif(case
      when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'sterkcalc|stabu|calculat|bouwkost|aannemer|offerte|strkbouw' then 'strkbouw'
      when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'funda|off.?market|veiling|leegstand|kadaster|acquisit|vastgoed|projectontwikkel|strkbeheer|investor' then 'strkbeheer'
      when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'youtube|channel|kanaal|video|thumbnail|short|viral|render|hook|publishing|affiliate|monetiz|content.?factory|cf2' then 'modiwe-media'
      when lower(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.repo,'')||' '||coalesce(i.route,'')) ~ 'aquier|membership|stripe|moneybird|seo|deal.?flow|dealcard|checkout|rapport|report|financing|makelaar|funnel|kennisbank|hermes|core.?os|build.?tracker|agent|api|dashboard|infra|orlando' then 'modiwe-software'
      else '' end, '') as ke
  ) k
  cross join lateral regexp_matches(coalesce(i.title,'')||' '||coalesce(i.detail,'')||' '||coalesce(i.raw_line,''), '#([0-9]+)', 'g') as rx
  order by coalesce(i.repo,'?'), rx[1], i.created_at desc
) pr
union all
-- 7) RESULTAAT / REVENUE
select 'revenue:'||b.id, 'revenue', coalesce(b.expected_revenue_model,'Omzet'), 'project:'||b.id, c.slug, b.account_status, null::int,
  b.expected_revenue_amount, b.created_at, null,
  jsonb_build_object('expected_amount',b.expected_revenue_amount,'model',b.expected_revenue_model,'currency',b.revenue_currency,
    'actual_amount',(select coalesce(sum(ar.actual_amount),0) from public.account_setups s join public.account_revenues ar on ar.account_setup_id = s.id where s.build_task_id = b.id),
    'confidence',1,'source_reason','manual')
from public.build_tracker b join public.companies c on c.id = b.company_id
where coalesce(b.expected_revenue_amount,0) > 0 or b.requires_account_setup
union all
-- 8) AQUIER MASTERPLAN — synthetische programma-node onder modiwe-software (read-only over aquier_projects)
select 'program:aquier-masterplan', 'program', 'AQUIER GLOBAL EXPANSION MASTERPLAN',
  'entity:modiwe-software', 'modiwe-software', 'confirmed', null::int,
  (select round(avg(progress_pct)) from public.aquier_projects)::numeric,
  (select min(created_at) from public.aquier_projects), null,
  jsonb_build_object('kind','masterplan','modules',(select count(*) from public.aquier_projects),
    'avg_progress',(select round(avg(progress_pct)) from public.aquier_projects),'confidence',1,'source_reason','aquier_projects')
where exists (select 1 from public.aquier_projects)
union all
-- 9) AQUIER MASTERPLAN-modules als project-nodes (parent = submodule of programma)
select 'aqproject:'||ap.id, 'project', ap.name,
  coalesce('aqproject:'||ap.parent_project_id::text, 'program:aquier-masterplan'),
  'modiwe-software', ap.status, ap.progress_pct, null::numeric, ap.start_at, ap.due_at,
  jsonb_build_object('code',ap.code,'module_ref',ap.module_ref,'owner',ap.owner_agent,'priority',ap.priority,
    'current_milestone',ap.code,'description',left(coalesce(ap.description,''),300),'confidence',1,'source_reason','aquier_projects')
from public.aquier_projects ap;

grant select on public.v_build_war_room_nodes to authenticated, anon;
