-- 153_content_factory_2.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Content Factory 2.0 — Phase 1: verifiable spine + upload-protection gate
-- ════════════════════════════════════════════════════════════════════════════
-- Canonieke CF2-spine migratie. Hoogste bestaande migratie = 152
-- (152_hermes_cutover_orchestrator.sql); 153 is het vrije volgende nummer.
-- 049_content_factory.sql is een oudere, andere scope (alleen content_brief +
-- executor-enum) en wordt NIET vervangen. Dit is de enige CF2-spine migratie.
--
-- Bouwt UITSLUITEND de dataspine, de Content Impact Score en de upload-gate.
-- Geen AI-engines, geen externe calls. Breidt bestaande Media Holding OS uit;
-- dupliceert geen bestaande tabellen (bridge via nullable FK's).
-- North Star = CONTENT IMPACT SCORE = 40% revenue + 30% leads + 20% authority
-- + 10% viral growth.
-- ════════════════════════════════════════════════════════════════════════════

-- ── shared updated_at trigger (eigen, ordering-onafhankelijk) ────────────────
create or replace function public._cf2_touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. video_projects — de spine, bridge tussen content- en upload-pipeline ──
create table if not exists public.video_projects (
  id                      uuid primary key default gen_random_uuid(),
  -- bridges naar de twee ONTKOPPELDE pipelines (beide nullable; set null bij delete)
  content_item_id         uuid references public.media_holding_content_items(id) on delete set null,
  channel_id              uuid references public.media_holding_channels(id) on delete set null,
  youtube_upload_queue_id uuid references public.youtube_upload_queue(id) on delete set null,
  -- identiteit
  title                   text,
  hook                    text,
  -- strategische mix (60/25/15) als data, niet als constraint
  content_category        text not null default 'viral_growth'
                            check (content_category in ('viral_growth','authority','revenue')),
  status                  text not null default 'draft'
                            check (status in (
                              'draft','production_ready','quality_checked','awaiting_approval',
                              'approved','upload_ready','uploaded','verified_live',
                              'rework_required','blocked')),
  -- verplichte handmatige goedkeuring (niets gaat automatisch live)
  approved                boolean not null default false,
  approved_by             text,
  approved_at             timestamptz,
  approval_notes          text,
  -- gate-audit
  gate_blocked_reason     text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists idx_video_projects_status   on public.video_projects(status);
create index if not exists idx_video_projects_queue    on public.video_projects(youtube_upload_queue_id);
create index if not exists idx_video_projects_content  on public.video_projects(content_item_id);
create index if not exists idx_video_projects_channel  on public.video_projects(channel_id);
create index if not exists idx_video_projects_category on public.video_projects(content_category);

-- ── 2. video_scores — 1:N versioned; laatste versie telt ─────────────────────
create table if not exists public.video_scores (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.video_projects(id) on delete cascade,
  version              integer not null default 1,
  -- productie-kwaliteit subscores (0-100)
  hook_score           integer check (hook_score between 0 and 100),
  thumbnail_score      integer check (thumbnail_score between 0 and 100),
  voice_score          integer check (voice_score between 0 and 100),
  visual_score         integer check (visual_score between 0 and 100),
  music_score          integer check (music_score between 0 and 100),
  cta_score            integer check (cta_score between 0 and 100),
  retention_prediction integer check (retention_prediction between 0 and 100),
  cqi                  integer check (cqi between 0 and 100),
  -- impact subscores die de North Star voeden (0-100)
  revenue_score        integer not null default 0 check (revenue_score between 0 and 100),
  leads_score          integer not null default 0 check (leads_score between 0 and 100),
  authority_score      integer not null default 0 check (authority_score between 0 and 100),
  viral_score          integer not null default 0 check (viral_score between 0 and 100),
  -- CONTENT IMPACT SCORE = 40% revenue + 30% leads + 20% authority + 10% viral
  content_impact_score numeric(6,2) generated always as (
    revenue_score   * 0.40 +
    leads_score     * 0.30 +
    authority_score * 0.20 +
    viral_score     * 0.10
  ) stored,
  scored_by            text not null default 'manual' check (scored_by in ('manual','agent')),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (project_id, version)
);
create index if not exists idx_video_scores_project on public.video_scores(project_id, version desc);

-- ── 3. viral_patterns — patroon-store (Phase 1: seed/manueel) ────────────────
create table if not exists public.viral_patterns (
  id           uuid primary key default gen_random_uuid(),
  pattern_type text not null,
  descriptor   jsonb not null default '{}'::jsonb,
  niche        text,
  platform     text check (platform in ('youtube','tiktok','instagram','facebook','snapchat','reddit')),
  success_rate numeric(5,2) not null default 0 check (success_rate between 0 and 100),
  sample_size  integer not null default 0,
  conditions   jsonb not null default '{}'::jsonb,
  source       text not null default 'manual' check (source in ('manual','viral_opportunity','agent')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_viral_patterns_type     on public.viral_patterns(pattern_type);
create index if not exists idx_viral_patterns_platform on public.viral_patterns(platform);

-- ── 4. video_attribution — UTM → lead → sale (event-grained) ─────────────────
create table if not exists public.video_attribution (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.video_projects(id) on delete cascade,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_content            text,   -- conventie: utm_content = project_id
  utm_term               text,
  stage                  text not null check (stage in ('click','lead','sale')),
  -- hergebruik bestaande monetisatie-graph i.p.v. dupliceren
  affiliate_link_id      uuid references public.affiliate_links(id) on delete set null,
  monetization_stream_id uuid references public.monetization_streams(id) on delete set null,
  lead_email             text,
  revenue                numeric(14,2) not null default 0,
  external_ref           text,
  raw_payload            jsonb not null default '{}'::jsonb,
  occurred_at            timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
create index if not exists idx_video_attr_project      on public.video_attribution(project_id, occurred_at desc);
create index if not exists idx_video_attr_stage        on public.video_attribution(stage);
create index if not exists idx_video_attr_campaign     on public.video_attribution(utm_campaign);
create index if not exists idx_video_attr_affiliate    on public.video_attribution(affiliate_link_id);
create index if not exists idx_video_attr_monetization on public.video_attribution(monetization_stream_id);

-- ── 5. upload-eligibility functie — exacte gate-drempels, één bron ───────────
create or replace function public.video_project_upload_eligible(p_project_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $f$
  select coalesce(bool_or(
    vp.approved = true
    and s.thumbnail_score      >= 90
    and s.hook_score           >= 90
    and s.retention_prediction >= 90
    and s.voice_score          >= 95
    and s.visual_score         >= 85
    and s.music_score          >= 90
    and s.cta_score            >= 90
    and s.cqi                  >= 90
  ), false)
  from public.video_projects vp
  join lateral (
    select * from public.video_scores
    where project_id = vp.id
    order by version desc
    limit 1
  ) s on true
  where vp.id = p_project_id;
$f$;

-- ── 6. gate-status view — laatste score + eligibility + block_reason ─────────
create or replace view public.video_project_gate_status
  with (security_invoker = true) as
select
  vp.id as project_id,
  vp.youtube_upload_queue_id,
  vp.status,
  vp.content_category,
  vp.approved,
  vp.title,
  s.hook_score, s.thumbnail_score, s.voice_score, s.visual_score,
  s.music_score, s.cta_score, s.retention_prediction, s.cqi,
  s.revenue_score, s.leads_score, s.authority_score, s.viral_score,
  s.content_impact_score,
  public.video_project_upload_eligible(vp.id) as upload_eligible,
  case
    when not vp.approved              then 'not_approved'
    when s.id is null                 then 'not_scored'
    when s.thumbnail_score      < 90  then 'thumbnail_score<90'
    when s.hook_score           < 90  then 'hook_score<90'
    when s.retention_prediction < 90  then 'retention_prediction<90'
    when s.voice_score          < 95  then 'voice_score<95'
    when s.visual_score         < 85  then 'visual_score<85'
    when s.music_score          < 90  then 'music_score<90'
    when s.cta_score            < 90  then 'cta_score<90'
    when s.cqi                  < 90  then 'cqi<90'
    else null
  end as block_reason
from public.video_projects vp
left join lateral (
  select * from public.video_scores
  where project_id = vp.id
  order by version desc
  limit 1
) s on true;

-- ── 7. handmatige goedkeuring RPC — enige weg naar approved=true ─────────────
create or replace function public.approve_video_project(
  p_project_id uuid,
  p_approved_by text,
  p_notes text default null
)
returns public.video_projects
language plpgsql
set search_path = public, pg_temp
as $f$
declare r public.video_projects;
begin
  update public.video_projects
     set approved       = true,
         approved_by    = p_approved_by,
         approved_at    = now(),
         approval_notes = p_notes,
         status         = case when status in ('quality_checked','awaiting_approval')
                               then 'approved' else status end
   where id = p_project_id
   returning * into r;
  return r;
end;
$f$;

-- ── RLS + policies + grants (huisstijl: authenticated full, service_role bypass)
alter table public.video_projects    enable row level security;
alter table public.video_scores      enable row level security;
alter table public.viral_patterns    enable row level security;
alter table public.video_attribution enable row level security;

create policy video_projects_auth    on public.video_projects    for all to authenticated using (true) with check (true);
create policy video_scores_auth      on public.video_scores      for all to authenticated using (true) with check (true);
create policy viral_patterns_auth    on public.viral_patterns    for all to authenticated using (true) with check (true);
create policy video_attribution_auth on public.video_attribution for all to authenticated using (true) with check (true);

grant all on public.video_projects, public.video_scores, public.viral_patterns, public.video_attribution
  to authenticated, service_role;
grant select on public.video_project_gate_status to authenticated, service_role;

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists trg_video_projects_uat on public.video_projects;
create trigger trg_video_projects_uat before update on public.video_projects
  for each row execute function public._cf2_touch_updated_at();

drop trigger if exists trg_video_scores_uat on public.video_scores;
create trigger trg_video_scores_uat before update on public.video_scores
  for each row execute function public._cf2_touch_updated_at();

drop trigger if exists trg_viral_patterns_uat on public.viral_patterns;
create trigger trg_viral_patterns_uat before update on public.viral_patterns
  for each row execute function public._cf2_touch_updated_at();
