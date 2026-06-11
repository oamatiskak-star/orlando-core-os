-- 180_cf2_query_intelligence_views.sql
-- CF2.1 — views voor Producer Graph (FASE 6) + Visual Learning Dashboard (FASE 7).
-- Read-only. Geen data-mutatie.

-- FASE 6 — Query Intelligence per scene (origineel vs verbeterd + mismatch + winst) ---
create or replace view public.v_cf2_query_intelligence as
select
  rc.id, rc.scene_id, rc.project_id, p.title as project_title, s.idx as scene_idx, rc.niche,
  rc.original_query, rc.improved_query, rc.intent, rc.improved_keywords,
  rc.current_score, rc.predicted_score,
  round(coalesce(rc.predicted_score,0) - coalesce(rc.current_score,0), 1) as predicted_gain,
  rc.status,
  f.mismatch_type, f.mismatch_detail as mismatch_reason,
  rc.created_at
from public.cf2_resource_candidates rc
join public.video_projects p on p.id = rc.project_id
left join public.video_scenes s on s.id = rc.scene_id
left join public.cf2_visual_failure_patterns f on f.scene_id = rc.scene_id;

-- FASE 6 — Low Relevance Queue (scenes onder 78, met advies) -------------------------
create or replace view public.v_cf2_low_relevance as
select
  d.project_id, p.title as project_title, d.scene_id, d.scene_idx, d.query_used,
  d.chosen_provider, d.chosen_kind, va.topic_relevance, d.confidence as visual_confidence,
  s.visual_advice, s.needs_query_improvement
from public.cf2_visual_decisions d
join public.video_projects p on p.id = d.project_id
left join public.video_scenes s on s.id = d.scene_id
left join public.visual_assets va on va.id = d.chosen_asset_id
where va.topic_relevance is not null and va.topic_relevance < 78;

-- FASE 6 — Most Improved Queries (grootste voorspelde winst) --------------------------
create or replace view public.v_cf2_most_improved as
select id, project_id, project_title, scene_idx, niche, original_query, improved_query,
       current_score, predicted_score, predicted_gain, status
from public.v_cf2_query_intelligence
where predicted_gain > 0
order by predicted_gain desc;

-- FASE 7 — Visual Learning Dashboard: hoofdmetrics ----------------------------------
create or replace view public.v_cf2_visual_learning_metrics as
select
  count(*)                                                                          as scenes_scored,
  round(avg(va.topic_relevance), 1)                                                 as avg_topic_relevance,
  round(avg(d.confidence), 1)                                                        as avg_visual_confidence,
  round(100.0 * count(*) filter (where va.topic_relevance < 78) / nullif(count(*),0), 1) as mismatch_pct,
  round(100.0 * count(*) filter (where va.topic_relevance < 40) / nullif(count(*),0), 1) as hard_mismatch_pct,
  (select round(avg(predicted_score - current_score), 1) from public.cf2_resource_candidates
     where predicted_score is not null and current_score is not null)               as avg_query_improvement_gain,
  (select round(100.0 * count(*) filter (where status='completed') / nullif(count(*),0), 1)
     from public.cf2_resource_candidates)                                           as resource_success_pct,
  (select count(*) from public.cf2_resource_candidates where status='pending')       as resource_pending,
  (select count(*) from public.cf2_query_learning_patterns)                          as learned_niches
from public.cf2_visual_decisions d
join public.visual_assets va on va.id = d.chosen_asset_id
where va.topic_relevance is not null;

-- FASE 7 — per niche (en uitbreidbaar per hook) -------------------------------------
create or replace view public.v_cf2_visual_learning_by_niche as
select
  p.niche,
  count(*)                                                                          as scenes_scored,
  round(avg(va.topic_relevance), 1)                                                 as avg_topic_relevance,
  round(avg(d.confidence), 1)                                                        as avg_visual_confidence,
  round(100.0 * count(*) filter (where va.topic_relevance < 78) / nullif(count(*),0), 1) as mismatch_pct,
  round(100.0 * count(*) filter (where va.topic_relevance < 40) / nullif(count(*),0), 1) as hard_mismatch_pct
from public.cf2_visual_decisions d
join public.visual_assets va on va.id = d.chosen_asset_id
join public.video_projects p on p.id = d.project_id
where va.topic_relevance is not null
group by p.niche;

grant select on public.v_cf2_query_intelligence to authenticated, anon;
grant select on public.v_cf2_low_relevance to authenticated, anon;
grant select on public.v_cf2_most_improved to authenticated, anon;
grant select on public.v_cf2_visual_learning_metrics to authenticated, anon;
grant select on public.v_cf2_visual_learning_by_niche to authenticated, anon;
