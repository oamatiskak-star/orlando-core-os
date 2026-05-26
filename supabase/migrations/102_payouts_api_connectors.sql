-- ─────────────────────────────────────────────────────────────────────────
-- Migration 102 — Payout-reconciliatie + API-connector framework
-- ─────────────────────────────────────────────────────────────────────────
-- Bovenop migratie 100/101. Twee additieve onderdelen:
--   1. affiliate_payouts        — verwachte vs. betaalde payouts per programma,
--      met variance + reconciliatie-status. View v_payout_reconciliation
--      aggregeert tegen affiliate_programs.lifetime_revenue (rollup uit ledger).
--   2. affiliate_api_connectors — declaratieve per-programma API-koppeling om
--      revenue automatisch te syncen. SECRETS staan NIET in de DB: connector
--      verwijst naar een env-var-naam (credential_env) op de runner-host.
-- Idempotent. RLS service_all + authenticated_read. Geen mock-data.

-- ── 1. affiliate_payouts ───────────────────────────────────────────────────
create table if not exists public.affiliate_payouts (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.affiliate_programs(id) on delete cascade,
  period_month     date,
  expected_amount  numeric(14,2) not null default 0,
  paid_amount      numeric(14,2) not null default 0,
  currency         text not null default 'USD',
  status           text not null default 'expected'
                     check (status in ('expected','pending','partial','paid','discrepancy','written_off')),
  expected_at      timestamptz,
  paid_at          timestamptz,
  external_ref     text,
  variance_amount  numeric(14,2) not null default 0,
  reconciled       boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_aff_payouts_program on public.affiliate_payouts (program_id, period_month desc);
create index if not exists idx_aff_payouts_status  on public.affiliate_payouts (status);

drop trigger if exists trg_aff_payouts_updated_at on public.affiliate_payouts;
create trigger trg_aff_payouts_updated_at before update on public.affiliate_payouts
  for each row execute function public.affiliate_programs_touch_updated_at();

-- ── 2. affiliate_api_connectors ────────────────────────────────────────────
create table if not exists public.affiliate_api_connectors (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null unique references public.affiliate_programs(id) on delete cascade,
  provider         text,
  base_url         text,
  auth_type        text not null default 'none' check (auth_type in ('none','bearer','api_key','basic')),
  credential_env   text,                              -- naam env-var op runner-host; secret NIET in DB
  config           jsonb not null default '{}'::jsonb, -- { endpoint, method, header_name, array_path, period_path, commission_path }
  enabled          boolean not null default false,
  last_sync_at     timestamptz,
  last_sync_status text,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_aff_connectors_enabled on public.affiliate_api_connectors (enabled) where enabled;

drop trigger if exists trg_aff_connectors_updated_at on public.affiliate_api_connectors;
create trigger trg_aff_connectors_updated_at before update on public.affiliate_api_connectors
  for each row execute function public.affiliate_programs_touch_updated_at();

-- ── 3. v_payout_reconciliation (security_invoker) ─────────────────────────
create or replace view public.v_payout_reconciliation
with (security_invoker = on) as
select
  p.id                                           as program_id,
  p.company_id,
  p.name,
  p.payout_currency,
  p.payout_threshold,
  p.lifetime_revenue                             as commission_total,
  coalesce(paid.total_paid, 0)                   as total_paid,
  (p.lifetime_revenue - coalesce(paid.total_paid, 0)) as outstanding,
  (p.payout_threshold is not null
     and (p.lifetime_revenue - coalesce(paid.total_paid, 0)) >= p.payout_threshold) as at_threshold,
  coalesce(op.open_expected, 0)                  as open_expected,
  coalesce(disc.discrepancies, 0)                as discrepancies
from public.affiliate_programs p
left join (
  select program_id, sum(paid_amount) as total_paid
    from public.affiliate_payouts where status in ('paid','partial') group by program_id
) paid on paid.program_id = p.id
left join (
  select program_id, count(*) as open_expected
    from public.affiliate_payouts where status in ('expected','pending') group by program_id
) op on op.program_id = p.id
left join (
  select program_id, count(*) as discrepancies
    from public.affiliate_payouts where status = 'discrepancy' group by program_id
) disc on disc.program_id = p.id;

comment on view public.v_payout_reconciliation is
  'Payout-reconciliatie per programma: commissie-totaal (rollup) vs. betaald = uitstaand, drempel-status, open expected payouts en discrepanties.';

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select unnest(array['affiliate_payouts','affiliate_api_connectors'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service_all', t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
  end loop;
end$$;

grant select on public.v_payout_reconciliation to authenticated, service_role;
