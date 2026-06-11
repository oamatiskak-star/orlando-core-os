-- 181_cf2_intent_preservation.sql
-- CF2.7 Scene Intent Preservation Layer — LOGGING (Regel 6). Additief, reversibel.
-- Geen feature, geen upload/publish/engine. Alleen audit-zichtbaarheid van de query-beslissing.

-- per-scene query-beslissing in de live visual-keten
alter table public.cf2_visual_decisions
  add column if not exists query_decision jsonb;   -- {scene_intent, raw_query, proposed_query, final_query, mode, override_reason, rejection_reason, similarity_score}

-- per-scene query-beslissing in de improvement-worker
alter table public.cf2_query_feedback
  add column if not exists decision jsonb;

-- audit-view: query-beslissingen met intent-preservatie-velden
create or replace view public.v_cf2_query_decisions as
select
  d.project_id, p.title as project_title, d.scene_id, d.scene_idx,
  d.query_decision ->> 'scene_intent'      as scene_intent,
  d.query_decision ->> 'raw_query'         as raw_query,
  d.query_decision ->> 'proposed_query'    as proposed_query,
  d.query_decision ->> 'final_query'       as final_query,
  d.query_decision ->> 'mode'              as mode,
  d.query_decision ->> 'override_reason'   as override_reason,
  d.query_decision ->> 'rejection_reason'  as rejection_reason,
  (d.query_decision ->> 'similarity_score')::numeric as similarity_score,
  d.created_at
from public.cf2_visual_decisions d
join public.video_projects p on p.id = d.project_id
where d.query_decision is not null;

grant select on public.v_cf2_query_decisions to authenticated, anon;
