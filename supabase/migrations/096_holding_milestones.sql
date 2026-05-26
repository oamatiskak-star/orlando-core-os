-- 096_holding_milestones.sql
-- Autonomous AI Media Holding Ecosystem — 24-milestone roadmap tracking (holding-niveau, cross-company).
-- Patroon gebaseerd op media_holding_phases/modules (038) + build_tracker (087).
-- Idempotent: veilig herhaald toe te passen.

create table if not exists public.holding_milestones (
  id            uuid primary key default gen_random_uuid(),
  milestone_nr  smallint not null unique,
  naam          text not null,
  value_stage   text,        -- MEDIA/TRAFFIC/LEADS/SERVICES/AUTOMATION/SOFTWARE/RECURRING/ACQUISITIONS/HOLDING/OSIL
  verdienmodel  text,
  status        text not null default 'planned'
                  check (status in ('planned','building','partial','live','blocked')),
  progress_pct  integer not null default 0 check (progress_pct between 0 and 100),
  fundament     text,        -- bestaand asset / koppeling (rule 4: niets herbouwen)
  route         text,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_holding_milestones_status ON public.holding_milestones (status);
create index if not exists idx_holding_milestones_stage  ON public.holding_milestones (value_stage);

-- updated_at trigger
create or replace function public.set_holding_milestones_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_holding_milestones_updated_at on public.holding_milestones;
create trigger trg_holding_milestones_updated_at
  before update on public.holding_milestones
  for each row execute function public.set_holding_milestones_updated_at();

-- RLS (conform 027_osil.sql): authenticated full access
alter table public.holding_milestones enable row level security;

drop policy if exists holding_milestones_authenticated on public.holding_milestones;
create policy holding_milestones_authenticated on public.holding_milestones
  for all to authenticated using (true) with check (true);

-- Seed: 24 milestones. Statussen/voortgang = mapping t.o.v. bestaande assets per 2026-05-26.
insert into public.holding_milestones (milestone_nr, naam, value_stage, verdienmodel, status, progress_pct, fundament) values
  (1,  'Organisatie OS',              'AUTOMATION',  'indirect',                'live',    100, 'Orlando Core OS: Supabase, Docker/n8n, agent orchestration, central DB'),
  (2,  'AI Content Engine',           'MEDIA',       'Adsense + monetization',  'live',    100, 'Media Holding OS: 6 fases, 23 modules live + Fase 7 Executive Layer + viral/audio/trend-crons'),
  (3,  'Affiliate Engine',            'RECURRING',   'commissies',              'partial',  40, 'affiliate-engine module live in Media Holding OS — niches/automation uitbreiden'),
  (4,  'Programmatic SEO Network',    'TRAFFIC',     'SEO + ads + affiliate',   'partial',  50, 'Aquier 78 SEO-pages (pattern bewezen) → generaliseren naar niche-netwerk'),
  (5,  'Lead Generation System',      'LEADS',       'leads verkopen',          'planned',   0, 'scraping + outreach + booking + CRM (n8n/Typebot)'),
  (6,  'Website Agency',              'SERVICES',    'websites + retainers',    'planned',   0, 'Next.js/WP/Framer/Webflow + AI templates'),
  (7,  'AI Automation Agency',        'SERVICES',    'high-ticket retainers',   'partial',  30, 'bestaande agents (mail/finance/CRM) → externaliseren als dienst'),
  (8,  'Appointment Setting System',  'LEADS',       'per afspraak',            'planned',   0, 'outbound: email/LinkedIn/IG/WhatsApp + CRM-sync'),
  (9,  'Digital Products',            'SOFTWARE',    'downloads',               'planned',   0, 'prompts/templates/SOPs → Gumroad/Lemon Squeezy'),
  (10, 'Community Ecosystem',         'RECURRING',   'memberships',             'partial',  20, 'Aquier Premium Investor Community (Q3) als eerste cohort → Skool/Discord'),
  (11, 'Online Education',            'RECURRING',   'cursussen',               'planned',   0, 'AI lesson creation + support assistant'),
  (12, 'White Label SaaS',            'SOFTWARE',    'subscriptions',           'partial',  25, 'open-source GHL-alternatief; leunt op bestaande SaaS-infra'),
  (13, 'AI Agent Marketplace',        'SOFTWARE',    'subs + usage',            'partial',  30, '80+ agents bestaan al → productiseren als marketplace'),
  (14, 'SaaS Product Development',    'SOFTWARE',    'MRR',                     'partial',  70, 'Aquier (P1) + SterkCalc live; nieuwe products op interne problemen'),
  (15, 'Media Buying System',         'TRAFFIC',     'performance marketing',   'planned',   0, 'Meta/Google/TikTok Ads + AI creatives/optimization'),
  (16, 'E-commerce Automation',       'SOFTWARE',    'product sales',           'planned',   0, 'POD + digital commerce + AI stores'),
  (17, 'Newsletter Media Network',    'MEDIA',       'sponsors + subs',         'partial',  30, 'Beehiiv/Substack; content-repurposing pipeline bestaat'),
  (18, 'Data & Analytics Services',   'SERVICES',    'dashboards + retainers',  'partial',  25, 'Metabase/Superset/Matomo bovenop bestaande DB'),
  (19, 'Micro-SaaS Acquisitions',     'ACQUISITIONS','cashflow',                'planned',   0, 'Acquire.com/Flippa'),
  (20, 'Website Acquisitions',        'ACQUISITIONS','SEO + affiliate + ads',   'planned',   0, 'bestaande traffic-assets kopen'),
  (21, 'YouTube Channel Acquisitions','ACQUISITIONS','media scaling',           'planned',   0, 'faceless channels kopen + automatiseren (sluit aan op M2)'),
  (22, 'Holding Company System',      'HOLDING',     'overkoepelend',           'partial',  40, 'BV-structuur bestaat → divisies formaliseren (media/SaaS/AI/acq/investment)'),
  (23, 'Investment Engine',           'OSIL',        'kapitaalgroei',           'planned',   0, 'startups/SaaS/media/AI-infra; gevoed door OSIL netto-cashflow'),
  (24, 'Full Autonomous Organization','HOLDING',     'zelfsturend',             'partial',  35, 'Executive Intelligence Layer (Fase 7) = eerste laag AI-management')
on conflict (milestone_nr) do update set
  naam = excluded.naam,
  value_stage = excluded.value_stage,
  verdienmodel = excluded.verdienmodel,
  status = excluded.status,
  progress_pct = excluded.progress_pct,
  fundament = excluded.fundament,
  updated_at = now();
