-- ============================================================================
-- Migration 109: Hermes Governance Foundation (P3)
-- ============================================================================
-- Depends on: 104 (hermes schema + touch_updated_at), 106 (RLS-patroon)
-- Doel: de 9 ontbrekende governance/validatie-tabellen + capability-registry.
--       Volledig additief. Geen bestaande objecten gewijzigd. No-mock:
--       tabellen worden door de validator/engines gevuld, geen seed-data
--       behalve de capability-skills (declaratief, enabled=false → on-demand).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDIT_SESSIONS — groepeert validatie-runs tot één audit
-- ----------------------------------------------------------------------------
create table if not exists hermes.audit_sessions (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  scope       text not null default 'platform',
  status      text not null default 'open' check (status in ('open','running','done','cancelled')),
  summary     jsonb not null default '{}'::jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. REPAIR_SUGGESTIONS — voorbereide 1-click reparaties (nog niet autonoom)
-- ----------------------------------------------------------------------------
create table if not exists hermes.repair_suggestions (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('patch','migration','route','permission','component','config')),
  title           text not null,
  detail          text,
  proposed_change jsonb not null default '{}'::jsonb,
  confidence      numeric(5,2) not null default 0,
  status          text not null default 'suggested' check (status in ('suggested','approved','applied','dismissed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. VALIDATION_RUNS — één validatie-uitvoering (persona/scope/score)
-- ----------------------------------------------------------------------------
create table if not exists hermes.validation_runs (
  id               uuid primary key default gen_random_uuid(),
  audit_session_id uuid references hermes.audit_sessions(id) on delete set null,
  run_kind         text not null default 'route',          -- route|workflow|ai|entitlement|flow
  target_scope     text,                                   -- bv. 'aquier' | 'orlando-core-os'
  persona          text,                                   -- ontwikkelaar/investeerder/makelaar/...
  status           text not null default 'queued'
                     check (status in ('queued','running','passed','failed','error','cancelled')),
  total_checks     int not null default 0,
  passed           int not null default 0,
  failed           int not null default 0,
  production_score numeric(5,2),
  severity_summary jsonb not null default '{}'::jsonb,      -- {critical:n,high:n,...}
  triggered_by     text default 'manual',
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists hermes_validation_runs_status_idx on hermes.validation_runs (status, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. VALIDATION_ERRORS — individuele bevindingen per run
-- ----------------------------------------------------------------------------
create table if not exists hermes.validation_errors (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references hermes.validation_runs(id) on delete cascade,
  route               text,
  check_kind          text not null,                        -- http|render|auth|hydration|form|websocket|entitlement|ai|checkout
  severity            text not null check (severity in ('critical','high','medium','low')),
  title               text not null,
  detail              text,
  evidence            jsonb not null default '{}'::jsonb,
  suggested_repair_id uuid references hermes.repair_suggestions(id) on delete set null,
  status              text not null default 'open' check (status in ('open','ack','resolved','ignored')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists hermes_validation_errors_run_idx on hermes.validation_errors (run_id, severity);
create index if not exists hermes_validation_errors_open_idx on hermes.validation_errors (status) where status='open';

-- ----------------------------------------------------------------------------
-- 5. VALIDATION_LOGS — ruwe stap-logs per run (append-only)
-- ----------------------------------------------------------------------------
create table if not exists hermes.validation_logs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references hermes.validation_runs(id) on delete cascade,
  level      text not null default 'info' check (level in ('debug','info','warn','error')),
  event      text not null,
  message    text,
  context    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hermes_validation_logs_run_idx on hermes.validation_logs (run_id, created_at);

-- ----------------------------------------------------------------------------
-- 6. ROUTE_REGISTRY — auto-discovered routes (self-registering, P10/discovery)
-- ----------------------------------------------------------------------------
create table if not exists hermes.route_registry (
  id            uuid primary key default gen_random_uuid(),
  app           text not null,                              -- front|dashboard|api|realtime
  path          text not null,
  method        text not null default 'GET',
  kind          text,                                       -- page|api|webhook|cron
  auth_required boolean not null default false,
  roles         jsonb not null default '[]'::jsonb,
  last_status   int,
  is_orphan     boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (app, path, method)
);
create index if not exists hermes_route_registry_orphan_idx on hermes.route_registry (is_orphan) where is_orphan;

-- ----------------------------------------------------------------------------
-- 7. ENTITLEMENTS — product/tier -> capability matrix (commercieel)
-- ----------------------------------------------------------------------------
create table if not exists hermes.entitlements (
  id             uuid primary key default gen_random_uuid(),
  product_slug   text not null,                             -- scout|developer|black|institutional|family_office|...
  tier           text,
  capability_key text not null,                             -- dashboard|ai_module|upload|export|analysis|pdf|notifications|api|storage|workflow
  allowed        boolean not null default false,
  limit_value    numeric,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_slug, tier, capability_key)
);

-- ----------------------------------------------------------------------------
-- 8. PRODUCTION_SCORES — live-readiness per dimensie (append-only tijdreeks)
-- ----------------------------------------------------------------------------
create table if not exists hermes.production_scores (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references hermes.validation_runs(id) on delete set null,
  scope       text not null default 'platform',
  dimension   text not null,                                -- infra|routes|products|ai|flows|payments|onboarding|ux|performance|reliability|automation|security|recoverability
  score       numeric(5,2) not null default 0,
  severity    text check (severity in ('critical','high','medium','low')),
  computed_at timestamptz not null default now()
);
create index if not exists hermes_production_scores_dim_idx on hermes.production_scores (dimension, computed_at desc);

-- ----------------------------------------------------------------------------
-- 9. FLOW_TESTS — persona-flow definities + laatste resultaat
-- ----------------------------------------------------------------------------
create table if not exists hermes.flow_tests (
  id               uuid primary key default gen_random_uuid(),
  persona          text not null,                           -- investeerder/makelaar/bemiddelaar/aannemer/architect/koper/huurder/affiliate/admin/support
  flow_key         text not null,                           -- onboarding|checkout|upload|analysis|export|...
  steps            jsonb not null default '[]'::jsonb,
  last_run_id      uuid references hermes.validation_runs(id) on delete set null,
  last_status      text default 'pending' check (last_status in ('pending','passed','failed','error')),
  ux_score         numeric(5,2),
  readiness_score  numeric(5,2),
  last_run_at      timestamptz,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (persona, flow_key)
);

-- ----------------------------------------------------------------------------
-- 10. CAPABILITY REGISTRY — 15 skills (capability-based, on-demand)
--     enabled=false: alleen uitvoeren wanneer nodig (geen 25 permanente agents).
-- ----------------------------------------------------------------------------
-- checksum is NOT NULL op hermes.skills → md5(name||version) als declaratieve hash.
insert into hermes.skills (name, version, checksum, description, enabled)
select s.name, '1.0.0', md5(s.name || '1.0.0'), s.descr, false
from (values
  ('validation',          'Route/flow/AI validatie → validation_runs/errors'),
  ('entitlement',         'Product/tier capability-check tegen entitlements'),
  ('flow_test',           'Persona-flow simulatie (onboarding→checkout→export)'),
  ('discovery',           'Auto-discovery van routes/features → route_registry'),
  ('repair',              'Repair/patch/migratie-suggesties → repair_suggestions'),
  ('marketing',           'Marketing-orchestratie (staging, geen massale productie)'),
  ('seo',                 'Keyword-onderzoek + on-page SEO'),
  ('content',             'Contentgeneratie (gegrond, no-mock)'),
  ('social',              'Social distributie (FB/YT/affiliate staging)'),
  ('analytics',           'Funnel/conversie-analyse'),
  ('finance',             'Finance readiness scoring (Capital Desk)'),
  ('capital_matching',    'Match project ↔ financieringstype/kapitaal'),
  ('project_intelligence','Completeness/risk/financeability-duiding'),
  ('ui_audit',            'Design-consistentie + UX-readiness audit'),
  ('route_audit',         'Route-integriteit + orphan/dead-route detectie')
) as s(name, descr)
on conflict (name, version) do nothing;

-- ----------------------------------------------------------------------------
-- 11. RLS — service_role full + authenticated read (patroon migratie 106)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['audit_sessions','repair_suggestions','validation_runs','validation_errors',
                           'validation_logs','route_registry','entitlements','production_scores','flow_tests'] loop
    execute format('alter table hermes.%I enable row level security;', t);
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='service_role_full') then
      execute format($p$
        create policy "service_role_full" on hermes.%I
        as permissive for all to service_role using (true) with check (true);
      $p$, t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='auth_read') then
      execute format($p$
        create policy "auth_read" on hermes.%I for select to authenticated using (true);
      $p$, t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 12. Triggers (updated_at) op de muteerbare tabellen
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['audit_sessions','repair_suggestions','validation_runs','validation_errors',
                           'route_registry','entitlements','flow_tests'] loop
    execute format('drop trigger if exists trg_%s_touch on hermes.%I;', t, t);
    execute format('create trigger trg_%s_touch before update on hermes.%I for each row execute function hermes.touch_updated_at();', t, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 13. GRANTs
-- ----------------------------------------------------------------------------
grant usage on schema hermes to service_role;
do $$
declare t text;
begin
  foreach t in array array['audit_sessions','repair_suggestions','validation_runs','validation_errors',
                           'validation_logs','route_registry','entitlements','production_scores','flow_tests'] loop
    execute format('grant all on hermes.%I to service_role;', t);
    execute format('grant select on hermes.%I to authenticated;', t);
  end loop;
end $$;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop table if exists hermes.flow_tests, hermes.production_scores, hermes.entitlements,
--   hermes.route_registry, hermes.validation_logs, hermes.validation_errors,
--   hermes.validation_runs, hermes.repair_suggestions, hermes.audit_sessions cascade;
-- delete from hermes.skills where name in ('validation','entitlement','flow_test','discovery','repair',
--   'marketing','seo','content','social','analytics','finance','capital_matching','project_intelligence','ui_audit','route_audit');
