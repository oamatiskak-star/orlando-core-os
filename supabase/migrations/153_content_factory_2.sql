-- 153_content_factory_2.sql — DRIFT-HEAL (repo == prod)
-- ════════════════════════════════════════════════════════════════════════════
-- Dit bestand spiegelt EXACT de migratie die al op prod (shaunumewswpxhmgbtvv)
-- is toegepast als `20260608183306_content_factory_2` (door een parallelle agent),
-- maar die ontbrak in de repo. Dit trekt repo en prod gelijk. GEEN wijzigingen,
-- GEEN verbeteringen, GEEN interpretatie — alleen de bestaande prod-DDL.
-- Verbeteringen (Content Impact Score, currency, attributie, platform) staan in
-- de aparte additieve migratie 154_cf2_north_star_additive.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- 153_content_factory_2.sql — Content Factory 2.0 Revenue Video Engine (additief, idempotent)
create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.youtube_channels(id) on delete set null,
  niche text, topic text not null, title text, script text,
  language text not null default 'nl',
  format text not null default '16:9',
  status text not null default 'draft'
    check (status in ('draft','production_ready','quality_checked','awaiting_approval',
      'approved','rejected','rework_required','upload_ready','uploaded','verified_live')),
  rework_reason text,
  approved boolean not null default false, approved_by text, approved_at timestamptz,
  quality_enforced boolean not null default false, quality_passed boolean not null default false,
  utm_campaign text, utm_content text,
  revenue_attributed numeric(12,2) default 0, leads_attributed integer default 0,
  queue_id uuid references public.youtube_upload_queue(id) on delete set null,
  render_url text, thumbnail_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_video_projects_status on public.video_projects(status);
create index if not exists idx_video_projects_channel on public.video_projects(channel_id);
create index if not exists idx_video_projects_approval on public.video_projects(status, approved) where status = 'awaiting_approval';

create table if not exists public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  idx integer not null, voice_text text, visual_intent text, search_query text,
  shot_type text, emotion text, pacing text, music_intensity text, caption_text text,
  expected_duration numeric(6,2), selected_asset_id uuid,
  created_at timestamptz not null default now(), unique (project_id, idx)
);
create index if not exists idx_video_scenes_project on public.video_scenes(project_id);

create table if not exists public.visual_assets (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid references public.video_scenes(id) on delete set null,
  project_id uuid references public.video_projects(id) on delete set null,
  source_provider text not null, original_source_url text, local_asset_url text,
  license text, license_status text default 'unverified',
  duration numeric(6,2), resolution text,
  topic_relevance integer, cinematic_score integer, freshness_score integer,
  uniqueness_score integer, reuse_count integer not null default 0,
  final_visual_score integer, approved_for_reuse boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_visual_assets_scene on public.visual_assets(scene_id);
create index if not exists idx_visual_assets_provider on public.visual_assets(source_provider);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.video_projects(id) on delete cascade,
  kind text not null check (kind in ('voice','music')),
  provider text, url text, language text, duration numeric(8,2),
  scores jsonb not null default '{}'::jsonb, final_score integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_audio_assets_project on public.audio_assets(project_id, kind);

create table if not exists public.thumbnail_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  variant text not null check (variant in ('A','B','C')),
  image_url text, ctr_prediction numeric(5,2),
  curiosity_score integer, contrast_score integer, emotional_trigger_score integer,
  authority_score integer, readability_score integer, face_focus_score integer,
  object_focus_score integer, thumbnail_score integer, chosen boolean not null default false,
  created_at timestamptz not null default now(), unique (project_id, variant)
);
create index if not exists idx_thumbnail_variants_project on public.thumbnail_variants(project_id);

create table if not exists public.upload_verification_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.video_projects(id) on delete set null,
  queue_id uuid references public.youtube_upload_queue(id) on delete set null,
  checks jsonb not null default '{}'::jsonb, passed boolean not null default false,
  verified_at timestamptz not null default now()
);
create index if not exists idx_upload_verif_project on public.upload_verification_logs(project_id);

create table if not exists public.viral_patterns (
  id uuid primary key default gen_random_uuid(),
  niche text, platform text, pattern_type text, source_title text, source_url text,
  views bigint, likes bigint, comments bigint, length_seconds integer,
  hook text, thumbnail_desc text, cta text, format text, voice_type text, music_type text,
  emotions text[], pattern jsonb not null default '{}'::jsonb, success_score integer,
  revenue_attributed numeric(12,2) default 0, sampled_at timestamptz not null default now()
);
create index if not exists idx_viral_patterns_niche on public.viral_patterns(niche, pattern_type);
create index if not exists idx_viral_patterns_revenue on public.viral_patterns(revenue_attributed desc);

alter table public.youtube_quality_scores add column if not exists video_project_id uuid references public.video_projects(id) on delete cascade;
alter table public.youtube_quality_scores add column if not exists visual_score integer;
alter table public.youtube_quality_scores add column if not exists voice_score integer;
alter table public.youtube_quality_scores add column if not exists music_score integer;
alter table public.youtube_quality_scores add column if not exists retention_prediction integer;
alter table public.youtube_quality_scores add column if not exists cta_score integer;
alter table public.youtube_quality_scores add column if not exists content_quality_index integer;
alter table public.youtube_quality_scores add column if not exists dimension_verdicts jsonb default '{}'::jsonb;
alter table public.youtube_quality_scores add column if not exists gate_passed boolean;
alter table public.youtube_quality_scores add column if not exists gate_reason text;

alter table public.youtube_upload_queue drop constraint if exists youtube_upload_queue_status_check;
alter table public.youtube_upload_queue add constraint youtube_upload_queue_status_check
  check (status = any (array[
    'queued','preparing','normalizing','uploading','uploaded','uploaded_pending_processing',
    'processing','verifying','verified_live','failed','retrying','manual_review_required',
    'cancelled','planned','unrecoverable','blocked','rework_required']));

create or replace view public.v_video_cqi as
select vp.id as project_id, vp.channel_id, vp.niche, vp.title, vp.status,
  vp.approved, vp.quality_enforced, vp.quality_passed, vp.revenue_attributed, vp.leads_attributed,
  qs.hook_score, qs.thumbnail_score, qs.visual_score, qs.voice_score, qs.music_score,
  qs.retention_prediction, qs.cta_score, qs.content_quality_index, qs.gate_passed, qs.gate_reason,
  vp.created_at, vp.updated_at
from public.video_projects vp
left join lateral (
  select * from public.youtube_quality_scores q where q.video_project_id = vp.id
  order by q.created_at desc limit 1
) qs on true;

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

create or replace function public.cf2_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;
drop trigger if exists trg_video_projects_touch on public.video_projects;
create trigger trg_video_projects_touch before update on public.video_projects
  for each row execute function public.cf2_touch_updated_at();
