-- Migration 074: Competitor Surveillance
-- Schema voor het tracken van concurrerende kanalen, hun uploads en
-- gedetecteerde viral spikes / format-shifts. MVP zonder scraper-worker:
-- records worden handmatig of via toekomstige scanner-worker gevuld.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. competitor_channels — kanalen die we volgen
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_channels (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null
                         check (platform in ('youtube','tiktok','instagram','facebook','snapchat')),
  external_id         text not null,
  handle              text,
  name                text not null,
  niche               text,
  language            text,
  url                 text,
  thumbnail_url       text,
  subscriber_count    bigint not null default 0,
  video_count         integer not null default 0,
  total_view_count    bigint not null default 0,
  watched_by_channel  uuid references public.media_holding_channels(id) on delete set null,
  notes               text,
  active              boolean not null default true,
  last_scanned_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists idx_competitor_channels_active   on public.competitor_channels (active);
create index if not exists idx_competitor_channels_niche    on public.competitor_channels (niche);
create index if not exists idx_competitor_channels_watched  on public.competitor_channels (watched_by_channel);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. competitor_videos — uploads per competitor (basis voor freq + spikes)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_videos (
  id                  uuid primary key default gen_random_uuid(),
  competitor_id       uuid not null references public.competitor_channels(id) on delete cascade,
  platform_video_id   text not null,
  title               text,
  url                 text,
  thumbnail_url       text,
  format              text
                         check (format in ('short','reel','long','loop','asmr','satisfying','remix','compilation','unknown')),
  duration_seconds    integer,
  published_at        timestamptz,
  views               bigint not null default 0,
  likes               bigint not null default 0,
  comments            bigint not null default 0,
  view_velocity       numeric(14,2) not null default 0,
  is_viral_spike      boolean not null default false,
  captured_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (competitor_id, platform_video_id)
);
create index if not exists idx_competitor_videos_competitor on public.competitor_videos (competitor_id, published_at desc);
create index if not exists idx_competitor_videos_spike      on public.competitor_videos (is_viral_spike) where is_viral_spike;
create index if not exists idx_competitor_videos_velocity   on public.competitor_videos (view_velocity desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. competitor_signals — uitkomsten van surveillance (spikes, format-shifts)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_signals (
  id                  uuid primary key default gen_random_uuid(),
  competitor_id       uuid not null references public.competitor_channels(id) on delete cascade,
  video_id            uuid references public.competitor_videos(id) on delete set null,
  signal_type         text not null
                         check (signal_type in ('viral_spike','format_shift','upload_burst','dormant','niche_pivot','sub_surge')),
  magnitude           numeric(10,2) not null default 0,
  notes               text,
  metadata            jsonb not null default '{}'::jsonb,
  detected_at         timestamptz not null default now(),
  acknowledged_at     timestamptz,
  acknowledged_by     uuid references auth.users(id) on delete set null
);
create index if not exists idx_competitor_signals_competitor on public.competitor_signals (competitor_id, detected_at desc);
create index if not exists idx_competitor_signals_type       on public.competitor_signals (signal_type, detected_at desc);
create index if not exists idx_competitor_signals_open       on public.competitor_signals (acknowledged_at) where acknowledged_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. competitor_upload_freq — view (gemiddelde uploads/dag laatste 14d)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.competitor_upload_freq as
select
  c.id                                                            as competitor_id,
  c.name                                                          as competitor_name,
  c.platform                                                      as platform,
  count(v.id) filter (where v.published_at > now() - interval '14 days')                   as uploads_14d,
  count(v.id) filter (where v.published_at > now() -  interval '7 days')                   as uploads_7d,
  count(v.id) filter (where v.published_at > now() -  interval '24 hours')                 as uploads_24h,
  round(count(v.id) filter (where v.published_at > now() - interval '14 days') / 14.0, 2)  as avg_uploads_per_day,
  max(v.published_at)                                              as latest_upload_at,
  max(v.views) filter (where v.published_at > now() - interval '14 days')                  as best_views_14d
from public.competitor_channels c
left join public.competitor_videos v on v.competitor_id = c.id
where c.active
group by c.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Worker registry: surveillance scanner (offline tot scraper gebouwd is)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_workers (name, kind, status, config)
values
  ('competitor-surveillance-yt',     'scanner', 'offline', jsonb_build_object('platform', 'youtube',     'sweep_interval_min', 60)),
  ('competitor-surveillance-tiktok', 'scanner', 'offline', jsonb_build_object('platform', 'tiktok',      'sweep_interval_min', 90))
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Module status → live
-- ─────────────────────────────────────────────────────────────────────────────
update public.media_holding_modules
   set status = 'live', live_at = coalesce(live_at, now()), updated_at = now()
 where module_key = 'competitor-surveillance';
