-- ============================================================================
-- Migration 159: Hermes Daily Priority Steering
-- ============================================================================
-- Depends on: 087/088 (build_tracker), 096 (holding_milestones),
--             113/114 (build_priority_queue, build_autonomy_score),
--             155 (build_tracker_items), 158 (tracker_sync_log)
-- Doel: Hermes bepaalt elke dag (06:00) over alle BV's heen welke taken eerst
--       gestart worden, ALTIJD teruggeleid naar het Master Businessplan en het
--       jaar-1 omzetdoel €2.880.000. Vaste businessplanvolgorde Fase A→B→C; binnen
--       een fase sorteert revenue → delivery → blocker → dependency.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUSINESSPLAN-REFERENTIE — fases + jaar-1 omzetdoel (de "waarom"-anker)
-- ----------------------------------------------------------------------------
create table if not exists hermes.businessplan_phases (
  phase_key   text primary key,            -- 'A' | 'B' | 'C'
  sort_order  int  not null,
  label       text not null,
  description text not null,
  value_focus text not null
);

insert into hermes.businessplan_phases (phase_key, sort_order, label, description, value_focus) values
  ('A', 1, 'Fase A — Commerciële kern',
        'Commercial truth, productflow, betaling, delivery, identity, dashboard, eerste omzet.',
        'directe omzet + delivery'),
  ('B', 2, 'Fase B — NL cashflow-motor',
        'NL cashflow engine, rapporten, membership, affiliates, SEO, distributie, Moneybird.',
        'herhaalbare cashflow'),
  ('C', 3, 'Fase C — Schaal',
        'Schaalmodules, CF2, internationalisatie, Capital Desk, enterprise, API, white label.',
        'schaal na commerciële keten')
on conflict (phase_key) do update set
  sort_order = excluded.sort_order, label = excluded.label,
  description = excluded.description, value_focus = excluded.value_focus;

create table if not exists hermes.businessplan_meta (
  id                uuid primary key default gen_random_uuid(),
  year              int  not null,
  revenue_target_y1 numeric(14,2) not null,
  currency          text not null default 'EUR',
  note              text,
  is_current        boolean not null default true,
  created_at        timestamptz not null default now()
);

insert into hermes.businessplan_meta (year, revenue_target_y1, currency, note, is_current)
select 1, 2880000.00, 'EUR', 'Master Businessplan jaar-1 omzetdoel (P50 forecast Aquier + ecosysteem)', true
where not exists (select 1 from hermes.businessplan_meta where is_current);

-- ----------------------------------------------------------------------------
-- 2. DAGPRIORITEIT-TABEL — dagelijkse snapshot per BV/taak
-- ----------------------------------------------------------------------------
create table if not exists hermes.daily_priority_items (
  id                    uuid primary key default gen_random_uuid(),
  plan_date             date not null default current_date,
  company_id            uuid,
  build_id              uuid references public.build_tracker(id) on delete set null,
  tracker_item_id       uuid references public.build_tracker_items(id) on delete set null,
  entity                text,
  module                text,
  priority_rank         int  not null,
  priority_reason       text,
  businessplan_phase    text,
  linked_milestone      text,
  revenue_impact_score  int  not null default 0,
  delivery_impact_score int  not null default 0,
  blocker_score         int  not null default 0,
  dependency_score      int  not null default 0,
  recommended_owner     text,
  recommended_start_today boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists hermes_daily_priority_date_idx    on hermes.daily_priority_items (plan_date);
create index if not exists hermes_daily_priority_company_idx on hermes.daily_priority_items (company_id);
create index if not exists hermes_daily_priority_rank_idx    on hermes.daily_priority_items (plan_date, priority_rank);

-- ----------------------------------------------------------------------------
-- 3. GENERATOR — herbereken dagprioriteit (idempotent per dag)
--    Bron: build_tracker × build_priority_queue × build_autonomy_score ×
--          holding_milestones (value_stage→omzet) × canonieke sectie-C blockers.
-- ----------------------------------------------------------------------------
create or replace function hermes.generate_daily_priority_order(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
begin
  delete from hermes.daily_priority_items where plan_date = p_date;

  with base as (
    select
      bt.id            as build_id,
      bt.company_id,
      bt.name,
      bt.status,
      bt.owner,
      bt.current_milestone,
      bt.description,
      lower(concat_ws(' ', bt.name, coalesce(bt.description,''), coalesce(bt.current_milestone,''))) as hay,
      c.slug           as company_slug,
      c.name           as company_name,
      bpq.current_priority,
      coalesce(bpq.depends_on_count, 0) as depends_on_count,
      coalesce(bpq.blocked_by_count, 0) as blocked_by_count,
      bas.autonomy_level,
      hm.naam          as milestone_naam,
      hm.value_stage
    from public.build_tracker bt
    join public.companies c on c.id = bt.company_id
    left join public.build_priority_queue bpq on bpq.build_id = bt.id
    left join public.build_autonomy_score bas on bas.build_id = bt.id
    left join lateral (
      select hm.naam, hm.value_stage
      from public.holding_milestones hm
      where hm.fundament ilike '%' || bt.name || '%'
         or hm.naam ilike '%' || bt.name || '%'
      order by hm.progress_pct desc
      limit 1
    ) hm on true
    where bt.status in ('planned','paused','building','testing','deploying','failed')
  ),
  scored as (
    select
      b.*,
      -- canonieke sectie-C blocker die op deze build matcht (titel)
      (select i.id from public.build_tracker_items i
         join public.build_tracker_documents d on d.id = i.document_id
        where d.is_current and i.section = 'C' and i.title ilike '%' || b.name || '%'
        limit 1) as canonical_blocker_item,
      -- gekoppelde canonieke actie (sectie E) — voor tracer
      (select i.id from public.build_tracker_items i
         join public.build_tracker_documents d on d.id = i.document_id
        where d.is_current and i.section in ('E','C') and i.title ilike '%' || b.name || '%'
        order by i.section limit 1) as linked_item,
      -- revenue
      least(100,
        (case
           when b.value_stage in ('RECURRING','SOFTWARE','SERVICES') then 80
           when b.value_stage in ('TRAFFIC','MEDIA','LEADS') then 55
           when b.value_stage is null then 40 else 30 end)
        + (case when b.hay ~ '(betaling|checkout|membership|stripe|omzet|revenue|pricing|abonnement|mandaat)' then 20 else 0 end)
      ) as revenue_impact_score,
      -- delivery (sold = delivered risico)
      least(100,
        (case b.status
           when 'failed' then 90 when 'building' then 60 when 'testing' then 60
           when 'deploying' then 65 when 'paused' then 50 when 'planned' then 30 else 20 end)
        + (case when b.hay ~ '(delivery|levering|rapport|dossier|account|onboarding|activatie|fulfil)' then 20 else 0 end)
      ) as delivery_impact_score,
      -- blocker
      (case b.status when 'failed' then 80 when 'paused' then 50 else 10 end) as blocker_base,
      -- dependency (blokkeert anderen = urgenter; eigen deps = minder gereed)
      greatest(0, least(100, 30 + b.blocked_by_count*20 - b.depends_on_count*10)) as dependency_score
    from base b
  ),
  phased as (
    select
      s.*,
      (s.blocker_base + case when s.canonical_blocker_item is not null then 30 else 0 end) as blocker_score,
      case
        when s.value_stage in ('RECURRING','SOFTWARE','SERVICES')
          or s.hay ~ '(betaling|checkout|membership|stripe|omzet|delivery|dossier|mandaat|identity|dashboard|productflow)'
          then 'A'
        when s.hay ~ '(content factory|cf2|internationa|enterprise|white ?label|\yapi\y|schaal|capital desk)'
          or s.value_stage in ('ACQUISITIONS','HOLDING','OSIL')
          then 'C'
        when s.value_stage in ('TRAFFIC','MEDIA','LEADS')
          or s.hay ~ '(seo|affiliate|cashflow|moneybird|distributie|nieuwsbrief|rapport)'
          then 'B'
        else 'B'
      end as businessplan_phase
    from scored s
  ),
  composed as (
    select
      p.*,
      bpp.sort_order as phase_sort,
      bpp.label as phase_label,
      round(p.revenue_impact_score*0.40 + p.delivery_impact_score*0.25
            + p.blocker_score*0.20 + p.dependency_score*0.15)::int as composite
    from phased p
    join hermes.businessplan_phases bpp on bpp.phase_key = p.businessplan_phase
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        partition by c.company_id
        order by c.phase_sort asc, c.composite desc, coalesce(c.current_priority, 99) asc, c.name asc
      ) as priority_rank
    from composed c
  )
  insert into hermes.daily_priority_items (
    plan_date, company_id, build_id, tracker_item_id, entity, module,
    priority_rank, priority_reason, businessplan_phase, linked_milestone,
    revenue_impact_score, delivery_impact_score, blocker_score, dependency_score,
    recommended_owner, recommended_start_today
  )
  select
    p_date, r.company_id, r.build_id, r.linked_item, r.company_name, r.current_milestone,
    r.priority_rank,
    concat(r.phase_label, ' · omzet ', r.revenue_impact_score, ' / delivery ', r.delivery_impact_score,
           ' / blocker ', r.blocker_score, ' / dep ', r.dependency_score,
           case when r.canonical_blocker_item is not null then ' · canonieke blocker' else '' end),
    r.businessplan_phase,
    r.milestone_naam,
    r.revenue_impact_score, r.delivery_impact_score, r.blocker_score, r.dependency_score,
    coalesce(r.owner, r.company_name),
    (r.businessplan_phase = 'A'
      and coalesce(r.autonomy_level,'manual') in ('full','partial')
      and r.dependency_score >= 40
      and r.status <> 'failed')
  from ranked r;

  get diagnostics v_count = row_count;

  insert into hermes.tracker_sync_log (trigger, documents_count, items_count, updated_count, status, detail)
  values ('planner', 0, 0, v_count, 'priorities_recomputed',
          jsonb_build_object('plan_date', p_date, 'priority_items', v_count));

  return v_count;
end $$;

grant execute on function hermes.generate_daily_priority_order(date) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. VIEW — dagprioriteit van vandaag (gemak voor dashboard)
-- ----------------------------------------------------------------------------
create or replace view hermes.v_daily_priority_today as
  select * from hermes.daily_priority_items
  where plan_date = current_date
  order by company_id, priority_rank;

-- ----------------------------------------------------------------------------
-- 5. RLS + grants (patroon mig 110)
-- ----------------------------------------------------------------------------
alter table hermes.daily_priority_items enable row level security;
alter table hermes.businessplan_phases  enable row level security;
alter table hermes.businessplan_meta    enable row level security;
do $$
declare t text;
begin
  foreach t in array array['daily_priority_items','businessplan_phases','businessplan_meta'] loop
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='service_role_full') then
      execute format($p$create policy "service_role_full" on hermes.%I as permissive for all to service_role using (true) with check (true);$p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='auth_read') then
      execute format($p$create policy "auth_read" on hermes.%I for select to authenticated using (true);$p$, t);
    end if;
  end loop;
end $$;

grant all on hermes.daily_priority_items, hermes.businessplan_phases, hermes.businessplan_meta to service_role;
grant select on hermes.daily_priority_items, hermes.businessplan_phases, hermes.businessplan_meta to authenticated;
grant select on hermes.v_daily_priority_today to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. ENGINE PLANNER + pg_cron — dagelijks 06:00 (sync-enqueue dan herbereken)
-- ----------------------------------------------------------------------------
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('hermes:daily-priority-planner', 'hermes', 'Hermes Daily Priority Planner (06:00)', null, true)
on conflict (engine_key) do update set label = excluded.label, updated_at = now();

select cron.schedule(
  'hermes_daily_priority_planner',
  '0 6 * * *',
  $cron$select hermes.dispatch_canonical_sync('planner'); select hermes.generate_daily_priority_order();$cron$
);

-- Eerste vulling zodat het dashboard direct iets toont (idempotent).
select hermes.generate_daily_priority_order();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- select cron.unschedule('hermes_daily_priority_planner');
-- delete from public.engine_schedule where engine_key = 'hermes:daily-priority-planner';
-- drop view if exists hermes.v_daily_priority_today;
-- drop function if exists hermes.generate_daily_priority_order(date);
-- drop table if exists hermes.daily_priority_items;
-- drop table if exists hermes.businessplan_meta;
-- drop table if exists hermes.businessplan_phases;
