-- ─────────────────────────────────────────────────────────────────────────
-- Migration 100 — Affiliate & Revenue Infrastructure (additieve laag)
-- ─────────────────────────────────────────────────────────────────────────
-- Standalone affiliate-PROGRAMMA-registry + setup-queue + revenue-ledger.
-- COËXISTEERT met 099_account_setup_agent (business_profiles/account_setups):
-- geen overlap in tabel- of functienamen. 099 = account-prep per build-taak;
-- 100 = programma-account-registry (PartnerStack/Binance/Awin…) + autonome agent.
--
-- Hergebruikt: companies (087), youtube_channels (soft uuid[]), build_tracker
-- (milestone), infra_watchdog_heartbeats (worker). Geen wijziging aan 066/099.
-- Idempotent (IF NOT EXISTS / ON CONFLICT). RLS: service_all + authenticated_read.

create or replace function public.affiliate_programs_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ── 1. affiliate_programs (centrale registry) ─────────────────────────────
create table if not exists public.affiliate_programs (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid references public.companies(id) on delete set null,
  name                 text not null,
  category             text not null default 'other'
                         check (category in ('saas_ai','finance_crypto','vastgoed_data','affiliate_network','other')),
  url                  text,
  payout_model         text,
  recurring            boolean,
  account_status       text not null default 'not_started'
                         check (account_status in ('not_started','applied','pending','approved','active','payout_active','rejected','suspended')),
  login_status         text not null default 'none'
                         check (login_status in ('none','created','verified','mfa_pending','locked')),
  payout_threshold     numeric(12,2),
  payout_currency      text not null default 'USD',
  affiliate_link       text,
  referral_code        text,
  connected_channels   uuid[] not null default '{}',
  connected_brands     text[] not null default '{}',
  tax_requirements     text,
  kyc_requirements     text,
  country_availability text[] not null default '{}',
  api_available        boolean,
  notes                text,
  assigned_agent       text,
  monthly_revenue      numeric(14,2) not null default 0,
  lifetime_revenue     numeric(14,2) not null default 0,
  last_status_check_at timestamptz,
  next_action_at       timestamptz,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (name)
);
create index if not exists idx_aff_programs_company   on public.affiliate_programs (company_id);
create index if not exists idx_aff_programs_category  on public.affiliate_programs (category);
create index if not exists idx_aff_programs_status    on public.affiliate_programs (account_status);
create index if not exists idx_aff_programs_next_act  on public.affiliate_programs (next_action_at) where next_action_at is not null;
drop trigger if exists trg_aff_programs_updated_at on public.affiliate_programs;
create trigger trg_aff_programs_updated_at before update on public.affiliate_programs
  for each row execute function public.affiliate_programs_touch_updated_at();

-- ── 2. account_setup_runs (queue — model = routine_runs/089) ──────────────
create table if not exists public.account_setup_runs (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid references public.affiliate_programs(id) on delete cascade,
  run_kind        text not null default 'account_setup'
                    check (run_kind in ('account_setup','affiliate_registration','verification','revenue_sync','reminder','terms_analysis')),
  status          text not null default 'queued'
                    check (status in ('queued','running','awaiting_action','awaiting_approval','failed','recovered','completed','cancelled')),
  trigger_kind    text not null default 'manual'
                    check (trigger_kind in ('manual','cron','event','webhook','retry')),
  payload         jsonb not null default '{}'::jsonb,
  service_id      text,
  claimed_by      text,
  claimed_at      timestamptz,
  started_at      timestamptz not null default now(),
  heartbeat_at    timestamptz,
  ended_at        timestamptz,
  error           jsonb,
  cost_cents      integer not null default 0
);
create index if not exists idx_acc_runs_program_started on public.account_setup_runs (program_id, started_at desc);
create index if not exists idx_acc_runs_active_status on public.account_setup_runs (status)
  where status in ('queued','running','awaiting_action','awaiting_approval');
create index if not exists idx_acc_runs_heartbeat on public.account_setup_runs (heartbeat_at) where status = 'running';

-- ── 3. account_setup_run_steps ────────────────────────────────────────────
create table if not exists public.account_setup_run_steps (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.account_setup_runs(id) on delete cascade,
  order_idx    integer not null default 0,
  step_kind    text not null
                 check (step_kind in ('analyze_terms','summarize_payout','prepare_onboarding','detect_documents',
                   'generate_followup','check_login','store_link','revenue_sync','request_human_action','delay')),
  status       text not null default 'started'
                 check (status in ('started','progress','completed','failed','skipped')),
  output       jsonb,
  error        jsonb,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  retries      integer not null default 0
);
create index if not exists idx_acc_run_steps_run on public.account_setup_run_steps (run_id, started_at);

-- ── 4. account_setup_human_actions (Human Action Center) ──────────────────
create table if not exists public.account_setup_human_actions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid references public.affiliate_programs(id) on delete cascade,
  run_id        uuid references public.account_setup_runs(id) on delete set null,
  action_kind   text not null
                  check (action_kind in ('kyc_upload','sms_verify','captcha','manual_review','tax_form','payout_setup','login_2fa','other')),
  title         text not null,
  description   text,
  status        text not null default 'open' check (status in ('open','in_progress','resolved','dismissed')),
  assigned_to   uuid,
  due_at        timestamptz,
  resolved_at   timestamptz,
  resolved_by   uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_acc_human_open on public.account_setup_human_actions (program_id) where status in ('open','in_progress');
create index if not exists idx_acc_human_due on public.account_setup_human_actions (due_at) where status in ('open','in_progress');
drop trigger if exists trg_acc_human_updated_at on public.account_setup_human_actions;
create trigger trg_acc_human_updated_at before update on public.account_setup_human_actions
  for each row execute function public.affiliate_programs_touch_updated_at();

-- ── 5. account_setup_documents (KYC / document-tracking) ──────────────────
create table if not exists public.account_setup_documents (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.affiliate_programs(id) on delete cascade,
  doc_kind      text not null default 'other' check (doc_kind in ('kyc_id','proof_address','tax_form','contract','bank','other')),
  storage_path  text,
  status        text not null default 'required' check (status in ('required','uploaded','verified','rejected')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_acc_docs_program on public.account_setup_documents (program_id, status);
drop trigger if exists trg_acc_docs_updated_at on public.account_setup_documents;
create trigger trg_acc_docs_updated_at before update on public.account_setup_documents
  for each row execute function public.affiliate_programs_touch_updated_at();

-- ── 6. affiliate_revenue_ledger (maandelijkse revenue per programma) ──────
create table if not exists public.affiliate_revenue_ledger (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.affiliate_programs(id) on delete cascade,
  period_month       date not null,
  gross_revenue      numeric(14,2) not null default 0,
  commission_revenue numeric(14,2) not null default 0,
  currency           text not null default 'USD',
  source             text not null default 'manual' check (source in ('manual','api','affiliate_conversion','import')),
  notes              text,
  recorded_at        timestamptz not null default now(),
  unique (program_id, period_month)
);
create index if not exists idx_aff_ledger_program on public.affiliate_revenue_ledger (program_id, period_month desc);

create or replace function public.affiliate_revenue_rollup()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_program uuid := coalesce(new.program_id, old.program_id);
  v_month   date := date_trunc('month', now())::date;
begin
  update public.affiliate_programs p
     set monthly_revenue = coalesce((select sum(commission_revenue) from public.affiliate_revenue_ledger
            where program_id = v_program and period_month = v_month), 0),
         lifetime_revenue = coalesce((select sum(commission_revenue) from public.affiliate_revenue_ledger
            where program_id = v_program), 0),
         updated_at = now()
   where p.id = v_program;
  return coalesce(new, old);
end$f$;
drop trigger if exists trg_aff_revenue_rollup on public.affiliate_revenue_ledger;
create trigger trg_aff_revenue_rollup after insert or update or delete on public.affiliate_revenue_ledger
  for each row execute function public.affiliate_revenue_rollup();

-- ── 7. account_setup_audit_log (IMMUTABLE) ────────────────────────────────
create table if not exists public.account_setup_audit_log (
  id          bigserial primary key,
  program_id  uuid,
  run_id      uuid,
  action      text not null,
  actor       text not null check (actor in ('ai','user','system')),
  actor_id    uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_acc_audit_program on public.account_setup_audit_log (program_id, created_at desc);
create index if not exists idx_acc_audit_action  on public.account_setup_audit_log (action);
create or replace rule account_setup_audit_log_no_update as on update to public.account_setup_audit_log do instead nothing;
create or replace rule account_setup_audit_log_no_delete as on delete to public.account_setup_audit_log do instead nothing;

-- ── 8. v_affiliate_program_overview (KPI-bron, security_invoker) ──────────
create or replace view public.v_affiliate_program_overview
with (security_invoker = on) as
select p.id, p.company_id, p.name, p.category, p.account_status, p.login_status, p.recurring,
  p.monthly_revenue, p.lifetime_revenue, p.affiliate_link, p.next_action_at,
  coalesce(ha.open_actions, 0) as open_human_actions,
  coalesce(d.required_docs, 0) as required_docs,
  coalesce(r.active_runs, 0) as active_runs
from public.affiliate_programs p
left join (select program_id, count(*) as open_actions from public.account_setup_human_actions
  where status in ('open','in_progress') group by program_id) ha on ha.program_id = p.id
left join (select program_id, count(*) as required_docs from public.account_setup_documents
  where status in ('required','rejected') group by program_id) d on d.program_id = p.id
left join (select program_id, count(*) as active_runs from public.account_setup_runs
  where status in ('queued','running','awaiting_action','awaiting_approval') group by program_id) r on r.program_id = p.id;

comment on view public.v_affiliate_program_overview is
  'Affiliate & Revenue Infra: per-programma overzicht (open human-actions, required docs, actieve runs). Bron voor dashboard KPI/tabel.';

-- ── 9. Storage bucket voor KYC/documenten ─────────────────────────────────
insert into storage.buckets (id, name, public) values ('account-setup-docs', 'account-setup-docs', false)
on conflict (id) do nothing;

-- ── 10. RLS (service_role full access, authenticated read-only) ───────────
do $$
declare t text;
begin
  for t in select unnest(array['affiliate_programs','account_setup_runs','account_setup_run_steps',
    'account_setup_human_actions','account_setup_documents','affiliate_revenue_ledger','account_setup_audit_log'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service_all', t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
  end loop;
end$$;
grant select on public.v_affiliate_program_overview to authenticated, service_role;

-- ── 11. Seed affiliate-programma's (registry-stubs, company modiwerijo) ────
with co as (select id from public.companies where slug = 'modiwerijo' limit 1)
insert into public.affiliate_programs (company_id, name, category, url)
select co.id, x.name, x.category, x.url
from (values
  ('PartnerStack','saas_ai','https://partnerstack.com'),
  ('ClickFunnels Affiliates','saas_ai','https://www.clickfunnels.com/affiliates'),
  ('HubSpot Affiliate Program','saas_ai','https://www.hubspot.com/partners/affiliates'),
  ('Semrush Affiliate Program','saas_ai','https://www.semrush.com/partners/affiliate-program/'),
  ('Shopify Affiliates','saas_ai','https://www.shopify.com/affiliates'),
  ('Webflow Affiliates','saas_ai','https://webflow.com/affiliates'),
  ('Notion Affiliate Program','saas_ai','https://www.notion.so/affiliates'),
  ('Canva Affiliates','saas_ai','https://www.canva.com/affiliates/'),
  ('Adobe Affiliates','saas_ai','https://www.adobe.com/affiliates.html'),
  ('Jasper AI Affiliate','saas_ai','https://www.jasper.ai/affiliate-program'),
  ('SurferSEO Affiliate','saas_ai','https://surferseo.com/affiliate-program/'),
  ('TubeBuddy Affiliate','saas_ai','https://www.tubebuddy.com/affiliateprogram'),
  ('vidIQ Affiliate','saas_ai','https://vidiq.com/affiliate-program/'),
  ('TradingView Partner Program','finance_crypto','https://www.tradingview.com/partner-program/'),
  ('Binance Affiliates','finance_crypto','https://www.binance.com/en/affiliate'),
  ('Bybit Affiliates','finance_crypto','https://www.bybit.com/en-US/affiliate/'),
  ('Kraken Affiliates','finance_crypto','https://www.kraken.com/affiliates'),
  ('Robinhood Affiliates','finance_crypto','https://robinhood.com/us/en/affiliates/'),
  ('Interactive Brokers Affiliates','finance_crypto','https://www.interactivebrokers.com/en/accounts/affiliates.php'),
  ('M1 Finance Affiliate','finance_crypto','https://m1.com/affiliate-program/'),
  ('Fundrise','vastgoed_data','https://fundrise.com'),
  ('Roofstock','vastgoed_data','https://www.roofstock.com'),
  ('Mashvisor','vastgoed_data','https://www.mashvisor.com/affiliate-program'),
  ('Impact.com','affiliate_network','https://impact.com'),
  ('CJ Affiliate','affiliate_network','https://www.cj.com'),
  ('ShareASale','affiliate_network','https://www.shareasale.com'),
  ('Rakuten Advertising','affiliate_network','https://rakutenadvertising.com'),
  ('Awin','affiliate_network','https://www.awin.com'),
  ('ClickBank','affiliate_network','https://www.clickbank.com'),
  ('Digistore24','affiliate_network','https://www.digistore24.com'),
  ('FirstPromoter','affiliate_network','https://firstpromoter.com'),
  ('Rewardful','affiliate_network','https://www.rewardful.com')
) as x(name, category, url)
cross join co
on conflict (name) do nothing;

-- ── 12. Build Tracker milestone (modiwerijo) — 12 subtaken ────────────────
with co as (select id from public.companies where slug = 'modiwerijo' limit 1)
insert into public.build_tracker (company_id, name, description, status, progress_pct, owner, current_milestone, started_at, target_at, metadata)
select co.id, 'Affiliate & Revenue Infrastructure',
  'Account Setup Agent: centrale infra voor affiliate/SaaS/finance/media accounts — registry, onboarding, KYC, revenue tracking, human action center, automation queue.',
  'building', 10, 'Account Setup Agent', 'Fase 0 — schema + registry seed', now(), (now() + interval '60 days'),
  jsonb_build_object('subtasks', jsonb_build_array(
    jsonb_build_object('key','account_setup_engine','label','Account Setup Engine','status','building'),
    jsonb_build_object('key','affiliate_database','label','Affiliate Database','status','live'),
    jsonb_build_object('key','dashboard_ui','label','Dashboard UI','status','planned'),
    jsonb_build_object('key','revenue_tracking','label','Revenue Tracking','status','planned'),
    jsonb_build_object('key','youtube_connector','label','YouTube Connector','status','planned'),
    jsonb_build_object('key','aquier_revenue_layer','label','Aquier Revenue Layer','status','planned'),
    jsonb_build_object('key','human_action_center','label','Human Action Center','status','planned'),
    jsonb_build_object('key','automation_queue','label','Automation Queue','status','planned'),
    jsonb_build_object('key','verification_engine','label','Verification Engine','status','planned'),
    jsonb_build_object('key','payout_tracking','label','Payout Tracking','status','planned'),
    jsonb_build_object('key','country_scaling','label','Country Scaling','status','planned'),
    jsonb_build_object('key','api_integrations','label','API Integrations','status','planned')
  ))
from co
on conflict (company_id, name) do nothing;
