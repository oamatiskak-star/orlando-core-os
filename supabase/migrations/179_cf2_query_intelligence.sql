-- 179_cf2_query_intelligence.sql
-- CF2.1 Query Intelligence + Self-Healing Visual Pipeline — DATAMODEL.
-- Additief, reversibel. Geen content, geen publicatie, geen engine-activatie.
--
-- Keten: Visual Selection → Vision Audit → Query Intelligence → Query Improvement →
--        Re-Source (gated) → Vision Audit → Approved.

-- FASE 4 — scene-vlag: vraagt om query-verbetering (topic_relevance < 78)
alter table public.video_scenes
  add column if not exists needs_query_improvement boolean not null default false;

-- FASE 1 — root-cause: afgekeurde scenes + mismatch-classificatie -----------------
create table if not exists public.cf2_visual_failure_patterns (
  id              uuid primary key default gen_random_uuid(),
  scene_id        uuid references public.video_scenes(id) on delete set null,
  project_id      uuid references public.video_projects(id) on delete cascade,
  niche           text,
  hook_category   text,
  title           text,
  script_text     text,
  current_query   text,
  chosen_provider text,
  chosen_url      text,
  topic_relevance numeric(5,2),
  visual_confidence numeric(5,2),
  -- 9 mismatch-typen (FASE 1)
  mismatch_type   text check (mismatch_type in (
                    'query_too_generic','wrong_context','wrong_niche','wrong_emotion',
                    'wrong_intent','wrong_visual_style','wrong_actor','wrong_location','wrong_objects')),
  mismatch_detail text,
  created_at      timestamptz not null default now()
);
create index if not exists cf2_failure_project_idx on public.cf2_visual_failure_patterns(project_id);
create index if not exists cf2_failure_type_idx    on public.cf2_visual_failure_patterns(mismatch_type);
create index if not exists cf2_failure_niche_idx   on public.cf2_visual_failure_patterns(niche);

-- FASE 3 — query feedback-database (leren van eerdere fouten) ---------------------
create table if not exists public.cf2_query_feedback (
  id                uuid primary key default gen_random_uuid(),
  scene_id          uuid references public.video_scenes(id) on delete set null,
  project_id        uuid references public.video_projects(id) on delete cascade,
  niche             text,
  hook_category     text,
  old_query         text,
  generated_query   text,
  generated_variants jsonb not null default '[]'::jsonb,   -- alle gegenereerde varianten + score
  visual_confidence numeric(5,2),
  topic_relevance   numeric(5,2),
  audit_score       numeric(5,2),                          -- vision-audit score (CLI-R)
  approved          boolean,
  failure_reason    text,
  created_at        timestamptz not null default now()
);
create index if not exists cf2_qfeedback_niche_idx on public.cf2_query_feedback(niche);
create index if not exists cf2_qfeedback_scene_idx on public.cf2_query_feedback(scene_id);

-- FASE 5 — re-source candidate-queue (GATED; geen auto-resource) ------------------
create table if not exists public.cf2_resource_candidates (
  id               uuid primary key default gen_random_uuid(),
  scene_id         uuid references public.video_scenes(id) on delete set null,
  project_id       uuid references public.video_projects(id) on delete cascade,
  niche            text,
  original_query   text,
  improved_query   text,
  improved_keywords text[] not null default '{}',
  intent           text,
  current_score    numeric(5,2),
  predicted_score  numeric(5,2),
  status           text not null default 'pending'
                     check (status in ('pending','review','approved','rejected','completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists cf2_rescand_status_idx on public.cf2_resource_candidates(status, predicted_score desc);
create index if not exists cf2_rescand_scene_idx  on public.cf2_resource_candidates(scene_id);

-- FASE 8 — Hermes visual-learning patterns (niche → goede/slechte query-stijl) ----
create table if not exists public.cf2_query_learning_patterns (
  id                  uuid primary key default gen_random_uuid(),
  niche               text not null,
  hook_category       text,
  good_query_terms    text[] not null default '{}',   -- termen die structureel hoog scoren
  bad_query_terms     text[] not null default '{}',   -- termen die structureel laag scoren
  evidence_count      integer not null default 0,
  avg_topic_good      numeric(5,2),
  avg_topic_bad       numeric(5,2),
  lesson              text,                            -- mensleesbare les voor query-generatie
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (niche, hook_category)
);
create index if not exists cf2_learning_niche_idx on public.cf2_query_learning_patterns(niche);

-- RLS — read-only dashboard, service_role schrijft -------------------------------
do $$
declare t text;
begin
  foreach t in array array['cf2_visual_failure_patterns','cf2_query_feedback','cf2_resource_candidates','cf2_query_learning_patterns']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated, anon using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to service_role using (true) with check (true)', t, t);
    execute format('grant select on public.%I to authenticated, anon', t);
  end loop;
end $$;
