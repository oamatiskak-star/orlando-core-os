-- 103_browser_registration_agent.sql
-- Live browser-driven Account Setup Agent (co-pilot, approve-only).
-- Additief + idempotent. Breidt bestaande account-setup-infra (099/100) uit met:
--   * run_kind 'browser_registration'
--   * browser-specifieke step_kinds + approve-action_kinds
--   * account_setup_field_maps (data-driven veld→selector mapping per programma)
--   * private storage-bucket 'account-setup-artifacts' (per-stap screenshots)
-- De pauze-statussen (awaiting_action/awaiting_approval) bestaan al op
-- account_setup_runs.status (migratie 100) — geen status-wijziging nodig.

-- ── 1. run_kind: + browser_registration ────────────────────────────────────
do $$
begin
  alter table public.account_setup_runs drop constraint if exists account_setup_runs_run_kind_check;
  alter table public.account_setup_runs
    add constraint account_setup_runs_run_kind_check
    check (run_kind in (
      'account_setup','affiliate_registration','verification','revenue_sync',
      'reminder','terms_analysis','browser_registration'
    ));
end $$;

-- ── 2. step_kind: + browser-stappen ─────────────────────────────────────────
do $$
begin
  alter table public.account_setup_run_steps drop constraint if exists account_setup_run_steps_step_kind_check;
  alter table public.account_setup_run_steps
    add constraint account_setup_run_steps_step_kind_check
    check (step_kind in (
      'analyze_terms','summarize_payout','prepare_onboarding','detect_documents',
      'generate_followup','check_login','store_link','revenue_sync',
      'request_human_action','delay',
      -- browser_registration:
      'navigate','fill_field','capture_screenshot','await_approval',
      'submit_form','detect_result','gmail_label','verify_email'
    ));
end $$;

-- ── 3. action_kind: + approve_submit / approve_action ───────────────────────
do $$
begin
  alter table public.account_setup_human_actions drop constraint if exists account_setup_human_actions_action_kind_check;
  alter table public.account_setup_human_actions
    add constraint account_setup_human_actions_action_kind_check
    check (action_kind in (
      'kyc_upload','sms_verify','captcha','manual_review','tax_form',
      'payout_setup','login_2fa','other','approve_submit','approve_action'
    ));
end $$;

-- ── 4. account_setup_field_maps (data-driven, zelflerend) ───────────────────
-- fields: jsonb array van descriptors, geordend:
--   [{ "field": "business_email", "source": "business_profiles.contact_email",
--      "selectors": ["#email","input[name=email]"], "strategy": "fill",
--      "gated": false }]
-- success_patterns: jsonb array van url/text-patronen die "registratie gelukt" aanduiden.
-- submit_selectors: jsonb array van selectors voor de submit-knop (altijd gated).
create table if not exists public.account_setup_field_maps (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.affiliate_programs(id) on delete cascade,
  signup_url       text not null,
  fields           jsonb not null default '[]'::jsonb,
  success_patterns jsonb not null default '[]'::jsonb,
  submit_selectors jsonb not null default '[]'::jsonb,
  version          int  not null default 1,
  source           text not null default 'seed',   -- seed | llm_confirmed | manual
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_field_maps_program on public.account_setup_field_maps(program_id);

-- ── 5. Storage-bucket voor per-stap screenshots (privé) ─────────────────────
insert into storage.buckets (id, name, public)
values ('account-setup-artifacts', 'account-setup-artifacts', false)
on conflict (id) do nothing;

-- ── 6. RLS (service_role full + authenticated read) ─────────────────────────
do $$
begin
  execute 'alter table public.account_setup_field_maps enable row level security';
  execute 'drop policy if exists account_setup_field_maps_service_all on public.account_setup_field_maps';
  execute 'create policy account_setup_field_maps_service_all on public.account_setup_field_maps for all to service_role using (true) with check (true)';
  execute 'drop policy if exists account_setup_field_maps_authenticated_read on public.account_setup_field_maps';
  execute 'create policy account_setup_field_maps_authenticated_read on public.account_setup_field_maps for select to authenticated using (true)';
end $$;

-- Storage RLS: authenticated mag lezen (signed URLs), service_role volledig.
do $$
begin
  drop policy if exists account_setup_artifacts_service_all on storage.objects;
  create policy account_setup_artifacts_service_all on storage.objects
    for all to service_role using (bucket_id = 'account-setup-artifacts') with check (bucket_id = 'account-setup-artifacts');
  drop policy if exists account_setup_artifacts_auth_read on storage.objects;
  create policy account_setup_artifacts_auth_read on storage.objects
    for select to authenticated using (bucket_id = 'account-setup-artifacts');
end $$;

-- ── 7. Seed field-map voor de TradingView-pilot ─────────────────────────────
-- Selectors zijn best-effort startpunten; de worker valt terug op de Ollama-
-- mapper + human-confirm als een selector niet bestaat, en schrijft de
-- bevestigde mapping terug (source='llm_confirmed').
insert into public.account_setup_field_maps (program_id, signup_url, fields, success_patterns, submit_selectors, source)
select ap.id,
  'https://www.tradingview.com/partner-program/',
  '[
     {"field":"business_email","source":"business_profiles.contact_email","selectors":["input[name=email]","#email","input[type=email]"],"strategy":"fill","gated":false},
     {"field":"password","source":"credential.generated_password","selectors":["input[name=password]","#password","input[type=password]"],"strategy":"fill","gated":false,"sensitive":true},
     {"field":"company","source":"business_profiles.legal_name","selectors":["input[name=company]","input[name=companyName]"],"strategy":"fill","gated":false},
     {"field":"website","source":"business_profiles.website","selectors":["input[name=website]","input[name=url]"],"strategy":"fill","gated":false}
   ]'::jsonb,
  '["/partner","dashboard","welcome","verify your email","aff_id","referral"]'::jsonb,
  '["button[type=submit]","button:has-text(\"Sign up\")","button:has-text(\"Join\")"]'::jsonb,
  'seed'
from public.affiliate_programs ap
where ap.name = 'TradingView Partner Program'
on conflict (program_id) do nothing;
