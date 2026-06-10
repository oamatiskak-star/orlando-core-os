-- 171_cf2_producer_review.sql
-- CF2 Fase 5A + 5C — Review Intelligence (volledige herleidbaarheid per creative) +
-- Producer pipeline (status/timestamps per stap). ADDITIEF + idempotent.
-- HARDE GATE: niet auto-toepassen. GEEN worker/engine aangezet — alleen schema gereed.
-- Iedere geproduceerde asset is volledig herleidbaar; "waarom gemaakt" = echte brondata
-- (geen LLM-gok), afgeleid uit de provenance-kolommen.

-- ── Producer-job (1 rij per geproduceerde creative) + provenance ─────────────────
create table if not exists public.cf2_jobs (
  id                       uuid primary key default gen_random_uuid(),
  -- provenance / Review Intelligence (5A) — uitsluitend echte bronverwijzingen
  source_winner_video_id   uuid,                                   -- youtube_videos.id (bron-winner)
  source_hook_id           uuid,                                   -- youtube_videos.id (bron-hook)
  bron_hook_category       text,
  bron_thumbnail_ref       text,                                   -- youtube_video_id/thumbnail_url van bron
  bron_niche               text,
  bron_horizon_id          uuid references public.content_horizon(id) on delete set null,
  bron_recommendation_id   uuid,                                   -- executive_recommendations.id
  bron_strategy_channel_id uuid references public.media_holding_channels(id) on delete set null,
  bron_channel_id          uuid,
  bron_campaign            text,
  variation_request_id     uuid references public.variation_requests(id) on delete set null,
  reason                   text,                                   -- afgeleide "waarom gemaakt"
  output_content_id        uuid,                                   -- resultaat (media_holding_content_items / youtube)
  status                   text not null default 'planned'
    check (status in ('planned','producing','produced','uploaded','published','failed','cancelled')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists cf2_jobs_status_idx on public.cf2_jobs (status, created_at desc);
create index if not exists cf2_jobs_winner_idx on public.cf2_jobs (source_winner_video_id);

-- ── Per-stap audittrail (5C) ─────────────────────────────────────────────────────
create table if not exists public.cf2_job_steps (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.cf2_jobs(id) on delete cascade,
  step           text not null
    check (step in ('viral','hook','winner','horizon','creative','thumbnail','video','upload','attribution')),
  status         text not null default 'pending'
    check (status in ('pending','running','done','failed','skipped')),
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  failed_at      timestamptz,
  failure_reason text,
  meta           jsonb not null default '{}'::jsonb,
  unique (job_id, step)
);
create index if not exists cf2_job_steps_job_idx on public.cf2_job_steps (job_id);

-- ── Review-view: per creative de volledige bron + afgeleide verklaring ───────────
create or replace view public.v_cf2_review as
select
  j.id, j.status, j.created_at, j.output_content_id,
  j.source_winner_video_id, w.title as bron_winner_title, w.youtube_video_id as bron_winner_ytid,
  j.bron_hook_category, j.bron_thumbnail_ref, j.bron_niche,
  j.bron_horizon_id, ch.title_draft as bron_horizon_title,
  j.bron_recommendation_id, j.bron_strategy_channel_id, j.bron_channel_id, j.bron_campaign,
  -- WAAROM IS DEZE CREATIVE GEMAAKT? — uitsluitend echte brondata
  coalesce(j.reason, concat_ws('  ·  ',
    case when w.title is not null then 'Bron-winner: ' || left(w.title, 60) end,
    case when j.bron_hook_category is not null then 'hook: ' || j.bron_hook_category end,
    case when j.bron_niche is not null then 'niche: ' || j.bron_niche end,
    case when ch.title_draft is not null then 'horizon: ' || left(ch.title_draft, 40) end,
    case when j.bron_recommendation_id is not null then 'Hermes-aanbeveling' end
  )) as why_made,
  (select jsonb_agg(jsonb_build_object('step', s.step, 'status', s.status,
     'started_at', s.started_at, 'completed_at', s.completed_at, 'failed_at', s.failed_at,
     'failure_reason', s.failure_reason) order by
       array_position(array['viral','hook','winner','horizon','creative','thumbnail','video','upload','attribution'], s.step))
   from public.cf2_job_steps s where s.job_id = j.id) as steps
from public.cf2_jobs j
left join public.youtube_videos w on w.id = j.source_winner_video_id
left join public.content_horizon ch on ch.id = j.bron_horizon_id
order by j.created_at desc;

grant select, insert, update on public.cf2_jobs, public.cf2_job_steps to authenticated;
grant select on public.v_cf2_review to authenticated, anon;
