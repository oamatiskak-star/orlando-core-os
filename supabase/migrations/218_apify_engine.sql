-- ============================================================
-- 218 — Apify Engine
-- 5 categorieën: CF2 Intelligence, Vastgoed, Hermes MCP,
--                Aquier Leads, CF2 Cross-Platform Distributie
-- ============================================================

-- ─── CAT 1: CF2 Intelligence ─────────────────────────────────
create table if not exists public.cf2_topic_feed (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  actor_run_id    text,
  title           text not null,
  url             text,
  description     text,
  published_at    timestamptz,
  relevance_score float default 0,
  used_at         timestamptz,
  created_at      timestamptz default now()
);
create index if not exists cf2_topic_feed_source_idx  on public.cf2_topic_feed(source, created_at desc);
create index if not exists cf2_topic_feed_unused_idx  on public.cf2_topic_feed(used_at) where used_at is null;
comment on table public.cf2_topic_feed is
  'Trending topics uit RSS/YouTube/AI-hype-tracker voor CF2-pipeline. used_at=null = beschikbaar als script-seed.';

create table if not exists public.cf2_competitor_transcripts (
  id              uuid primary key default gen_random_uuid(),
  channel_url     text not null,
  video_url       text not null,
  title           text,
  duration_secs   int,
  transcript      text,
  word_count      int,
  actor_run_id    text,
  scraped_at      timestamptz default now(),
  unique (video_url)
);
comment on table public.cf2_competitor_transcripts is
  'Transcripts van competitor YouTube-video''s voor script-analyse en CQI-training.';

create table if not exists public.cf2_video_heatmaps (
  id              uuid primary key default gen_random_uuid(),
  video_url       text not null,
  youtube_id      text,
  heatmap_data    jsonb,
  peak_moment_secs   int,
  drop_off_secs      int,
  actor_run_id    text,
  scraped_at      timestamptz default now(),
  unique (video_url)
);
comment on table public.cf2_video_heatmaps is
  'Viewer-engagement heatmap per 2.48s segment. Voedt de measurement loop met "waar kijkers afhaken".';

-- ─── CAT 2: Vastgoed Apify runs ──────────────────────────────
create table if not exists public.apify_vastgoed_runs (
  id              uuid primary key default gen_random_uuid(),
  actor_key       text not null,
  actor_id        text not null,
  run_id          text unique,
  status          text default 'pending' check (status in ('pending','running','done','failed')),
  items_fetched   int default 0,
  started_at      timestamptz default now(),
  finished_at     timestamptz,
  error           text
);

-- property_listings in vastgoed_core (aanmaken als nog niet bestaat)
create table if not exists vastgoed_core.property_listings (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null,
  source_name     text not null,
  country         char(2),
  city            text,
  address         text,
  price           numeric,
  price_currency  char(3) default 'EUR',
  area_m2         numeric,
  property_type   text,
  url             text,
  raw             jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (source_name, external_id)
);
create index if not exists property_listings_country_idx on vastgoed_core.property_listings(country, created_at desc);

-- ─── CAT 3: Hermes MCP Registry ──────────────────────────────
create table if not exists public.hermes_mcp_registry (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  apify_url       text,
  actor_path      text unique,
  category        text default 'mcp',
  priority        text default 'normal' check (priority in ('high','normal','low')),
  enabled         boolean default true,
  last_used_at    timestamptz,
  created_at      timestamptz default now()
);
comment on table public.hermes_mcp_registry is
  'Catalogus van Apify-gehoste MCP servers bruikbaar voor Hermes/Claude-integratie.';

-- ─── CAT 4: Aquier Leads ─────────────────────────────────────
create table if not exists public.aquier_apify_leads (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  actor_run_id    text,
  company         text,
  name            text,
  email           text,
  linkedin_url    text,
  website         text,
  description     text,
  raw             jsonb,
  status          text default 'new' check (status in ('new','contacted','converted','rejected')),
  created_at      timestamptz default now()
);
create index if not exists aquier_apify_leads_status_idx on public.aquier_apify_leads(status, created_at desc);
create index if not exists aquier_apify_leads_email_idx  on public.aquier_apify_leads(email) where email is not null;

-- ─── CAT 5: CF2 Cross-Platform Posts ─────────────────────────
create table if not exists public.cf2_cross_platform_posts (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid,
  youtube_url     text,
  platform        text not null check (platform in ('linkedin','twitter','instagram','newsletter')),
  content         text,
  actor_run_id    text,
  status          text default 'draft' check (status in ('draft','scheduled','published')),
  scheduled_at    timestamptz,
  published_at    timestamptz,
  created_at      timestamptz default now()
);
create index if not exists cf2_posts_platform_status_idx on public.cf2_cross_platform_posts(platform, status);

-- ─── ENGINE PLANNER REGISTRATIE ──────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values
  ('apify:cf2-intelligence',  'apify', 'CF2 Topic Intelligence (RSS + YouTube)',    'youtube',  true),
  ('apify:vastgoed-scrapers', 'apify', 'Vastgoed Apify (DE/AE/SG/US/LATAM)',        'intl_eu',  true),
  ('apify:hermes-mcp',        'apify', 'Hermes MCP Registry (seed)',                'acq_ai',   true),
  ('apify:aquier-leads',      'apify', 'Aquier Lead Generation (B2B + YC)',         'acq_ai',   true),
  ('apify:cf2-distribution',  'apify', 'CF2 Cross-Platform Distributie (LinkedIn)', 'youtube',  true)
on conflict (engine_key) do update
  set label     = excluded.label,
      block_key = excluded.block_key,
      enabled   = excluded.enabled;
