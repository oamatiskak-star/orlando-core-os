-- 071_evaluate_actief.sql
-- Function die alle category=youtube + status=actief kansen onderling
-- vergelijkt op composite score en de top N markeert als 'gewonnen'.
--
-- Composite score (0-100):
--   - ai_score (0-100)                : weight 40%
--   - potential_value normalized      : weight 30%
--   - probability_pct (0-100)         : weight 20%
--   - age_decay (newer = better)      : weight 10%

create or replace function public.evaluate_actief_opportunities(
  p_top_n integer default 1,
  p_min_score numeric default 60
)
returns table (
  id            uuid,
  title         text,
  composite     numeric,
  ai_score      integer,
  potential_value numeric,
  probability_pct integer,
  promoted      boolean
)
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_max_value numeric;
  v_max_age   numeric;
begin
  select coalesce(max(potential_value), 1),
         coalesce(max(extract(epoch from (now() - updated_at)) / 3600), 1)
    into v_max_value, v_max_age
    from public.osil_opportunities
   where category = 'youtube' and status = 'actief';

  return query
  with ranked as (
    select
      o.id, o.title, o.ai_score, o.potential_value, o.probability_pct,
      round(
        (coalesce(o.ai_score, 0) * 0.40)
        + (coalesce(o.potential_value, 0) / nullif(v_max_value, 0) * 100 * 0.30)
        + (coalesce(o.probability_pct, 0) * 0.20)
        + ((1 - extract(epoch from (now() - o.updated_at)) / 3600 / nullif(v_max_age, 0)) * 100 * 0.10),
        2
      ) as composite_score,
      row_number() over (
        order by
          (coalesce(o.ai_score, 0) * 0.40)
          + (coalesce(o.potential_value, 0) / nullif(v_max_value, 0) * 100 * 0.30)
          + (coalesce(o.probability_pct, 0) * 0.20)
          + ((1 - extract(epoch from (now() - o.updated_at)) / 3600 / nullif(v_max_age, 0)) * 100 * 0.10)
          desc
      ) as rnk
    from public.osil_opportunities o
    where o.category = 'youtube' and o.status = 'actief'
  ),
  decisions as (
    select r.*, (r.rnk <= p_top_n and r.composite_score >= p_min_score) as should_promote
      from ranked r
  ),
  promoted_update as (
    update public.osil_opportunities o
       set status = 'gewonnen', updated_at = now()
      from decisions d
     where o.id = d.id and d.should_promote
    returning o.id
  )
  select d.id, d.title, d.composite_score, d.ai_score, d.potential_value, d.probability_pct, d.should_promote
    from decisions d
   order by d.rnk;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper RPC: alleen ranking tonen zonder promote (dry-run)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.rank_actief_opportunities()
returns table (
  id            uuid,
  title         text,
  composite     numeric,
  ai_score      integer,
  potential_value numeric,
  probability_pct integer,
  rank          integer
)
language plpgsql
stable
security definer
set search_path = public
as $f$
declare
  v_max_value numeric;
  v_max_age   numeric;
begin
  select coalesce(max(potential_value), 1),
         coalesce(max(extract(epoch from (now() - updated_at)) / 3600), 1)
    into v_max_value, v_max_age
    from public.osil_opportunities
   where category = 'youtube' and status = 'actief';

  return query
  select
    o.id, o.title,
    round(
      (coalesce(o.ai_score, 0) * 0.40)
      + (coalesce(o.potential_value, 0) / nullif(v_max_value, 0) * 100 * 0.30)
      + (coalesce(o.probability_pct, 0) * 0.20)
      + ((1 - extract(epoch from (now() - o.updated_at)) / 3600 / nullif(v_max_age, 0)) * 100 * 0.10),
      2
    ) as composite,
    o.ai_score, o.potential_value, o.probability_pct,
    (row_number() over (
      order by
        (coalesce(o.ai_score, 0) * 0.40)
        + (coalesce(o.potential_value, 0) / nullif(v_max_value, 0) * 100 * 0.30)
        + (coalesce(o.probability_pct, 0) * 0.20)
        + ((1 - extract(epoch from (now() - o.updated_at)) / 3600 / nullif(v_max_age, 0)) * 100 * 0.10)
        desc
    ))::int as rank
    from public.osil_opportunities o
    where o.category = 'youtube' and o.status = 'actief'
    order by 6 asc;
end
$f$;
