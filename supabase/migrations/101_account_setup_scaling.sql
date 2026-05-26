-- ─────────────────────────────────────────────────────────────────────────
-- Migration 101 — Account Setup Scaling (declaratieve account-type templates)
-- ─────────────────────────────────────────────────────────────────────────
-- Maakt de Account Setup Agent uitbreidbaar naar willekeurige accounttypes
-- (LinkedIn page, YouTube channel, Stripe, LLC, VAT, domain, email, social,
-- marketplace, investor) ZONDER per type code te schrijven: elk type definieert
-- declaratief een onboarding-checklist + vereiste documenten. De runner leest
-- het template en genereert human-actions + document-vereisten.
--
-- affiliate_programs wordt hiermee de generieke "managed accounts"-registry;
-- `account_type` default 'affiliate_program' → bestaande rijen breken niet.
-- Additief + idempotent.

-- ── 1. account_setup_types (registry + templates) ─────────────────────────
create table if not exists public.account_setup_types (
  type_key         text primary key,
  label            text not null,
  domain           text not null
                     check (domain in ('affiliate','social','finance','legal','infra','marketplace','investor')),
  description      text,
  checklist        jsonb not null default '[]'::jsonb,   -- [{ "step": text, "action_kind": text }]
  required_docs    jsonb not null default '[]'::jsonb,   -- [doc_kind]
  default_run_kind text not null default 'account_setup',
  active           boolean not null default true,
  sort_order       integer not null default 100,
  created_at       timestamptz not null default now()
);

-- ── 2. affiliate_programs.account_type (generieke discriminator) ──────────
alter table public.affiliate_programs
  add column if not exists account_type text not null default 'affiliate_program';

create index if not exists idx_aff_programs_account_type on public.affiliate_programs (account_type);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
alter table public.account_setup_types enable row level security;
drop policy if exists account_setup_types_service_all on public.account_setup_types;
create policy account_setup_types_service_all on public.account_setup_types
  for all to service_role using (true) with check (true);
drop policy if exists account_setup_types_authenticated_read on public.account_setup_types;
create policy account_setup_types_authenticated_read on public.account_setup_types
  for select to authenticated using (true);

-- ── 4. Seed account-types (checklist-stappen = human-action titels) ───────
insert into public.account_setup_types (type_key, label, domain, description, checklist, required_docs, default_run_kind, sort_order)
values
  ('affiliate_program', 'Affiliate Program', 'affiliate',
   'Affiliate/partner-programma registreren en payouts beheren.',
   '[{"step":"Programma-voorwaarden analyseren","action_kind":"manual_review"},{"step":"Account aanmaken + inloggen","action_kind":"login_2fa"},{"step":"Payout-methode instellen","action_kind":"payout_setup"}]'::jsonb,
   '["tax_form","bank"]'::jsonb, 'terms_analysis', 10),

  ('linkedin_page', 'LinkedIn Page', 'social',
   'LinkedIn bedrijfspagina aanmaken en inrichten.',
   '[{"step":"Bedrijfspagina aanmaken","action_kind":"manual_review"},{"step":"Logo + banner uploaden","action_kind":"manual_review"},{"step":"Beheerders toewijzen","action_kind":"manual_review"}]'::jsonb,
   '[]'::jsonb, 'account_setup', 20),

  ('youtube_channel', 'YouTube Channel', 'social',
   'Nieuw YouTube-kanaal opzetten + verifiëren.',
   '[{"step":"Kanaal aanmaken (Google account)","action_kind":"login_2fa"},{"step":"Kanaal verifiëren (telefoon)","action_kind":"sms_verify"},{"step":"Branding + beschrijving","action_kind":"manual_review"}]'::jsonb,
   '[]'::jsonb, 'account_setup', 30),

  ('stripe_onboarding', 'Stripe Onboarding', 'finance',
   'Stripe-account voor betalingen + payouts inrichten.',
   '[{"step":"Stripe account aanmaken","action_kind":"manual_review"},{"step":"Identiteit verifiëren","action_kind":"kyc_upload"},{"step":"Bankrekening koppelen","action_kind":"payout_setup"}]'::jsonb,
   '["kyc_id","bank","tax_form"]'::jsonb, 'account_setup', 40),

  ('llc_setup', 'LLC / Company Setup', 'legal',
   'Vennootschap/LLC oprichten en registreren.',
   '[{"step":"Naam + structuur kiezen","action_kind":"manual_review"},{"step":"Oprichtingsakte indienen","action_kind":"manual_review"},{"step":"EIN/registratienummer aanvragen","action_kind":"manual_review"}]'::jsonb,
   '["contract","proof_address","kyc_id"]'::jsonb, 'account_setup', 50),

  ('vat_onboarding', 'VAT / BTW Onboarding', 'legal',
   'BTW/VAT-registratie regelen.',
   '[{"step":"BTW-nummer aanvragen","action_kind":"tax_form"},{"step":"Fiscale gegevens invoeren","action_kind":"manual_review"}]'::jsonb,
   '["tax_form"]'::jsonb, 'account_setup', 60),

  ('domain_registration', 'Domain Registration', 'infra',
   'Domeinnaam registreren + DNS instellen.',
   '[{"step":"Domein beschikbaarheid checken","action_kind":"manual_review"},{"step":"Domein registreren","action_kind":"manual_review"},{"step":"DNS records instellen","action_kind":"manual_review"}]'::jsonb,
   '[]'::jsonb, 'account_setup', 70),

  ('email_infra', 'Email Infrastructure', 'infra',
   'Zakelijke e-mail + deliverability (SPF/DKIM/DMARC) opzetten.',
   '[{"step":"Mailbox/domein koppelen","action_kind":"manual_review"},{"step":"SPF + DKIM + DMARC instellen","action_kind":"manual_review"},{"step":"Deliverability testen","action_kind":"manual_review"}]'::jsonb,
   '[]'::jsonb, 'account_setup', 80),

  ('social_onboarding', 'Social Media Onboarding', 'social',
   'Social media-account(s) aanmaken en verifiëren.',
   '[{"step":"Account aanmaken","action_kind":"login_2fa"},{"step":"Profiel inrichten","action_kind":"manual_review"},{"step":"Verifiëren","action_kind":"sms_verify"}]'::jsonb,
   '[]'::jsonb, 'account_setup', 90),

  ('marketplace_onboarding', 'Marketplace Onboarding', 'marketplace',
   'Verkoper-account op marketplace inrichten.',
   '[{"step":"Seller-account aanmaken","action_kind":"manual_review"},{"step":"KYC + bedrijfsgegevens","action_kind":"kyc_upload"},{"step":"Uitbetaling instellen","action_kind":"payout_setup"}]'::jsonb,
   '["kyc_id","bank","tax_form"]'::jsonb, 'account_setup', 100),

  ('investor_onboarding', 'Investor Onboarding', 'investor',
   'Investeerder onboarden (KYC + overeenkomsten).',
   '[{"step":"Intake + NDA","action_kind":"manual_review"},{"step":"KYC/AML verificatie","action_kind":"kyc_upload"},{"step":"Investeringsovereenkomst tekenen","action_kind":"manual_review"}]'::jsonb,
   '["kyc_id","proof_address","contract"]'::jsonb, 'account_setup', 110)
on conflict (type_key) do nothing;
