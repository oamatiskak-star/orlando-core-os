-- 194_s2_learning_loop.sql
-- AUTONOMOUS GROWTH PHASE 1 — S2 (P0): Learning loop.
--
-- Uitgangspunt (geverifieerd live 12-06): winner/loser/pattern-analyse BESTAAT al als
-- live views over ALLE videos (v_hook_classified=5492, v_winner_patterns=21,
-- v_loser_patterns=26, v_winner_intelligence=63). Niet dupliceren.
-- Wat ontbrak: (a) een expliciet per-video leerrecord en (b) een persistente,
-- consumeerbare STRATEGY RECOMMENDATIONS-laag. Dit levert die twee + scheduling.
--
-- Win-rate = winners/(winners+losers) over de duidelijk geclassificeerde videos
-- (winners/total is misleidend: total bevat alle neutrale videos). Read-only
-- gevalideerd: levert gebalanceerde increase/reduce/stop-aanbevelingen op echte niches.

-- ── 1) Per-video leerrecord — "iedere video levert leerpunten op" ────────────
create or replace view public.v_video_learning as
select
  h.youtube_video_id,
  h.title,
  h.niche,
  h.category,
  h.is_short,
  h.views,
  h.ctr,
  h.retention,
  h.hook_score,
  h.winner_status,
  h.confidence,
  case
    when h.winner_status in ('top_5pct','winner')
      then 'WINNER: '||coalesce(h.category,'?')||'-hook in '||coalesce(h.niche,'?')
           ||' (score '||coalesce(h.hook_score,0)||', '||coalesce(h.views,0)||' views) — repliceren.'
    when h.winner_status in ('loser','underperforming')
      then 'LOSER: '||coalesce(h.category,'?')||'-hook in '||coalesce(h.niche,'?')
           ||' onder niche-mediaan (score '||coalesce(h.hook_score,0)||') — niet herhalen.'
    when h.winner_status = 'runner_up'
      then 'NEUTRAAL: redelijk ('||coalesce(h.category,'?')||'-hook, score '||coalesce(h.hook_score,0)||').'
    else 'ONVOLDOENDE DATA om te leren (te weinig views/CTR).'
  end as leerpunt
from public.v_hook_classified h;

comment on view public.v_video_learning is
  'S2: per-video leerrecord (winner/loser/neutraal + leerpunt) over alle geclassificeerde videos.';

-- ── 2) Persistente strategy-recommendations (deliverable 5 — ontbrak) ────────
create table if not exists public.content_strategy_recommendations (
  id              uuid primary key default gen_random_uuid(),
  platform        text not null default 'youtube',
  niche           text not null,
  category        text,
  dimension       text not null default 'hook',            -- hook | format | length
  action          text not null check (action in ('increase','reduce','stop','test')),
  recommendation  text not null,
  confidence      numeric(4,3) not null default 0,          -- 0..1
  win_rate        numeric(5,2),                             -- % winners over besliste videos
  sample_n        integer not null default 0,               -- winners+losers
  evidence        jsonb not null default '{}'::jsonb,
  status          text not null default 'active' check (status in ('active','applied','dismissed')),
  generated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_csr_status   on public.content_strategy_recommendations (status, platform);
create index if not exists idx_csr_niche_cat on public.content_strategy_recommendations (niche, category);

comment on table public.content_strategy_recommendations is
  'S2: actiegerichte content-aanbevelingen per niche×hook-categorie, afgeleid uit v_hook_patterns.';

-- ── 3) Generator — leest pattern-views, schrijft aanbevelingen ───────────────
-- Idempotent per dag: vervangt de actieve youtube-aanbevelingen van vandaag.
create or replace function public.generate_content_strategy_recommendations(p_min_decided int default 4)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  delete from public.content_strategy_recommendations
   where platform = 'youtube' and status = 'active' and generated_at::date = current_date;

  insert into public.content_strategy_recommendations
    (platform, niche, category, dimension, action, recommendation, confidence, win_rate, sample_n, evidence)
  select
    'youtube', p.niche, p.category, 'hook',
    case
      when p.wr >= 0.55                      then 'increase'
      when p.wr <= 0.15 and p.losers >= 3    then 'stop'
      when p.wr <  0.35                      then 'reduce'
      else 'test'
    end,
    case
      when p.wr >= 0.55
        then format('Niche %s: ''%s''-hook wint (%s%% van %s besliste videos) — produceer meer.',
                    p.niche, p.category, round(p.wr*100), p.decided)
      when p.wr <= 0.15 and p.losers >= 3
        then format('Niche %s: ''%s''-hook verliest structureel (%s%% win, %s losers) — stoppen.',
                    p.niche, p.category, round(p.wr*100), p.losers)
      when p.wr < 0.35
        then format('Niche %s: ''%s''-hook zwak (%s%% van %s) — verminderen/herzien.',
                    p.niche, p.category, round(p.wr*100), p.decided)
      else format('Niche %s: ''%s''-hook neutraal (%s%% van %s) — A/B testen.',
                  p.niche, p.category, round(p.wr*100), p.decided)
    end,
    least(0.95, 0.45 + (p.decided::numeric / 40))::numeric(4,3),
    round(p.wr * 100, 2),
    p.decided,
    jsonb_build_object('total', p.total, 'winners', p.winners, 'losers', p.losers,
                       'decided', p.decided, 'win_rate', round(p.wr, 3))
  from (
    select niche, category, total, winners, losers,
           (winners + losers)                                   as decided,
           winners::numeric / nullif(winners + losers, 0)       as wr
    from public.v_hook_patterns
    where niche is not null and category is not null
      and (winners + losers) >= p_min_decided
  ) p
  where p.wr is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.generate_content_strategy_recommendations(int) is
  'S2: genereert content_strategy_recommendations uit v_hook_patterns (win-rate over besliste videos).';

-- ── 4) Consumeerbare view (producer/director/dashboard) ──────────────────────
create or replace view public.v_content_recommendations_current as
select id, platform, niche, category, dimension, action, recommendation,
       confidence, win_rate, sample_n, evidence, generated_at
from public.content_strategy_recommendations
where status = 'active'
order by (action in ('increase','stop')) desc, confidence desc, sample_n desc;

comment on view public.v_content_recommendations_current is
  'S2: actuele actieve content-aanbevelingen, hoogste-impact eerst.';

-- ── 5) Engine Planner-registratie ───────────────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('content:learning-loop',           'media', 'S2 Learning-loop checkpoints (CF2 video_projects)',                         'youtube', true),
  ('content:strategy-recommendations','media', 'S2 Strategy recommendations (v_hook_patterns -> content_strategy_recommendations)', 'youtube', true)
on conflict (engine_key) do nothing;
