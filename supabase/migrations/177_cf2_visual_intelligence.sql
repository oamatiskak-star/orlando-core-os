-- 177_cf2_visual_intelligence.sql
-- CF2 Visual Intelligence Engine — per-scene multi-source ranking met uitlegbaarheid.
-- Additief, reversibel. Geen data-mutatie van bestaande rijen. Geen engine-activatie.
--
-- Doel: voor elke scene vastleggen WAAROM een visual gekozen is, welke alternatieven
-- zijn afgewezen (incl. reden + score), met welke confidence, en — bij zwakke dekking —
-- een low_visual_confidence-vlag + verbeteradvies. Geen generieke fake-fallback.

-- 1) Snel-surfacebare confidence op scene-niveau (voor Producer Graph) ----------------
alter table public.video_scenes
  add column if not exists visual_confidence numeric(5,2),
  add column if not exists low_visual_confidence boolean not null default false,
  add column if not exists visual_advice text;

-- 2) Volledige beslis-audittrail per scene -------------------------------------------
create table if not exists public.cf2_visual_decisions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.video_projects(id) on delete cascade,
  scene_id        uuid references public.video_scenes(id) on delete set null,
  scene_idx       integer,
  query_used      text,                         -- (vertaalde) zoekterm waarop gezocht is
  chosen_provider text,                         -- pexels | pixabay | youtube | archive
  chosen_kind     text,                         -- video | photo
  chosen_url      text,
  chosen_asset_id uuid,                          -- visual_assets.id (na download), nullable
  final_score     numeric(5,2),                  -- score van de gekozen bron
  runner_up_score numeric(5,2),                  -- 2e-beste (voor margin/confidence)
  confidence      numeric(5,2),                  -- 0..100, afgeleid (score + margin + bron)
  low_confidence  boolean not null default false,
  advice          text,                          -- concreet verbeteradvies bij low confidence
  candidates      jsonb not null default '[]'::jsonb,  -- [{provider,kind,url,res,scores{...},final,chosen,reject_reason}]
  sources_tried   text[] not null default '{}',  -- welke bronnen geraadpleegd zijn
  created_at      timestamptz not null default now()
);

create index if not exists cf2_visual_decisions_project_idx on public.cf2_visual_decisions(project_id);
create index if not exists cf2_visual_decisions_scene_idx   on public.cf2_visual_decisions(scene_id);
create index if not exists cf2_visual_decisions_lowconf_idx on public.cf2_visual_decisions(low_confidence) where low_confidence;

-- 3) Per-scene view voor de Producer Graph (scene → beslissing → project) -------------
create or replace view public.v_cf2_scene_visual as
select
  d.project_id,
  p.title          as project_title,
  d.scene_id,
  d.scene_idx,
  d.query_used,
  d.chosen_provider,
  d.chosen_kind,
  d.final_score,
  d.confidence,
  d.low_confidence,
  d.advice,
  jsonb_array_length(d.candidates) as candidates_evaluated,
  d.candidates,
  d.sources_tried,
  d.created_at
from public.cf2_visual_decisions d
join public.video_projects p on p.id = d.project_id;

-- 4) Per-project rollup (dekking + confidence) ---------------------------------------
create or replace view public.v_cf2_visual_confidence as
select
  p.id   as project_id,
  p.title,
  p.status,
  (select count(*) from public.video_scenes s where s.project_id = p.id)                                  as scenes_total,
  (select count(*) from public.video_scenes s where s.project_id = p.id and s.selected_asset_id is not null) as scenes_with_visual,
  (select count(*) from public.video_scenes s where s.project_id = p.id and s.low_visual_confidence)        as scenes_low_confidence,
  (select round(avg(s.visual_confidence),1) from public.video_scenes s where s.project_id = p.id and s.visual_confidence is not null) as avg_confidence,
  (select count(*) from public.cf2_visual_decisions d where d.project_id = p.id)                            as decisions_logged
from public.video_projects p;

-- 5) RLS — read-only dashboard, service_role schrijft ---------------------------------
alter table public.cf2_visual_decisions enable row level security;

drop policy if exists cf2_visual_decisions_read on public.cf2_visual_decisions;
create policy cf2_visual_decisions_read on public.cf2_visual_decisions
  for select to authenticated, anon using (true);

drop policy if exists cf2_visual_decisions_write on public.cf2_visual_decisions;
create policy cf2_visual_decisions_write on public.cf2_visual_decisions
  for all to service_role using (true) with check (true);

grant select on public.cf2_visual_decisions to authenticated, anon;
grant select on public.v_cf2_scene_visual to authenticated, anon;
grant select on public.v_cf2_visual_confidence to authenticated, anon;
