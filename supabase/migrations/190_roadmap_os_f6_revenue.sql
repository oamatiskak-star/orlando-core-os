-- 190_roadmap_os_f6_revenue.sql
-- Roadmap OS F6 — omzet-laag (data-gated). Additieve revenue-target op milestones +
-- holding-brede omzetpositie-view + per-entiteit rollup. Read-only views, geen datamutatie.
-- GEEN gefabriceerde bedragen: alles leeg/0 tot mens of Moneybird vult.
-- Eindtoetssteen: "afstand tot volgende omzetmijlpaal" wordt berekenbaar zodra een
-- holding_milestone een revenue_target krijgt.

alter table public.holding_milestones add column if not exists revenue_target numeric(14,2);
alter table public.holding_milestones add column if not exists revenue_target_currency text default 'EUR';

create or replace view public.v_ceo_revenue_position as
with tot as (
  select
    (select coalesce(sum(expected_revenue_amount),0) from public.build_tracker) as total_expected,
    (select coalesce(sum(ar.actual_amount),0) from public.account_revenues ar)   as total_actual
),
nxt as (
  select naam, revenue_target, revenue_target_currency, target_date
  from public.holding_milestones
  where revenue_target is not null and coalesce(status,'') not in ('done','completed','live')
  order by case when target_date is not null then 0 else 1 end, target_date asc nulls last, milestone_nr
  limit 1
)
select
  t.total_expected, t.total_actual,
  n.naam as next_milestone, n.revenue_target as next_target,
  coalesce(n.revenue_target_currency,'EUR') as currency, n.target_date as next_date,
  case when n.revenue_target is not null then greatest(0, n.revenue_target - t.total_actual) end as distance_to_target,
  case when n.revenue_target is not null and n.revenue_target > 0 then round(100 * t.total_actual / n.revenue_target) else null end as pct_to_target
from tot t left join nxt n on true;

create or replace view public.v_ceo_revenue_by_entity as
select c.slug as entity_slug, c.name as entity_name,
  coalesce(sum(b.expected_revenue_amount),0) as expected,
  coalesce((select sum(ar.actual_amount) from public.account_setups s
     join public.account_revenues ar on ar.account_setup_id = s.id
     where s.build_task_id in (select id from public.build_tracker where company_id = c.id)),0) as actual
from public.companies c
left join public.build_tracker b on b.company_id = c.id
where c.slug is not null
group by c.id, c.slug, c.name;

grant select on public.v_ceo_revenue_position, public.v_ceo_revenue_by_entity to authenticated, anon;
