-- 154_content_factory_learning_loop.sql
-- Content Factory 2.0 — FASE 5: omzet-gestuurde learning-loop (STRUCTUUR).
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

-- ── 2. video_learning_summary — geleerde subscores per project ────────────────
create table if not exists public.video_learning_summary (
  video_project_id     uuid primary key references public.video_projects(id) on delete cascade,
  learning_status      text not null default 'pending'
                       check (learning_status in ('pending','awaiting_1h','awaiting_6h','awaiting_24h','awaiting_72h','completed','blocked_missing_keys')),
  -- Content Impact Score: ALLEEN uit echte data; NULL zolang onvoldoende meetpunten
  content_impact_score numeric(6,2),
  -- performance per dimensie (NULL = nog niet leerbaar; geen default-success)
  hook_perf            numeric(6,2),
  thumbnail_perf       numeric(6,2),
  voice_perf           numeric(6,2),
  visual_perf          numeric(6,2),
  music_perf           numeric(6,2),
  cta_perf             numeric(6,2),
  format_perf          numeric(6,2),
  channel_perf         numeric(6,2),
  -- omzet/lead/authority/viral-subscores (echte attributie)
  revenue_subscore     numeric(12,2),
  lead_subscore        integer,
  authority_subscore   numeric(6,2),
  viral_subscore       numeric(6,2),
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
