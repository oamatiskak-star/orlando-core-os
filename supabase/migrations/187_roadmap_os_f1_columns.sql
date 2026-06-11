-- 187_roadmap_os_f1_columns.sql
-- Roadmap OS F1 — additieve kolommen + backfill (BESLOTEN A/B/C).
-- A: expliciete build_tracker.priority (P0-P3), mens-leidend; suggested_priority = systeemvoorstel.
-- B: holding_milestones.target_date (echte deadlines/commitments).
-- C: started_at backfill (proxy created_at) zodat de Gantt een startdatum heeft.
-- ALLEEN additief + idempotent. target_at/target_date worden NIET gefabriceerd (commitments = mens-invoer);
-- geschatte einddatums leeft alleen in de view (188, end_source='estimated'), niet als opgeslagen feit.

-- ── A. prioriteit (expliciet, mens-leidend) ────────────────────────────────
alter table public.build_tracker add column if not exists priority text
  check (priority in ('P0','P1','P2','P3'));
alter table public.build_tracker add column if not exists suggested_priority text
  check (suggested_priority in ('P0','P1','P2','P3'));
alter table public.build_tracker add column if not exists priority_source_reason text;

-- systeemvoorstel (heuristiek v1) — transparant via source_reason; mens overschrijft `priority`
update public.build_tracker set
  suggested_priority = case
    when status in ('failed','paused')                 then 'P0'
    when coalesce(expected_revenue_amount,0) > 0       then 'P0'
    when status in ('deploying','testing')             then 'P1'
    when status = 'building'                           then 'P1'
    when status = 'planned'                            then 'P2'
    when status = 'live'                               then 'P3'
    else 'P2' end,
  priority_source_reason = 'heuristic_v1:status+revenue'
where suggested_priority is null;

-- seed `priority` = voorstel als startpunt (mens-bevestigd later); blijft overschrijfbaar
update public.build_tracker set priority = suggested_priority where priority is null;

-- ── B. milestone-deadlines (echte commitments; leeg tot mens-invoer) ───────
alter table public.holding_milestones add column if not exists target_date date;

-- ── C. Gantt-start backfill (defensieve proxy; einddatum NIET gefabriceerd) ─
update public.build_tracker set started_at = created_at where started_at is null;

-- index voor roadmap-sortering
create index if not exists idx_build_tracker_priority on public.build_tracker (priority);
create index if not exists idx_holding_milestones_target_date on public.holding_milestones (target_date);
