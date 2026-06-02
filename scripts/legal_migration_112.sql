-- migratie 112 — LEGAL-AI compliance-sweep tabellen (hermes schema)
-- HARD GATE: prod-migratie = Orlando-go. Niet autonoom toegepast.
-- Spiegelt de commercial_validation-structuur (mig 111).

create table if not exists hermes.legal_review_runs (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null default 'aquier',
  status        text not null default 'running',     -- running/done/failed
  model         text,
  total_pages   int,
  high_count    int default 0,
  medium_count  int default 0,
  low_count     int default 0,
  gate_open     boolean,                              -- true = geen high-risk open
  summary       jsonb,
  triggered_by  text default 'manual',
  started_at    timestamptz default now(),
  finished_at   timestamptz
);

create table if not exists hermes.legal_findings (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid references hermes.legal_review_runs(id) on delete cascade,
  page_url       text not null,
  country        text,                                -- NL/US
  category       text not null,                       -- misleidende_claims/rendement_garantie/wft_afm/avg_privacy/voorwaarden/sla_datakwaliteit/social_proof/ie_bronnen/us_en
  severity       text not null,                       -- high/medium/low
  risk_sentence  text,
  legal_basis    text,
  fix            text,
  suggested_copy text,
  status         text default 'open',                 -- open/fixed/accepted
  created_at     timestamptz not null default now()
);
create index if not exists idx_legal_findings_run on hermes.legal_findings (run_id);
create index if not exists idx_legal_findings_sev on hermes.legal_findings (severity, category);

-- Per categorie: is er een open high/medium-risico in de laatste run?
create or replace view hermes.v_legal_gate as
with latest as (select id from hermes.legal_review_runs where status='done' order by finished_at desc nulls last limit 1)
select f.category,
       count(*) filter (where f.severity='high')   as high_open,
       count(*) filter (where f.severity='medium') as medium_open,
       bool_or(f.severity in ('high','medium'))     as open_risico
from hermes.legal_findings f
where f.run_id = (select id from latest) and f.status='open'
group by f.category;
