-- 211 — Autonomous Offer Engine (greenfield)
-- Stelt EIGEN aanbod voor (rapport/calculator/template/cursus/membership/community)
-- per monetiseerbare niche, gerangschikt op demand × marge. PROPOSE-ONLY: de engine
-- maakt nooit een offer live; een mens beslist (status proposed -> approved/rejected).
-- Deterministische bron (altijd werkt) over echte niche-signalen; AI verrijkt optioneel
-- titel/omschrijving met graceful degradation (zie /api/media-holding/offer-engine/propose).

-- ── kandidaten ──────────────────────────────────────────────────────────────
create table if not exists public.offer_candidates (
  id              uuid primary key default gen_random_uuid(),
  niche           text not null,
  offer_type      text not null,                 -- rapport|calculator|template|cursus|membership|community
  title           text not null,
  description     text,
  demand_signal   numeric not null default 0,    -- 0..1 over echte niche-metrics
  est_margin      numeric not null default 0,    -- 0..1 (digitale marge per type)
  est_price_eur   numeric not null default 0,
  est_monthly_eur numeric not null default 0,    -- INDICATIEVE maand-potentie (proxy, transparant)
  score           numeric not null default 0,    -- demand_signal × est_margin (rang)
  status          text not null default 'proposed',  -- proposed|approved|rejected|building|live
  source          text not null default 'deterministic', -- deterministic|ai
  rationale       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  decided_at      timestamptz,
  decided_by      text,
  unique (niche, offer_type)
);

create index if not exists idx_offer_candidates_status on public.offer_candidates(status);
create index if not exists idx_offer_candidates_score  on public.offer_candidates(score desc);

alter table public.offer_candidates enable row level security;
do $$ begin
  create policy offer_candidates_read on public.offer_candidates for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy offer_candidates_write on public.offer_candidates for all to service_role using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ── run-log ─────────────────────────────────────────────────────────────────
create table if not exists public.offer_engine_runs (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'ok',     -- ok|deterministic_fallback|error
  source          text not null default 'deterministic',
  model           text,
  fallback_reason text,
  proposed        integer not null default 0,
  enriched        integer not null default 0,
  detail          jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
alter table public.offer_engine_runs enable row level security;
do $$ begin
  create policy offer_runs_read on public.offer_engine_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ── deterministische propose-functie (altijd werkt; idempotent) ─────────────
-- Rangschikt EIGEN aanbod op demand × marge. Genereert alleen voor monetiseerbare
-- niches (buyer-intent: naam matcht finance/vastgoed/beleggen/sparen/crypto/investeren,
-- OF de niche heeft echte attributie-leads/sales). Visuele/ASMR-niches vallen af.
create or replace function public.propose_offer_candidates()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
begin
  with offer_types(offer_type, est_margin, est_price_eur, unit_kind) as (
    values
      ('rapport',    0.95::numeric,  47::numeric, 'oneoff'),
      ('calculator', 0.92::numeric,  29::numeric, 'oneoff'),
      ('template',   0.95::numeric,  19::numeric, 'oneoff'),
      ('cursus',     0.85::numeric, 197::numeric, 'oneoff'),
      ('membership', 0.80::numeric,  29::numeric, 'recurring'),
      ('community',  0.78::numeric,  39::numeric, 'recurring')
  ),
  niche_signals as (
    select
      r.niche,
      r.videos,
      coalesce(r.win_rate,0)   as win_rate,
      coalesce(r.views,0)      as views,
      coalesce(a.leads,0)      as leads,
      coalesce(a.sales,0)      as sales,
      -- demand 0..1: gewogen over echte metrics (deterministisch)
      round((
        0.50 * coalesce(r.win_rate,0)
        + 0.30 * least(1.0, ln(r.videos + 1)::numeric / ln(2000))
        + 0.20 * least(1.0, coalesce(r.views,0)::numeric / 12000.0)
      )::numeric, 3) as demand_base,
      -- buyer-intent: naam OF echte attributie
      (r.niche ~* '(finance|vastgoed|beleg|spaar|crypto|invest|geld|education_nl|wealth|money|property)'
        or coalesce(a.leads,0) > 0 or coalesce(a.sales,0) > 0) as eligible
    from public.v_niche_ranking r
    left join public.v_attribution_niche a on a.niche = r.niche
  ),
  candidates as (
    select
      s.niche, o.offer_type, o.est_margin, o.est_price_eur,
      -- buyer-intent boost als er echte attributie is
      least(1.0, s.demand_base + case when s.leads > 0 or s.sales > 0 then 0.15 else 0 end) as demand_signal,
      o.unit_kind
    from niche_signals s
    cross join offer_types o
    where s.eligible
  )
  insert into public.offer_candidates
    (niche, offer_type, title, description, demand_signal, est_margin, est_price_eur, est_monthly_eur, score, source, rationale)
  select
    c.niche,
    c.offer_type,
    -- deterministische titel/omschrijving (AI kan later verrijken)
    initcap(replace(c.offer_type,'_',' ')) || ' — ' || replace(initcap(replace(c.niche,'_',' ')), 'Nl', 'NL'),
    'Voorgesteld ' || c.offer_type || ' voor niche "' || c.niche || '". Deterministisch gegenereerd uit niche-vraagsignalen; titel/omschrijving optioneel AI-verrijkt.',
    round(c.demand_signal, 3),
    c.est_margin,
    c.est_price_eur,
    -- INDICATIEVE maand-potentie (proxy): prijs × vraag-gedreven eenheden;
    -- recurring telt 3× (abonnement-stapeling), one-off 1×. Transparant geen harde voorspelling.
    round(c.est_price_eur * (c.demand_signal * 40) * (case when c.unit_kind='recurring' then 3 else 1 end), 0),
    round(c.demand_signal * c.est_margin, 4),
    'deterministic',
    'demand_signal=' || round(c.demand_signal,3) || ' × marge=' || c.est_margin || ' → score ' || round(c.demand_signal * c.est_margin,4)
  from candidates c
  on conflict (niche, offer_type) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
exception when others then
  -- fail-open: nooit hard falen
  return -1;
end;
$$;

grant execute on function public.propose_offer_candidates() to authenticated, service_role;

-- ── scoring/rang-view (demand × marge) ──────────────────────────────────────
create or replace view public.v_offer_candidate_scores as
select
  oc.*,
  rank() over (order by oc.score desc, oc.est_monthly_eur desc) as score_rank,
  rank() over (partition by oc.niche order by oc.score desc)     as niche_rank
from public.offer_candidates oc;

comment on view public.v_offer_candidate_scores is
  'Offer-kandidaten gerangschikt op demand × marge (score) + indicatieve maand-potentie. Propose-only.';

-- ── Engine Planner-registratie (VUISTREGEL) ─────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('offer:propose', 'media', 'Offer Engine — aanbod-voorstellen', 'youtube', true)
on conflict (engine_key) do nothing;
