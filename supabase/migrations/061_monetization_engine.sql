-- 061_monetization_engine.sql
-- Phase 10 — Monetization Engine
--
-- Toevoegingen:
--   - monetization_metrics tabel voor revenue tijdseries per channel
--   - extra kolommen op affiliate_links (clicks, conversions, last_used_at)
--   - executor 'monetization_tracker'

create table if not exists public.monetization_metrics (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid references public.media_holding_channels(id) on delete cascade,
  platform        text,
  period_start    date not null,
  period_end      date not null,
  views           bigint not null default 0,
  estimated_revenue numeric(14,2) not null default 0,
  ad_revenue      numeric(14,2) not null default 0,
  cpm             numeric(10,2),
  playback_cpm    numeric(10,2),
  rpm             numeric(10,2),
  raw_payload     jsonb not null default '{}'::jsonb,
  captured_at     timestamptz not null default now(),
  unique (channel_id, platform, period_start, period_end)
);

create index if not exists idx_monetization_metrics_channel on monetization_metrics(channel_id, period_end desc);

-- Unique constraint nodig voor upsert via monetization_tracker handler
alter table public.monetization_streams
  add constraint monetization_streams_unique_cps unique (channel_id, platform, stream_type);

alter table public.affiliate_links
  add column if not exists clicks         bigint not null default 0,
  add column if not exists conversions    bigint not null default 0,
  add column if not exists last_used_at   timestamptz,
  add column if not exists short_code     text;

create index if not exists idx_affiliate_links_active on affiliate_links(active) where active = true;
create unique index if not exists idx_affiliate_links_short on affiliate_links(short_code) where short_code is not null;

alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload','renderer','trend_scanner','retention_lab','winner_extractor','audio_scanner','sponsor_engine','monetization_tracker'));
