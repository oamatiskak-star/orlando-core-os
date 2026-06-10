-- 166_content_horizon.sql
-- CF2 Adaptive Growth Engine — Content Horizon ("Content voor overmorgen").
-- ONTKOPPELD van de Winner Engine: plant op LIVE performance (viral_opportunities +
-- analytics), niet op winner_extraction_jobs. ADDITIEF + idempotent.
-- HARDE GATE: niet auto-toepassen; engine enabled=false; cron draait pas na go.
-- Buffer: min 24u / doel 48u / max 72u. Geen verzonnen KPI's: expected_views = echte
-- bron-viral-views; expected_subs blijft null ("Geen data") tot er een echte basis is.

-- ── 1) Persisted productieplan (vult de gated planner) ───────────────────────────
create table if not exists public.content_horizon (
  id                   uuid primary key default gen_random_uuid(),
  channel_id           uuid references public.media_holding_channels(id) on delete cascade,
  niche                text,
  source_opportunity_id uuid references public.viral_opportunities(id) on delete set null,
  title_draft          text,
  planned_publish_at   timestamptz,
  buffer_hours         integer,
  confidence           numeric(5,2),         -- 0..100, uit virality_score
  expected_views       bigint,               -- echte bron-viral-views (geen forecast)
  expected_subs        integer,              -- null = "Geen data beschikbaar"
  reason               text,
  status               text not null default 'planned'
    check (status in ('planned','produced','published','skipped')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists content_horizon_slot_idx on public.content_horizon (planned_publish_at);

-- ── 2) LIVE niche-momentum (welke niche wint/verliest marktaandeel) ──────────────
create or replace view public.v_niche_momentum as
with recent as (
  select niche,
         count(*) as n_recent,
         round(avg(virality_score), 1) as vir_recent,
         round(avg(view_velocity), 0) as vel_recent
  from public.viral_opportunities
  where captured_at > now() - interval '7 days'
  group by niche
),
prior as (
  select niche, round(avg(virality_score), 1) as vir_prior
  from public.viral_opportunities
  where captured_at <= now() - interval '7 days' and captured_at > now() - interval '14 days'
  group by niche
)
select
  r.niche,
  r.n_recent, r.vir_recent, r.vel_recent,
  p.vir_prior,
  case
    when p.vir_prior is null then 'nieuw'
    when r.vir_recent > p.vir_prior + 2 then 'wint'
    when r.vir_recent < p.vir_prior - 2 then 'verliest'
    else 'stabiel'
  end as momentum
from recent r
left join prior p on p.niche = r.niche
order by r.vir_recent desc nulls last;

-- ── 3) LIVE viral-candidates (wat wint nu → produceer variant) ───────────────────
create or replace view public.v_viral_candidates as
select
  id, title, channel_name, niche, views, view_velocity, virality_score,
  retention_score, saturation_score, thumbnail_url, url, published_at, captured_at
from public.viral_opportunities
where captured_at > now() - interval '7 days'
order by virality_score desc nulls last, view_velocity desc nulls last
limit 200;

-- ── 4) Gated planner: persisteert het 48u-plan uit live viral-candidates ──────────
-- Heuristische niche→youtube-categorie map (kanaal-niche ↔ scraper-categorie).
create or replace function public.plan_content_horizon()
returns integer language plpgsql as $fn$
declare v_count int := 0;
begin
  -- ververs het horizon-venster (verwijder oude 'planned' buiten 72u, herbereken)
  delete from public.content_horizon where status='planned';

  with cat_map(channel_niche, cats) as (
    values
      ('finance_education_nl', array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('finance_education_es', array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('vastgoed_education_nl',array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('satisfying_cutting',   array['youtube_cat_20','youtube_cat_24','youtube_cat_1']),
      ('satisfying_brick_world',array['youtube_cat_20','youtube_cat_24','youtube_cat_1']),
      ('seamless loops / satisfying / mini-world', array['youtube_cat_20','youtube_cat_24','youtube_cat_1'])
  ),
  ranked as (
    select mh.id as channel_id, mh.niche, vo.id as opp_id, vo.title, vo.views, vo.virality_score,
           row_number() over (partition by mh.id order by vo.virality_score desc nulls last, vo.view_velocity desc nulls last) as rn
    from public.media_holding_channels mh
    join cat_map cm on cm.channel_niche = mh.niche
    join public.viral_opportunities vo
      on vo.niche = any(cm.cats) and vo.captured_at > now() - interval '7 days'
    where mh.status in ('live','scaling','incubating')
  )
  insert into public.content_horizon
    (channel_id, niche, source_opportunity_id, title_draft, planned_publish_at, buffer_hours,
     confidence, expected_views, expected_subs, reason, status)
  select channel_id, niche, opp_id,
         'Variant: ' || left(title, 80),
         now() + interval '48 hours', 48,
         virality_score, views, null,
         'Top-viral in niche (virality ' || virality_score || ') — variant voor overmorgen',
         'planned'
  from ranked where rn <= 3;

  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

-- ── 5) Gated engine + cron (NIET aangezet) ───────────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('content:horizon-planner','content','Content Horizon planner (overmorgen)', null, false)
on conflict (engine_key) do update set label=excluded.label;

do $u$ begin perform cron.unschedule('content_horizon_planner'); exception when others then null; end $u$;
select cron.schedule('content_horizon_planner','15 */6 * * *',
  $cron$ select case when public.engine_window_open('content:horizon-planner')
                     then public.plan_content_horizon() else 0 end $cron$);

grant select on public.v_niche_momentum, public.v_viral_candidates to authenticated, anon;
grant select on public.content_horizon to authenticated, anon;
