-- Social content scheduler and FB deal tracker

create table if not exists public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null,           -- instagram | tiktok
  content_type text not null default 'post', -- post | reel | story | short
  status       text not null default 'concept', -- concept | scheduled | published | failed
  caption      text,
  media_urls   jsonb default '[]',
  hashtags     text,
  scheduled_at timestamptz,
  published_at timestamptz,
  metrics      jsonb default '{}',      -- likes, views, comments, etc.
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists social_posts_platform_idx on public.social_posts(platform);
create index if not exists social_posts_status_idx   on public.social_posts(status);
create index if not exists social_posts_scheduled_idx on public.social_posts(scheduled_at desc nulls last);

create table if not exists public.fb_group_deals (
  id           uuid primary key default gen_random_uuid(),
  group_type   text not null,           -- offmarket | property
  status       text not null default 'nieuw', -- nieuw | contact_gelegd | onderzoek | bod | afgewezen | gewonnen
  title        text not null,
  description  text,
  asking_price numeric(12,2),
  location     text,
  city         text,
  contact_name text,
  contact_url  text,
  source_url   text,
  images       jsonb default '[]',
  notes        text,
  priority     text default 'normaal',  -- laag | normaal | hoog
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fb_group_deals_group_type_idx on public.fb_group_deals(group_type);
create index if not exists fb_group_deals_status_idx     on public.fb_group_deals(status);
create index if not exists fb_group_deals_created_idx    on public.fb_group_deals(created_at desc);
