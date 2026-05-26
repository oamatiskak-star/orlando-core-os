-- ─────────────────────────────────────────────────────────────────────────
-- Migration 099 — Account Setup Agent
-- ─────────────────────────────────────────────────────────────────────────
-- Breidt de Build Tracker uit met een Account Setup Agent-flow.
--
-- Onder elke build-taak (build_tracker rij) kan een externe account-, affiliate-,
-- partner- of social-registratie horen. De agent BEREIDT alles voor (teksten,
-- checklist, ontbrekende gegevens) maar verzendt NOOIT autonoom: handmatige
-- goedkeuring blijft verplicht (approval_required default true).
--
-- Volledig additief + idempotent (IF NOT EXISTS / ON CONFLICT). Breekt geen
-- bestaande build_tracker-logica. RLS-pariteit met build_tracker (RLS uit;
-- app-laag scoping via active company + authenticated anon client).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Canonieke statussen (gedeeld door build_tracker.account_status en
--    account_setups.status) ────────────────────────────────────────────────
--   nog_te_starten        — Nog te starten
--   voorbereiden          — Voorbereiden
--   ontbrekende_gegevens  — Ontbrekende gegevens
--   klaar_voor_invoer     — Klaar voor handmatige invoer
--   handmatig_ingediend   — Handmatig ingediend
--   wacht_op_goedkeuring  — Wacht op goedkeuring
--   actief                — Actief
--   afgewezen             — Afgewezen
--   gepauzeerd            — Gepauzeerd

-- ── 1. build_tracker — per-taak account-setup velden ──────────────────────
alter table public.build_tracker
  add column if not exists requires_account_setup   boolean       not null default false,
  add column if not exists account_platform         text,
  add column if not exists account_type             text,
  add column if not exists expected_revenue_model   text,
  add column if not exists expected_revenue_amount  numeric(14,2),
  add column if not exists revenue_currency         text          not null default 'EUR',
  add column if not exists account_status           text          not null default 'nog_te_starten';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'build_tracker_account_status_chk') then
    alter table public.build_tracker
      add constraint build_tracker_account_status_chk
      check (account_status in (
        'nog_te_starten','voorbereiden','ontbrekende_gegevens','klaar_voor_invoer',
        'handmatig_ingediend','wacht_op_goedkeuring','actief','afgewezen','gepauzeerd'
      ));
  end if;
end $$;

create index if not exists idx_build_tracker_requires_account
  on public.build_tracker (requires_account_setup)
  where requires_account_setup is true;

-- ── 2. business_profiles — centrale bedrijfsgegevens voor registratie ─────
create table if not exists public.business_profiles (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null unique references public.companies(id) on delete cascade,
  legal_name           text,
  trade_name           text,
  kvk_number           text,
  vat_number           text,
  address              text,
  postal_code          text,
  city                 text,
  country              text default 'Nederland',
  website              text,
  contact_email        text,
  contact_phone        text,
  iban                 text,
  business_description text,
  short_pitch          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Eén profiel per bestaande company; vul wat al centraal bekend is.
insert into public.business_profiles (company_id, legal_name, kvk_number, business_description)
select c.id, c.name, c.kvk_number, c.description
from public.companies c
on conflict (company_id) do nothing;

-- ── 3. account_setups — centrale account/affiliate registratie ────────────
create table if not exists public.account_setups (
  id                       uuid primary key default gen_random_uuid(),
  build_task_id            uuid not null references public.build_tracker(id) on delete cascade,
  company_id               uuid references public.companies(id) on delete set null,   -- gekoppelde business/productlijn
  milestone_id             text,                                                      -- snapshot van build_tracker.current_milestone
  platform_name            text,
  platform_url             text,
  account_type             text,
  login_email              text,
  expected_revenue_model   text,                                                      -- snapshot verwachte verdienmodel
  status                   text not null default 'voorbereiden',
  setup_notes              text,
  required_documents       jsonb not null default '[]'::jsonb,
  missing_fields           jsonb not null default '[]'::jsonb,
  generated_application_text text,
  approval_required        boolean not null default true,
  submitted_at             timestamptz,
  approved_at              timestamptz,
  rejected_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Eén account-setup per build-taak (knop "Maak account aan" laadt/maakt deze).
create unique index if not exists uq_account_setups_build_task
  on public.account_setups (build_task_id);

create index if not exists idx_account_setups_company on public.account_setups (company_id);
create index if not exists idx_account_setups_status  on public.account_setups (status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'account_setups_status_chk') then
    alter table public.account_setups
      add constraint account_setups_status_chk
      check (status in (
        'nog_te_starten','voorbereiden','ontbrekende_gegevens','klaar_voor_invoer',
        'handmatig_ingediend','wacht_op_goedkeuring','actief','afgewezen','gepauzeerd'
      ));
  end if;
end $$;

-- ── 4. account_revenues — verdiensten per account ─────────────────────────
create table if not exists public.account_revenues (
  id                    uuid primary key default gen_random_uuid(),
  account_setup_id      uuid not null references public.account_setups(id) on delete cascade,
  revenue_type          text,
  expected_amount       numeric(14,2),
  actual_amount         numeric(14,2),
  currency              text not null default 'EUR',
  commission_percentage numeric(6,2),
  payout_frequency      text,            -- eenmalig | wekelijks | maandelijks | per_kwartaal | jaarlijks | per_actie
  payout_status         text default 'geen',  -- geen | openstaand | uitbetaald | ingehouden
  first_payout_date     date,
  last_payout_date      date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_account_revenues_setup on public.account_revenues (account_setup_id);
