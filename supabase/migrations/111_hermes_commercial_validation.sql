-- ============================================================================
-- Migration 111: Hermes Commercial Validation Engine (Prioriteit 0A)
-- ============================================================================
-- Depends on: 104 (hermes schema + touch_updated_at), 109 (governance)
-- Doel: NIET "werkt het" maar "wil iemand BETALEN". Hermes beoordeelt elke
--       pagina door de ogen van een KRITISCHE koper per doelgroep ("glas azijn
--       in de mond") en bepaalt per persona: begrijp ik het / vertrouw ik het /
--       zou ik betalen / waarom NIET / wat mist. Gate: marketing schaalt pas op
--       als alle vereiste persona's "zouden kopen" in de simulatie.
-- Additief/idempotent. NIET op prod toegepast — hard gate (Orlando).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RUNS — één commerciële validatie-batch
-- ----------------------------------------------------------------------------
create table if not exists hermes.commercial_validation_runs (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null default 'aquier',
  country         text,                                  -- 'NL' | 'US' | null=alle
  status          text not null default 'queued' check (status in ('queued','running','done','error')),
  total_evals     int not null default 0,                -- pagina × persona
  would_buy_count int not null default 0,
  personas_passed jsonb not null default '[]'::jsonb,    -- persona-slugs die "zouden kopen"
  gate_open       boolean not null default false,        -- alle vereiste persona's kopen → marketing mag opschalen
  summary         jsonb not null default '{}'::jsonb,
  model           text,
  triggered_by    text default 'manual',
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists hermes_cvr_status_idx on hermes.commercial_validation_runs (status, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. EVALUATIES — per pagina × persona, kritische-koper-oordeel
-- ----------------------------------------------------------------------------
create table if not exists hermes.commercial_validation (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid references hermes.commercial_validation_runs(id) on delete cascade,
  page_url              text not null,
  page_kind             text,                            -- homepage|product|audience|pricing|checkout|...
  persona               text not null,                   -- ontwikkelaar|investeerder|makelaar|bemiddelaar|family_office|financier|bankier
  country               text not null default 'NL',
  -- 7 kernvragen
  q1_understand_5s      boolean,                          -- begrijp ik <5s wat Aquier doet
  q2_relevant_10s       boolean,                          -- <10s waarom relevant voor mij
  q3_what_i_get         boolean,                          -- begrijp ik wat ik krijg
  q4_what_it_costs      boolean,                          -- begrijp ik wat het kost
  q5_trust_score        int check (q5_trust_score between 1 and 10),
  why_not_buy           jsonb not null default '[]'::jsonb,   -- volledige lijst redenen om NIET te kopen
  missing_info          jsonb not null default '[]'::jsonb,   -- ontbrekende informatie
  -- koopbesluit + conversie
  would_buy             boolean,                          -- de kernvraag
  unanswered_objections jsonb not null default '[]'::jsonb,
  missing_cta           jsonb not null default '[]'::jsonb,
  persona_answers       jsonb not null default '{}'::jsonb,   -- persona-specifieke Q&A
  conversion_scores     jsonb not null default '{}'::jsonb,   -- {trust,authority,clarity,urgency,proof,conversion} 1-10
  language_verdict      jsonb not null default '{}'::jsonb,   -- {klinkt_vastgoed,professioneel,geen_ai_jargon,lokalisatie_ok}
  verdict               text,                             -- korte samenvatting
  created_at            timestamptz not null default now()
);
create index if not exists hermes_cv_run_idx on hermes.commercial_validation (run_id);
create index if not exists hermes_cv_persona_idx on hermes.commercial_validation (persona, would_buy);
create index if not exists hermes_cv_page_idx on hermes.commercial_validation (page_url);

-- ----------------------------------------------------------------------------
-- 3. GATE-VIEW — koopt elke vereiste persona? (laatste run per scope)
-- ----------------------------------------------------------------------------
create or replace view hermes.v_commercial_gate as
with latest as (
  select id, scope, country from hermes.commercial_validation_runs
  where status='done' order by created_at desc limit 1
)
select cv.persona,
       count(*)                                   as evals,
       count(*) filter (where cv.would_buy)       as would_buy,
       round(avg(cv.q5_trust_score)::numeric, 1)  as avg_trust,
       bool_or(cv.would_buy)                       as buys_somewhere,
       bool_and(coalesce(cv.would_buy, false))     as buys_everywhere
from hermes.commercial_validation cv
join latest l on l.id = cv.run_id
group by cv.persona;

comment on view hermes.v_commercial_gate is
  'Per persona of ze zouden kopen (laatste done-run). Marketing schaalt pas op als de vereiste persona''s buys_somewhere=true.';

-- ----------------------------------------------------------------------------
-- 4. Capability-skill registreren (capability-based, on-demand)
-- ----------------------------------------------------------------------------
insert into hermes.skills (name, version, checksum, description, enabled)
values ('commercial_validation','1.0.0', md5('commercial_validation1.0.0'),
        'Kritische-koper-validatie per pagina×persona ("glas azijn"): begrijp/vertrouw/zou-ik-betalen/waarom-niet + conversie + taalvalidatie + go-live gate', false)
on conflict (name, version) do nothing;

-- ----------------------------------------------------------------------------
-- 5. RLS + triggers + grants (patroon mig 106/109)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['commercial_validation_runs','commercial_validation'] loop
    execute format('alter table hermes.%I enable row level security;', t);
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='service_role_full') then
      execute format($p$create policy "service_role_full" on hermes.%I as permissive for all to service_role using (true) with check (true);$p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='auth_read') then
      execute format($p$create policy "auth_read" on hermes.%I for select to authenticated using (true);$p$, t);
    end if;
    execute format('grant all on hermes.%I to service_role;', t);
    execute format('grant select on hermes.%I to authenticated;', t);
  end loop;
end $$;

drop trigger if exists trg_cvr_touch on hermes.commercial_validation_runs;
create trigger trg_cvr_touch before update on hermes.commercial_validation_runs
  for each row execute function hermes.touch_updated_at();

grant select on hermes.v_commercial_gate to authenticated, service_role;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop view if exists hermes.v_commercial_gate;
-- drop table if exists hermes.commercial_validation;
-- drop table if exists hermes.commercial_validation_runs;
-- delete from hermes.skills where name='commercial_validation';
