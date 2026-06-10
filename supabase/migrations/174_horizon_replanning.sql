-- 174_horizon_replanning.sql
-- CF2 Fase 5F — Horizon Replanning. Content Horizon is niet statisch: bij nieuwe winner /
-- nieuwe nichetrend / nieuwe viral opportunity herberekent de planner zichzelf.
-- Buffer max 48u (plan_content_horizon, migr 166, plant op now()+48u).
-- ADDITIEF + idempotent. HARDE GATE: niet auto-toepassen. De trigger wordt NIET aangehecht
-- (= activatie); de functie + log staan klaar. Geen worker/engine aangezet.

create table if not exists public.cf2_replan_log (
  id          uuid primary key default gen_random_uuid(),
  reason      text not null,                     -- 'new_winner' | 'new_trend' | 'new_opportunity' | 'manual'
  signal_ref  text,
  planned     integer,                           -- aantal horizon-items na herberekening
  ran_at      timestamptz not null default now()
);

-- Herbereken het horizon-plan + log. Gated wrapper rond plan_content_horizon (166).
create or replace function public.request_horizon_replan(p_reason text default 'manual', p_signal_ref text default null)
returns integer language plpgsql as $fn$
declare v_n int := 0;
begin
  -- alleen herplannen als de engine is aangezet (gated); anders enkel loggen met planned=null
  if public.engine_window_open('content:horizon-planner') then
    v_n := public.plan_content_horizon();
  else
    v_n := null;
  end if;
  insert into public.cf2_replan_log(reason, signal_ref, planned) values (p_reason, p_signal_ref, v_n);
  return coalesce(v_n, 0);
end $fn$;

-- Trigger-functie GEREED (niet aangehecht). Activatie = de CREATE TRIGGER-regels onderaan
-- uitvoeren (aparte go). Bij een nieuwe viral opportunity met hoge virality → replan-request.
create or replace function public.trg_horizon_on_signal()
returns trigger language plpgsql as $fn$
begin
  if (tg_table_name = 'viral_opportunities' and coalesce(new.virality_score,0) >= 80)
     or (tg_table_name = 'winner_extraction_jobs') then
    perform public.request_horizon_replan(
      case when tg_table_name = 'winner_extraction_jobs' then 'new_winner' else 'new_opportunity' end,
      new.id::text);
  end if;
  return new;
end $fn$;

grant select on public.cf2_replan_log to authenticated, anon;

-- ── ACTIVATIE (NIET uitgevoerd — aparte go van Orlando) ──────────────────────────
-- create trigger horizon_replan_on_viral after insert on public.viral_opportunities
--   for each row execute function public.trg_horizon_on_signal();
-- create trigger horizon_replan_on_winner after insert on public.winner_extraction_jobs
--   for each row execute function public.trg_horizon_on_signal();
