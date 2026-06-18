-- ============================================================
-- 219 — ScrapeGraph Engine
-- LLM-gestuurde webscraper via ScrapeGraphAI + Claude.
-- Logt elk scrape-verzoek + resultaat voor auditing en replay.
-- ============================================================

create table if not exists public.scrapegraph_jobs (
  id            uuid primary key default gen_random_uuid(),
  job_type      text not null check (job_type in ('scrape','search','markdownify','batch')),
  source        text not null,           -- URL of zoekopdracht
  prompt        text,
  model         text,
  result        jsonb,
  status        text default 'pending' check (status in ('pending','running','done','failed')),
  error         text,
  caller        text,                    -- welke worker heeft dit aangevraagd
  duration_ms   int,
  created_at    timestamptz default now(),
  finished_at   timestamptz
);

create index if not exists scrapegraph_jobs_status_idx  on public.scrapegraph_jobs(status, created_at desc);
create index if not exists scrapegraph_jobs_caller_idx  on public.scrapegraph_jobs(caller, created_at desc);
create index if not exists scrapegraph_jobs_type_idx    on public.scrapegraph_jobs(job_type, created_at desc);

comment on table public.scrapegraph_jobs is
  'Audit-log van ScrapeGraph Engine-verzoeken (SmartScraper/Search/Markdownify/Batch via Claude).';

-- Engine Planner registratie
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values
  ('scrapegraph:smart',   'scrapegraph', 'ScrapeGraph SmartScraper (on-demand)',   'acq_ai', true),
  ('scrapegraph:search',  'scrapegraph', 'ScrapeGraph SearchGraph (on-demand)',    'acq_ai', true)
on conflict (engine_key) do update
  set label     = excluded.label,
      block_key = excluded.block_key,
      enabled   = excluded.enabled;
