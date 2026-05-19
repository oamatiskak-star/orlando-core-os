-- 070_channel_launch_plans.sql
-- Voor elke gewonnen youtube-kans: maak een launch plan met alle stappen
-- die nodig zijn om van idea naar live YouTube channel te komen.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. channel_launch_plans — top-level entiteit per gewonnen kans
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_launch_plans (
  id                    uuid primary key default gen_random_uuid(),
  osil_opportunity_id   uuid references public.osil_opportunities(id) on delete set null,
  viral_opportunity_id  uuid references public.viral_opportunities(id) on delete set null,
  channel_id            uuid references public.media_holding_channels(id) on delete set null,
  project_name          text not null,
  niche                 text,
  language              text not null default 'nl',
  target_views_10d      bigint default 100000,
  status                text not null default 'planned'
                          check (status in ('planned','launching','live','paused','killed')),
  branding              jsonb default '{}'::jsonb,
  metadata              jsonb default '{}'::jsonb,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_launch_plans_status   on channel_launch_plans(status);
create index if not exists idx_launch_plans_osil     on channel_launch_plans(osil_opportunity_id);
create index if not exists idx_launch_plans_channel  on channel_launch_plans(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. channel_launch_steps — checklist per plan
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_launch_steps (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references public.channel_launch_plans(id) on delete cascade,
  step_order            smallint not null,
  step_key              text not null,
  step_label            text not null,
  owner_persona         text,
  status                text not null default 'pending'
                          check (status in ('pending','in_progress','completed','blocked','skipped')),
  started_at            timestamptz,
  completed_at          timestamptz,
  blocker_reason        text,
  output                jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (plan_id, step_key)
);
create index if not exists idx_launch_steps_plan   on channel_launch_steps(plan_id, step_order);
create index if not exists idx_launch_steps_status on channel_launch_steps(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Step templates — definieert default checklist voor een launch
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_launch_step_templates (
  step_order      smallint primary key,
  step_key        text not null unique,
  step_label      text not null,
  owner_persona   text,
  description     text
);

insert into public.channel_launch_step_templates (step_order, step_key, step_label, owner_persona, description) values
  (10, 'project_setup',          'Project aanmaken',           'Atlas',  'Project entity in core OS + folder structuur + access rights'),
  (20, 'youtube_channel_create', 'YouTube kanaal aanmaken',    'Atlas',  'Brand account + YouTube channel handle reserveren'),
  (30, 'google_console_setup',   'Google Cloud Console',       'Atlas',  'OAuth client credentials + YouTube Data API enable + tokens opslaan'),
  (40, 'branding_logo',          'Logo + branding',            'Forge',  'Logo + banner + thumbnail templates genereren via AI'),
  (50, 'seo_research',           'SEO research + keywords',    'Vortex', 'Niche keywords, competitor analysis, content pillars'),
  (60, 'seo_write',              'SEO meta + descriptions',    'Vortex', 'Channel description, tags, default upload descriptions'),
  (70, 'audio_production',       'Audio asset productie',      'Forge',  'Theme music, voiceovers, library samples voor first batch'),
  (80, 'video_production',       'Video asset productie',      'Forge',  'First 3-5 videos klaar via Replicate + scripts via Forge'),
  (90, 'dashboard_publish',      'Dashboard publicatie',       'Atlas',  'Channel zichtbaar maken op /dashboard/media-holding + KPI tracking aan'),
  (100,'first_upload',           'Eerste upload + monitor',    'Atlas',  'Eerste video upload met SEO compleet + retention monitoring start')
on conflict (step_order) do update
  set step_key      = excluded.step_key,
      step_label    = excluded.step_label,
      owner_persona = excluded.owner_persona,
      description   = excluded.description;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger — bij osil_opportunities status → 'gewonnen' (category=youtube):
--    maak channel_launch_plans + alle steps op pending
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.on_osil_won_create_launch_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_viral_id    uuid;
  v_viral       record;
  v_plan_id     uuid;
  v_project     text;
  v_niche       text;
  v_channel_id  uuid;
begin
  if new.category <> 'youtube'                          then return new; end if;
  if new.status   <> 'gewonnen'                          then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'gewonnen'        then return new; end if;
  if not public._autopilot_link_active('won_to_launch_plan') then return new; end if;

  -- Skip als er al een plan bestaat voor deze kans
  if exists (select 1 from public.channel_launch_plans where osil_opportunity_id = new.id) then
    return new;
  end if;

  -- Vind gekoppelde viral_opportunity
  v_viral_id := nullif(substring(new.ai_analysis from 'viral_opportunity_id=([0-9a-f-]+)'), '')::uuid;
  if v_viral_id is not null then
    select id, title, niche, channel_name, raw_payload
      into v_viral
      from public.viral_opportunities
     where id = v_viral_id;
  end if;

  v_niche := coalesce(v_viral.niche, 'general');
  v_project := substring(coalesce(v_viral.title, new.title), 1, 80);

  -- Vind eventueel een bestaande auto-channel uit Chain B (osil_actief_to_launch)
  select id into v_channel_id
    from public.media_holding_channels
   where (branding->>'spawned_from_osil')::uuid = new.id
   order by created_at desc
   limit 1;

  -- Maak plan
  insert into public.channel_launch_plans
    (osil_opportunity_id, viral_opportunity_id, channel_id, project_name, niche, status, metadata, started_at)
  values
    (new.id, v_viral_id, v_channel_id, v_project, v_niche, 'launching',
     jsonb_build_object('source', 'osil_won', 'auto_triggered', true),
     now())
  returning id into v_plan_id;

  -- Maak alle steps van template
  insert into public.channel_launch_steps (plan_id, step_order, step_key, step_label, owner_persona, status)
  select v_plan_id, step_order, step_key, step_label, owner_persona, 'pending'
    from public.channel_launch_step_templates
   order by step_order;

  -- Markeer eerste step (project_setup) als in_progress
  update public.channel_launch_steps
     set status     = 'in_progress',
         started_at = now(),
         updated_at = now()
   where plan_id  = v_plan_id
     and step_key = 'project_setup';

  -- Skip steps die we al hebben gedaan (channel bestaat = youtube_channel_create skipped)
  if v_channel_id is not null then
    update public.channel_launch_steps
       set status       = 'completed',
           completed_at = now(),
           output       = jsonb_build_object('channel_id', v_channel_id, 'note', 'auto-launched in actief'),
           updated_at   = now()
     where plan_id  = v_plan_id
       and step_key = 'youtube_channel_create';
  end if;

  -- Log naar autopilot_events
  insert into public.autopilot_events (link_key, source_table, source_id, target_executor, task_id, details)
  values (
    'won_to_launch_plan',
    'osil_opportunities',
    new.id,
    'launch_planner',
    null,
    jsonb_build_object('plan_id', v_plan_id, 'channel_id', v_channel_id, 'niche', v_niche)
  );

  return new;
end
$f$;

drop trigger if exists trg_on_osil_won_launch_plan on public.osil_opportunities;
create trigger trg_on_osil_won_launch_plan
  after insert or update of status on public.osil_opportunities
  for each row execute function public.on_osil_won_create_launch_plan();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. autopilot_config entry (default ON)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.autopilot_config (link_key, description, enabled, threshold)
values
  ('won_to_launch_plan',
   'Auto-maak channel_launch_plan + 10 steps bij osil_opportunities status=gewonnen',
   true, null)
on conflict (link_key) do update
  set description = excluded.description,
      updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Update step-status timestamps automatisch
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.tg_launch_step_timestamps()
returns trigger
language plpgsql
as $f$
begin
  if tg_op = 'UPDATE' then
    if new.status <> old.status then
      if new.status = 'in_progress' and new.started_at is null then
        new.started_at := now();
      end if;
      if new.status in ('completed','skipped') and new.completed_at is null then
        new.completed_at := now();
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end
$f$;

drop trigger if exists trg_launch_step_timestamps on public.channel_launch_steps;
create trigger trg_launch_step_timestamps
  before update on public.channel_launch_steps
  for each row execute function public.tg_launch_step_timestamps();
