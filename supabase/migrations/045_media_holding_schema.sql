-- 045_media_holding_schema.sql
-- MEDIA HOLDING OS — Phase 1 fundament
-- Alle 19 module-tabellen, IF NOT EXISTS, empty-state by default.
-- Vervolgsessies vullen scrapers, generators en cross-platform integraties in.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. media_holding_channels — Channel Incubator
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_channels (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  handle              text,
  niche               text not null,
  language            text not null default 'nl',
  persona_owner       text references public.agent_personas(name) on delete set null,
  status              text not null default 'idea'
                         check (status in ('idea','incubating','live','scaling','killed','paused')),
  target_views_10d    bigint not null default 280000,
  current_views_10d   bigint not null default 0,
  branding            jsonb not null default '{}'::jsonb,
  upload_strategy     jsonb not null default '{}'::jsonb,
  posting_schedule    jsonb not null default '{}'::jsonb,
  launched_at         timestamptz,
  killed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_mh_channels_status on media_holding_channels(status);
create index if not exists idx_mh_channels_niche  on media_holding_channels(niche);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. viral_opportunities — Viral Intelligence Engine output
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.viral_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  source_platform     text not null
                         check (source_platform in ('youtube','tiktok','instagram','facebook','snapchat','reddit','google_trends')),
  external_id         text not null,
  title               text not null,
  url                 text,
  thumbnail_url       text,
  channel_name        text,
  channel_external_id text,
  niche               text,
  language            text,
  duration_seconds    integer,
  published_at        timestamptz,
  views               bigint not null default 0,
  likes               bigint not null default 0,
  comments            bigint not null default 0,
  view_velocity       numeric(14,2) not null default 0,
  retention_score     integer not null default 0 check (retention_score between 0 and 100),
  saturation_score    integer not null default 50 check (saturation_score between 0 and 100),
  automation_score    integer not null default 50 check (automation_score between 0 and 100),
  virality_score      integer not null default 0 check (virality_score between 0 and 100),
  revenue_potential   numeric(14,2) not null default 0,
  raw_payload         jsonb not null default '{}'::jsonb,
  captured_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source_platform, external_id)
);
create index if not exists idx_viral_opp_score      on viral_opportunities(virality_score desc);
create index if not exists idx_viral_opp_platform   on viral_opportunities(source_platform);
create index if not exists idx_viral_opp_captured   on viral_opportunities(captured_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. media_holding_content_items — Content Factory
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_content_items (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid references public.media_holding_channels(id) on delete cascade,
  source_opportunity_id uuid references public.viral_opportunities(id) on delete set null,
  kind                text not null
                         check (kind in ('short','reel','long','loop','asmr','satisfying','cutting','marble','mini_world','ai_visual','remix','compilation')),
  title               text,
  prompt              text,
  hook                text,
  duration_seconds    integer,
  language            text not null default 'nl',
  status              text not null default 'pending'
                         check (status in ('pending','rendering','ready','published','failed','archived')),
  output_url          text,
  scheduled_at        timestamptz,
  rendered_at         timestamptz,
  published_at        timestamptz,
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_mh_content_status   on media_holding_content_items(status);
create index if not exists idx_mh_content_channel  on media_holding_content_items(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. media_holding_uploads — Upload Engine log
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_uploads (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.media_holding_content_items(id) on delete cascade,
  platform            text not null
                         check (platform in ('youtube','tiktok','instagram','facebook','snapchat')),
  platform_video_id   text,
  status              text not null default 'queued'
                         check (status in ('queued','uploading','processing','verified_live','failed')),
  uploaded_at         timestamptz,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_mh_uploads_status on media_holding_uploads(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. media_holding_metrics — Analytics Engine snapshots
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_metrics (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid references public.media_holding_content_items(id) on delete cascade,
  upload_id           uuid references public.media_holding_uploads(id) on delete cascade,
  platform            text not null,
  snapshot_at         timestamptz not null default now(),
  views               bigint not null default 0,
  likes               bigint not null default 0,
  comments            bigint not null default 0,
  shares              bigint not null default 0,
  saves               bigint not null default 0,
  retention_pct       numeric(5,2),
  ctr_pct             numeric(5,2),
  revenue             numeric(14,2)
);
create index if not exists idx_mh_metrics_content on media_holding_metrics(content_item_id, snapshot_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. algorithm_gravity_events — breakout detection
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.algorithm_gravity_events (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid references public.media_holding_content_items(id) on delete cascade,
  upload_id           uuid references public.media_holding_uploads(id) on delete cascade,
  event_type          text not null
                         check (event_type in ('breakout','momentum','replay_spike','session_extension','algo_boost','decay')),
  magnitude           numeric(10,2) not null default 0,
  notes               text,
  detected_at         timestamptz not null default now()
);
create index if not exists idx_algo_gravity_type on algorithm_gravity_events(event_type, detected_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. retention_lab_samples — retention curves
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.retention_lab_samples (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid references public.media_holding_content_items(id) on delete cascade,
  second_index        integer not null,
  retention_pct       numeric(5,2) not null,
  drop_off_marker     boolean not null default false,
  collected_at        timestamptz not null default now()
);
create index if not exists idx_retention_lab_content on retention_lab_samples(content_item_id, second_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. hook_library
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hook_library (
  id                  uuid primary key default gen_random_uuid(),
  hook_text           text,
  hook_visual_ref     text,
  hook_audio_ref      text,
  hook_kind           text check (hook_kind in ('text','visual','audio','combo')),
  pacing              text,
  replay_friendly     boolean not null default false,
  success_score       integer not null default 0 check (success_score between 0 and 100),
  source_opportunity_id uuid references public.viral_opportunities(id) on delete set null,
  source_content_id   uuid references public.media_holding_content_items(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_hook_lib_score on hook_library(success_score desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. audio_library
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audio_library (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null,
  external_audio_id   text not null,
  name                text,
  artist              text,
  trend_velocity      numeric(10,2) not null default 0,
  use_count           bigint not null default 0,
  captured_at         timestamptz not null default now(),
  unique (platform, external_audio_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. trend_scanner_signals
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trend_scanner_signals (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null
                         check (source in ('google_trends','reddit','news','x','tiktok_discover','youtube_trending')),
  keyword             text not null,
  momentum            numeric(10,2) not null default 0,
  region              text,
  raw_payload         jsonb not null default '{}'::jsonb,
  captured_at         timestamptz not null default now()
);
create index if not exists idx_trend_signals_keyword on trend_scanner_signals(keyword, captured_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. cross_platform_routes
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cross_platform_routes (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid not null references public.media_holding_channels(id) on delete cascade,
  platforms           text[] not null default '{}',
  account_handles     jsonb not null default '{}'::jsonb,
  auth_state          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. sponsor_engine_targets
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sponsor_engine_targets (
  id                  uuid primary key default gen_random_uuid(),
  brand_name          text not null,
  website             text,
  industry            text,
  fit_score           integer not null default 0 check (fit_score between 0 and 100),
  last_outreach_at    timestamptz,
  status              text not null default 'prospect'
                         check (status in ('prospect','researched','contacted','negotiating','won','lost')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. affiliate_links
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.affiliate_links (
  id                  uuid primary key default gen_random_uuid(),
  affiliate_id        text not null,
  network             text,
  product             text not null,
  url                 text not null,
  commission_pct      numeric(5,2),
  channel_id          uuid references public.media_holding_channels(id) on delete set null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. monetization_streams
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.monetization_streams (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid not null references public.media_holding_channels(id) on delete cascade,
  platform            text,
  stream_type         text not null
                         check (stream_type in ('adsense','sponsor','affiliate','product','membership','tips')),
  monthly_revenue     numeric(14,2) not null default 0,
  active              boolean not null default true,
  updated_at          timestamptz not null default now()
);
create index if not exists idx_monetization_channel on monetization_streams(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. media_holding_workers — worker registry
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_workers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  kind                text not null
                         check (kind in ('scanner','renderer','uploader','analyzer','gravity','retention','distributor','outreach','language')),
  status              text not null default 'idle'
                         check (status in ('idle','running','paused','offline','error')),
  last_seen           timestamptz,
  queue_depth         integer not null default 0,
  last_error          text,
  config              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. winner_extraction_jobs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.winner_extraction_jobs (
  id                  uuid primary key default gen_random_uuid(),
  source_content_id   uuid not null references public.media_holding_content_items(id) on delete cascade,
  variant_kind        text not null
                         check (variant_kind in ('remix','loop','compilation','slowed','enhanced','multilingual','stitched','extended','horizontal','reaction_bait')),
  status              text not null default 'pending'
                         check (status in ('pending','rendering','ready','published','failed')),
  output_content_id   uuid references public.media_holding_content_items(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_winner_jobs_source on winner_extraction_jobs(source_content_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. media_holding_archives
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.media_holding_archives (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.media_holding_content_items(id) on delete cascade,
  reason              text,
  archived_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. language_expansion_targets
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.language_expansion_targets (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.media_holding_content_items(id) on delete cascade,
  target_lang         text not null,
  status              text not null default 'pending'
                         check (status in ('pending','translating','rendering','ready','published','failed')),
  output_content_id   uuid references public.media_holding_content_items(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (content_item_id, target_lang)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. youtube_quality_scores — officieel gemigreerd (eerder runtime created)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.youtube_quality_scores (
  id              uuid primary key default gen_random_uuid(),
  queue_id        uuid references public.youtube_upload_queue(id) on delete cascade,
  channel_id      uuid references public.youtube_channels(id) on delete cascade,
  title_score     int,
  hook_score      int,
  thumbnail_score int,
  total_score     int,
  verdict         text check (verdict in ('publish','improve','reject')),
  feedback        jsonb,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed OSIL: deze opdracht zelf als trackable kans
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.osil_opportunities (
  source, category, title, description, potential_value, probability_pct,
  time_horizon, status, ai_score
)
select
  'opdracht',
  'youtube',
  'Global AI Media Holding — Phase 1 fundament',
  E'Bouw autonoom AI Media Holding OS binnen Orlando Core OS. Detecteert viral kansen, incubateert kanalen, produceert content, distribueert cross-platform, scaleert winnaars en kapt zwakke niches. 13 phases / 19 modules. Phase 1 = schema + viral intelligence engine + OSIL bridge.\n\nFases klaar in deze sessie: schema (045), bridge trigger (046), persona seed (047), API endpoints, dashboard skeleton, YouTube Data API v3 scanner.',
  0,
  90,
  'kwartaal',
  'actief',
  95
where not exists (
  select 1 from public.osil_opportunities
   where category = 'youtube' and title = 'Global AI Media Holding — Phase 1 fundament'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Viral Intelligence Engine worker registry
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_workers (name, kind, status, config)
values
  ('viral-scanner-youtube',   'scanner',  'idle', jsonb_build_object('region_codes', array['NL','US','GB'], 'max_per_region', 50)),
  ('viral-scanner-tiktok',    'scanner',  'offline', '{}'::jsonb),
  ('viral-scanner-reddit',    'scanner',  'offline', '{}'::jsonb),
  ('viral-scanner-trends',    'scanner',  'offline', '{}'::jsonb),
  ('content-renderer-default','renderer', 'offline', '{}'::jsonb),
  ('upload-engine-youtube',   'uploader', 'offline', '{}'::jsonb),
  ('upload-engine-tiktok',    'uploader', 'offline', '{}'::jsonb),
  ('analytics-engine',        'analyzer', 'offline', '{}'::jsonb),
  ('gravity-detector',        'gravity',  'offline', '{}'::jsonb),
  ('retention-lab',           'retention','offline', '{}'::jsonb),
  ('cross-platform-router',   'distributor','offline', '{}'::jsonb),
  ('sponsor-outreach',        'outreach', 'offline', '{}'::jsonb),
  ('language-expander',       'language', 'offline', '{}'::jsonb)
on conflict (name) do nothing;
