-- 156_content_factory_learning_loop.sql  (hernummerd van 154 i.v.m. collisie met
--   main's 154_cf2_north_star_additive + 155_build_tracker_documents)
-- Content Factory 2.0 — FASE 5: omzet-gestuurde learning-loop (STRUCTUUR).
-- STATUS: READY_FOR_PRODUCTION + BLOCKED_BY_SEQUENCE (Orlando) — NIET toepassen
--   tot CF2 live-state audit + end-to-end shadow-run bewezen zijn.
--
-- Additief + idempotent. Bouwt alleen de opslag voor de feedback-loop; activeert
-- niets. Geen fake/backfill-data. NIET automatisch op prod toepassen — vereist
-- expliciete Orlando-go (hard gate, zoals 153). Dev-branch-validatie eerst.

begin;

-- ── 1. video_performance_checkpoints — meetpunten 1h/6h/24h/72u ──────────────
create table if not exists public.video_performance_checkpoints (
  id                  uuid primary key default gen_random_uuid(),
  video_project_id    uuid not null references public.video_projects(id) on delete cascade,
  checkpoint          text not null check (checkpoint in ('1h','6h','24h','72h')),
  -- bronstatus: alleen echte data; ontbrekende bron → expliciete pending/blocked
  source_status       text not null default 'pending'
                      check (source_status in ('collected','pending',
                        'blocked_missing_youtube_analytics_key','tracking_gap_pending','revenue_pending')),
  -- meetvelden (NULL = nog niet gemeten; NOOIT default/0 als schatting)
  views               bigint,
  ctr                 numeric(6,3),
  avg_view_duration   numeric(8,2),
  retention           numeric(6,3),
  watchtime_min       numeric(12,2),
  likes               bigint,
  comments            bigint,
  shares              bigint,
  saves               bigint,
  subscribers_gained  bigint,
  website_clicks      bigint,
  leads               bigint,
  revenue             numeric(12,2),
  currency            text default 'EUR',
  -- attributie
  utm_campaign        text,
  utm_content         text,
  platform            text,
  content_category    text,
  product_type        text,
  captured_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (video_project_id, checkpoint)
);
create index if not exists idx_vperf_project on public.video_performance_checkpoints(video_project_id);
create index if not exists idx_vperf_status  on public.video_performance_checkpoints(source_status);

-- ── 2. video_learning_summary — OPERATIONELE learning-state per project ──────
-- RECONCILED met main's attributielaag (154_cf2_north_star_additive):
--   * GEEN content_impact_score hier — canon = view public.v_video_impact
--     (CIS = content_impact_score(revenue_score,leads_score,authority_score,viral_score)).
--   * GEEN revenue/lead/authority/viral-subscore hier — canon = de impact-subscores
--     op public.youtube_quality_scores (revenue_score/leads_score/authority_score/viral_score).
-- Deze tabel houdt UITSLUITEND de operationele learning-state + dimensie-performance.
create table if not exists public.video_learning_summary (
  video_project_id     uuid primary key references public.video_projects(id) on delete cascade,
  learning_status      text not null default 'pending'
                       check (learning_status in ('pending','awaiting_1h','awaiting_6h','awaiting_24h','awaiting_72h','completed','blocked_missing_keys')),
  -- performance per QC-dimensie (NULL = nog niet leerbaar; geen default-success).
  -- Dit zijn LEER-signalen per dimensie, GEEN impact/omzet-score (die is canoniek elders).
  hook_perf            numeric(6,2),
  thumbnail_perf       numeric(6,2),
  voice_perf           numeric(6,2),
  visual_perf          numeric(6,2),
  music_perf           numeric(6,2),
  cta_perf             numeric(6,2),
  format_perf          numeric(6,2),
  channel_perf         numeric(6,2),
  blockers             jsonb not null default '[]'::jsonb,
  updated_at           timestamptz not null default now()
);

-- ── 3. video_projects.learning_status (snelle dashboard-join) ─────────────────
alter table public.video_projects add column if not exists learning_status text not null default 'pending';

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['video_performance_checkpoints','video_learning_summary']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$ drop policy if exists %1$s_service on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_service on public.%1$s for all to service_role using (true) with check (true) $p$, t);
    execute format($p$ drop policy if exists %1$s_auth_read on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_auth_read on public.%1$s for select to authenticated using (true) $p$, t);
  end loop;
end $$;

drop trigger if exists trg_learning_summary_touch on public.video_learning_summary;
create trigger trg_learning_summary_touch before update on public.video_learning_summary
  for each row execute function public.cf2_touch_updated_at();

commit;
