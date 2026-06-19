-- ─────────────────────────────────────────────────────────────────────────
-- Migration 139 — Live Assist run_kind (co-watch sessie)
-- ─────────────────────────────────────────────────────────────────────────
-- Additieve laag op 100/103. Voegt run_kind 'live_assist' toe: een sessie waarin
-- de MENS de affiliate-aanmeldformulieren invult en de agents (Setup Agent +
-- MCP Agent) LIVE meekijken en assisteren. Een eigen live-assist-runner claimt
-- deze runs; de account-setup-runner sluit ze expliciet uit (zie runner-code),
-- zodat een co-watch-sessie niet als onboarding wordt afgehandeld.
--
-- Idempotent: drop + re-add constraint met de volledige waardenset.

alter table public.account_setup_runs drop constraint if exists account_setup_runs_run_kind_check;
alter table public.account_setup_runs
  add constraint account_setup_runs_run_kind_check
  check (run_kind in (
    'account_setup','affiliate_registration','verification','revenue_sync',
    'reminder','terms_analysis','browser_registration','live_assist'
  ));
