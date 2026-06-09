-- 157_cf2_channel_strategy_layer.sql
-- ════════════════════════════════════════════════════════════════════════════
-- CF2 Channel Strategy Layer — ADDITIEF bovenop 153/154/156. CF2 leert nu op
-- VIDEO; deze laag maakt leren op CHANNEL → FORMAT → TOPIC → VIDEO mogelijk en
-- voorkomt dat kanalen elkaars optimalisaties vervuilen.
--
-- 100% ADDITIEF: alleen CREATE TABLE/VIEW + ADD COLUMN (nullable) + reële backfill
-- via bestaande FK-join (GEEN schatting). Vervangt NIETS. Canonieke channel-
-- entiteit = bestaande public.youtube_channels (GEEN nieuwe `channels`-tabel —
-- dat zou een tweede waarheidsbron worden). North Star blijft v_video_impact;
-- kanaalinzicht wordt DAARVAN afgeleid (geen tweede impactsysteem).
--
-- STATUS: READY_FOR_PRODUCTION + BLOCKED_BY_SEQUENCE — NIET toepassen tot CF2
-- live-state-audit + shadow-run bewezen zijn (zelfde gate als 156).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── A. channel_strategy_profiles — strategie/KPI per kanaal (op youtube_channels) ─
create table if not exists public.channel_strategy_profiles (
  channel_id        uuid primary key references public.youtube_channels(id) on delete cascade,
  primary_goal      text,                         -- bv 'leads', 'subscriptions', 'authority'
  target_audience   text,
  preferred_formats text[]   not null default '{}',
  content_mix       jsonb    not null default '{}'::jsonb,   -- {longform:.5, shorts:.5} e.d.
  cta_strategy      text,                         -- bv 'dealcheck', 'membership', 'rapport'
  monetization_type text,                         -- bv 'membership','affiliate','report'
  kpi_targets       jsonb    not null default '{}'::jsonb,   -- per-kanaal eigen KPI's
  enabled           boolean  not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── B. channel_id op attributie/learning/patterns (nullable, additief) ───────
alter table public.video_attribution      add column if not exists channel_id uuid references public.youtube_channels(id) on delete set null;
alter table public.video_learning_summary add column if not exists channel_id uuid references public.youtube_channels(id) on delete set null;
alter table public.viral_patterns         add column if not exists channel_id uuid references public.youtube_channels(id) on delete set null;

-- reële backfill via bestaande FK (echte join, geen schatting) — alleen waar leeg
update public.video_attribution a
  set channel_id = vp.channel_id
  from public.video_projects vp
  where a.project_id = vp.id and a.channel_id is null and vp.channel_id is not null;
update public.video_learning_summary s
  set channel_id = vp.channel_id
  from public.video_projects vp
  where s.video_project_id = vp.id and s.channel_id is null and vp.channel_id is not null;

create index if not exists idx_video_attr_channel on public.video_attribution(channel_id);
create index if not exists idx_learning_channel   on public.video_learning_summary(channel_id);
create index if not exists idx_viral_channel       on public.viral_patterns(channel_id, niche);

-- ── C. v_channel_learning — kanaalinzicht AFGELEID van v_video_impact (canon) ─
create or replace view public.v_channel_learning with (security_invoker = true) as
select
  vi.channel_id,
  count(*)                                   as videos,
  avg(vi.content_impact_score)               as avg_content_impact_score,
  avg(vi.content_quality_index)              as avg_cqi,
  sum(coalesce(vi.revenue_attributed, 0))    as revenue_attributed,
  sum(coalesce(vi.leads_attributed, 0))      as leads_attributed
from public.v_video_impact vi
where vi.channel_id is not null
group by vi.channel_id;

-- ── C2. v_channel_topic_learning — CHANNEL × TOPIC (voorkomt kruisbestuiving) ─
--   bv: VastgoedTV/marktanalyse werkt, CryptoVermogen/marktanalyse niet — gescheiden.
create or replace view public.v_channel_topic_learning with (security_invoker = true) as
select
  vi.channel_id,
  vi.niche                                   as topic,
  count(*)                                   as videos,
  avg(vi.content_impact_score)               as avg_content_impact_score,
  sum(coalesce(vi.revenue_attributed, 0))    as revenue_attributed
from public.v_video_impact vi
where vi.channel_id is not null
group by vi.channel_id, vi.niche;

-- ── D. RLS + trigger ─────────────────────────────────────────────────────────
alter table public.channel_strategy_profiles enable row level security;
drop policy if exists channel_strategy_profiles_service on public.channel_strategy_profiles;
create policy channel_strategy_profiles_service on public.channel_strategy_profiles for all to service_role using (true) with check (true);
drop policy if exists channel_strategy_profiles_auth_read on public.channel_strategy_profiles;
create policy channel_strategy_profiles_auth_read on public.channel_strategy_profiles for select to authenticated using (true);

grant select on public.v_channel_learning, public.v_channel_topic_learning to authenticated, service_role;

drop trigger if exists trg_channel_strategy_touch on public.channel_strategy_profiles;
create trigger trg_channel_strategy_touch before update on public.channel_strategy_profiles
  for each row execute function public.cf2_touch_updated_at();

commit;
