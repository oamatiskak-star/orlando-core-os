-- 153_content_factory_2.sql
-- Content Factory 2.0 — Revenue Video Engine (datamodel-foundation)
--
-- Additief + idempotent. Breidt de BESTAANDE pipeline uit; vervangt niets.
-- Spine = video_projects (master per video) → schrijft ná approval+quality-pass
-- in de bestaande youtube_upload_queue. Scoring breidt youtube_quality_scores uit.
-- Omzet-attributie koppelt video → CTA-UTM → vastgoed_core.intent_events → omzet.
--
-- NIET automatisch toepassen op prod: vereist expliciete Orlando-go (hard gate).

begin;

-- ── 1. video_projects — master record per geproduceerde video ────────────────
create table if not exists public.video_projects (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid references public.youtube_channels(id) on delete set null,
  niche             text,
  topic             text not null,
  title             text,
  script            text,
  language          text not null default 'nl',         -- 'nl' | 'en'
  format            text not null default '16:9',        -- '16:9' | '9:16' | '1:1'
  -- status-machine (zie plan): draft→production_ready→quality_checked→
  -- awaiting_approval→approved→upload_ready→uploaded→verified_live (+rejected/rework_required)
  status            text not null default 'draft'
                    check (status in ('draft','production_ready','quality_checked',
                      'awaiting_approval','approved','rejected','rework_required',
                      'upload_ready','uploaded','verified_live')),
  rework_reason     text,
  -- approval-gate (menselijke goedkeuring vóór upload — verplicht)
  approved          boolean not null default false,
  approved_by       text,
  approved_at       timestamptz,
  -- enforce-flag per project (shadow-first: scoren+loggen zonder te blokkeren)
  quality_enforced  boolean not null default false,
  quality_passed    boolean not null default false,
  -- omzet-attributie (north star): video → CTA-UTM → intent_events → omzet
  utm_campaign      text,
  utm_content       text,                                -- conventie: 'video:{id}'
  revenue_attributed numeric(12,2) default 0,
  leads_attributed   integer default 0,
  -- koppeling naar de bestaande upload-queue (na approval)
  queue_id          uuid references public.youtube_upload_queue(id) on delete set null,
  render_url        text,
  thumbnail_url     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_video_projects_status   on public.video_projects(status);
create index if not exists idx_video_projects_channel   on public.video_projects(channel_id);
create index if not exists idx_video_projects_approval  on public.video_projects(status, approved) where status = 'awaiting_approval';

-- ── 2. video_scenes — script verdeeld in scenes (scene-planner output) ───────
create table if not exists public.video_scenes (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.video_projects(id) on delete cascade,
  idx               integer not null,                    -- scene-volgorde
  voice_text        text,
  visual_intent     text,
  search_query      text,
  shot_type         text,                                -- bv 'slow cinematic pan'
  emotion           text,
  pacing            text,
  music_intensity   text,
  caption_text      text,
  expected_duration numeric(6,2),                        -- seconden
  selected_asset_id uuid,                                -- → visual_assets.id (gevuld na selectie)
  created_at        timestamptz not null default now(),
  unique (project_id, idx)
);
create index if not exists idx_video_scenes_project on public.video_scenes(project_id);

-- ── 3. visual_assets — registry van gevonden/gedownloade clips (auto, geen handmatige links) ─
create table if not exists public.visual_assets (
  id                  uuid primary key default gen_random_uuid(),
  scene_id            uuid references public.video_scenes(id) on delete set null,
  project_id          uuid references public.video_projects(id) on delete set null,
  source_provider     text not null,                     -- 'pexels' | 'pixabay' | 'library' | ...
  original_source_url text,
  local_asset_url     text,                              -- na download → storage
  license             text,
  license_status      text default 'unverified',
  duration            numeric(6,2),
  resolution          text,
  topic_relevance     integer,                           -- 0-100
  cinematic_score     integer,
  freshness_score     integer,
  uniqueness_score    integer,
  reuse_count         integer not null default 0,
  final_visual_score  integer,                           -- gate >85
  approved_for_reuse  boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_visual_assets_scene    on public.visual_assets(scene_id);
create index if not exists idx_visual_assets_provider on public.visual_assets(source_provider);

-- ── 4. audio_assets — voice + music met scores ──────────────────────────────
create table if not exists public.audio_assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.video_projects(id) on delete cascade,
  kind          text not null check (kind in ('voice','music')),
  provider      text,                                    -- 'elevenlabs' | 'edge-tts' | ...
  url           text,
  language      text,
  duration      numeric(8,2),
  -- voice: naturalness/emotion/pacing/clarity/language_accuracy ; music: emotion/tension/premium/retention
  scores        jsonb not null default '{}'::jsonb,
  final_score   integer,                                 -- voice gate ≥95 / music ≥90
  created_at    timestamptz not null default now()
);
create index if not exists idx_audio_assets_project on public.audio_assets(project_id, kind);

-- ── 5. thumbnail_variants — A/B/C + CTR-predictie ───────────────────────────
create table if not exists public.thumbnail_variants (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.video_projects(id) on delete cascade,
  variant           text not null check (variant in ('A','B','C')),
  image_url         text,
  ctr_prediction    numeric(5,2),                        -- voorspelde CTR %
  curiosity_score   integer,
  contrast_score    integer,
  emotional_trigger_score integer,
  authority_score   integer,
  readability_score integer,
  face_focus_score  integer,
  object_focus_score integer,
  thumbnail_score   integer,                             -- gate ≥90
  chosen            boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (project_id, variant)
);
create index if not exists idx_thumbnail_variants_project on public.thumbnail_variants(project_id);

-- ── 6. upload_verification_logs — post-upload verificatie-agent ──────────────
create table if not exists public.upload_verification_logs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.video_projects(id) on delete set null,
  queue_id      uuid references public.youtube_upload_queue(id) on delete set null,
  -- checks: live/thumb/title/description/cta_links/pinned_comment/utm/channel/privacy
  checks        jsonb not null default '{}'::jsonb,
  passed        boolean not null default false,
  verified_at   timestamptz not null default now()
);
create index if not exists idx_upload_verif_project on public.upload_verification_logs(project_id);

-- ── 7. viral_patterns — research (Viral Intelligence Agent), gesorteerd op OMZET ─
create table if not exists public.viral_patterns (
  id                 uuid primary key default gen_random_uuid(),
  niche              text,
  platform           text,                               -- youtube|tiktok|instagram|x|linkedin
  pattern_type       text,                               -- hook|thumbnail|retention|music|pacing|visual|cta|format
  source_title       text,
  source_url         text,
  views              bigint,
  likes              bigint,
  comments           bigint,
  length_seconds     integer,
  hook               text,
  thumbnail_desc     text,
  cta                text,
  format             text,
  voice_type         text,
  music_type         text,
  emotions           text[],
  pattern            jsonb not null default '{}'::jsonb,
  success_score      integer,
  revenue_attributed numeric(12,2) default 0,            -- sorteer-sleutel i.p.v. views
  sampled_at         timestamptz not null default now()
);
create index if not exists idx_viral_patterns_niche   on public.viral_patterns(niche, pattern_type);
create index if not exists idx_viral_patterns_revenue on public.viral_patterns(revenue_attributed desc);

-- ── 8. youtube_quality_scores — UITBREIDEN met de volledige CQI-dimensies ────
alter table public.youtube_quality_scores add column if not exists video_project_id    uuid references public.video_projects(id) on delete cascade;
alter table public.youtube_quality_scores add column if not exists visual_score        integer;
alter table public.youtube_quality_scores add column if not exists voice_score         integer;
alter table public.youtube_quality_scores add column if not exists music_score         integer;
alter table public.youtube_quality_scores add column if not exists retention_prediction integer;
alter table public.youtube_quality_scores add column if not exists cta_score           integer;
alter table public.youtube_quality_scores add column if not exists content_quality_index integer;
alter table public.youtube_quality_scores add column if not exists dimension_verdicts  jsonb default '{}'::jsonb;
alter table public.youtube_quality_scores add column if not exists gate_passed         boolean;
alter table public.youtube_quality_scores add column if not exists gate_reason         text;

-- ── 9. youtube_upload_queue — nieuwe blokkerende statussen ───────────────────
alter table public.youtube_upload_queue drop constraint if exists youtube_upload_queue_status_check;
alter table public.youtube_upload_queue add constraint youtube_upload_queue_status_check
  check (status = any (array[
    'queued','preparing','normalizing','uploading','uploaded','uploaded_pending_processing',
    'processing','verifying','verified_live','failed','retrying','manual_review_required',
    'cancelled','planned','unrecoverable',
    'blocked','rework_required'  -- NIEUW: quality-gate
  ]));

-- ── 10. v_video_cqi — dashboard-view (Content Quality Center) ────────────────
create or replace view public.v_video_cqi as
select
  vp.id as project_id, vp.channel_id, vp.niche, vp.title, vp.status,
  vp.approved, vp.quality_enforced, vp.quality_passed,
  vp.revenue_attributed, vp.leads_attributed,
  qs.hook_score, qs.thumbnail_score, qs.visual_score, qs.voice_score,
  qs.music_score, qs.retention_prediction, qs.cta_score, qs.content_quality_index,
  qs.gate_passed, qs.gate_reason,
  vp.created_at, vp.updated_at
from public.video_projects vp
left join lateral (
  select * from public.youtube_quality_scores q
  where q.video_project_id = vp.id
  order by q.created_at desc limit 1
) qs on true;

-- ── 11. RLS — service_role volledig, authenticated read (dashboard) ──────────
do $$
declare t text;
begin
  foreach t in array array['video_projects','video_scenes','visual_assets','audio_assets',
                           'thumbnail_variants','upload_verification_logs','viral_patterns']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$ drop policy if exists %1$s_service on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_service on public.%1$s for all to service_role using (true) with check (true) $p$, t);
    execute format($p$ drop policy if exists %1$s_auth_read on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_auth_read on public.%1$s for select to authenticated using (true) $p$, t);
  end loop;
end $$;

-- updated_at touch op video_projects (hergebruik bestaande trigger-functie indien aanwezig,
-- anders lokaal). Idempotent.
create or replace function public.cf2_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;
drop trigger if exists trg_video_projects_touch on public.video_projects;
create trigger trg_video_projects_touch before update on public.video_projects
  for each row execute function public.cf2_touch_updated_at();

commit;
