-- ─────────────────────────────────────────────────────────────────────────
-- Migration 088 — Build Tracker seed (25 real-world builds over 7 entities)
-- ─────────────────────────────────────────────────────────────────────────
-- Reconstructie van seed die initieel via Supabase MCP is applied
-- (versie 20260523175349 in supabase_migrations.schema_migrations).
-- Idempotent via unique index (company_id, name).

with c as (
  select id, slug from public.companies where slug is not null
)
insert into public.build_tracker (company_id, name, description, status, progress_pct, owner, current_milestone, started_at, target_at)
select c.id, x.name, x.description, x.status, x.progress_pct, x.owner, x.milestone, x.start_at, x.target_at
from (values
  -- osm (5)
  ('osm', 'Orlando Core OS — dashboard refactor', 'Multi-entity dashboard + per-company landings + role-based nav', 'live',      100, 'Orlando', 'Sessie 4 afgerond', '2026-05-19'::timestamptz, '2026-05-23'::timestamptz),
  ('osm', 'CLAUDE.md sessieprotocol',             'PROJECT_STATUS herstelblok + commit rules',                       'live',      100, 'Orlando', 'Live in alle projecten', '2026-05-20'::timestamptz, '2026-05-22'::timestamptz),
  ('osm', 'AI Architect Routine',                 'Dagelijkse ecosystem scan + architectuur-rapport',                'building',   60, 'Orlando', 'Routine-laag in design', '2026-05-23'::timestamptz, '2026-06-15'::timestamptz),
  ('osm', 'Local-watchdog CLI-R deploy',          'Self-healing watchdog op tweede Mac',                              'planned',    10, 'Orlando', 'PM2 install + env-sync', '2026-05-23'::timestamptz, '2026-05-30'::timestamptz),
  ('osm', 'Routines Control Center',              'Enterprise routines & automation supervisor laag',                 'building',   15, 'Orlando', 'Fase 1 schema+observability', '2026-05-23'::timestamptz, '2026-06-30'::timestamptz),

  -- modiwerijo (2)
  ('modiwerijo', 'Moneybird live sync',           'BTW deadlines + facturen + cashflow integratie',                   'live',      100, 'Modiwerijo', 'Stabiel', '2026-04-15'::timestamptz, '2026-05-15'::timestamptz),
  ('modiwerijo', 'OSIL financial optimizer',      'AI fiscalist + Recovery agent + Kansen radar',                     'building',   55, 'Modiwerijo', 'Recovery agent fase 2', '2026-05-01'::timestamptz, '2026-06-30'::timestamptz),

  -- modiwe-media (5)
  ('modiwe-media', 'Media Holding OS',            'Fases 1-6 live + Fase 7 Executive Intelligence',                  'live',       95, 'Media Team', 'Fase 7 LLM agents deploy', '2026-04-01'::timestamptz, '2026-06-15'::timestamptz),
  ('modiwe-media', 'YouTube Engine quota fix',    'Quota-aware sync + per-channel fallback',                          'live',      100, 'YouTube Eng', 'Live', '2026-05-19'::timestamptz, '2026-05-23'::timestamptz),
  ('modiwe-media', 'Algorithm Intelligence Center', 'Signal strip + breakout feed + autopilot switchboard',           'live',      100, 'Algorithm', 'UI live', '2026-05-20'::timestamptz, '2026-05-23'::timestamptz),
  ('modiwe-media', 'Viral Intelligence Engine',   'Vercel cron direct-API scans (viral/audio/trend)',                'live',      100, 'Algorithm', 'Live autonomously', '2026-05-15'::timestamptz, '2026-05-20'::timestamptz),
  ('modiwe-media', 'Local rail bulk renderer',    'Mac mini Pexels + Edge TTS + FFmpeg compositie',                  'planned',    20, 'Local Agent', 'Spec compleet', '2026-05-25'::timestamptz, '2026-06-30'::timestamptz),

  -- modiwe-software (6)
  ('modiwe-software', 'Aquier Command Center',    '8 modules + AI Project Leider CHRONOS-AQ',                        'live',      100, 'Aquier Team', 'Kickoff 2026-05-25', '2026-05-15'::timestamptz, '2026-05-25'::timestamptz),
  ('modiwe-software', 'Aquier Checkout Auditor',  'Render service + 56-scenario audit + €515K/mo recovery',           'live',      100, 'Auditor', 'Live + Telegram alerts', '2026-05-20'::timestamptz, '2026-05-23'::timestamptz),
  ('modiwe-software', 'aquier.com pricing fix',   '11 approved findings + country_pricing_rules lookup',              'building',   25, 'Aquier Dev', 'Anonymous checkout flow', '2026-05-23'::timestamptz, '2026-06-15'::timestamptz),
  ('modiwe-software', 'Acquisition scraper workers', 'Render workers voor 8 acq agents (Funda/Kadaster/Veiling)',     'planned',     5, 'Acquisition', 'Render service todo', '2026-05-23'::timestamptz, '2026-06-30'::timestamptz),
  ('modiwe-software', 'Executive Engine Render deploy', 'ATLAS opus + 5 specialisten sonnet',                          'deploying',  85, 'Executive', 'ANTHROPIC_API_KEY zetten', '2026-05-20'::timestamptz, '2026-05-24'::timestamptz),
  ('modiwe-software', 'Routines Control Center backend', 'pg_cron triggers + local-agent runner integratie',         'building',   10, 'Routines', 'Fase 1 schema', '2026-05-23'::timestamptz, '2026-06-30'::timestamptz),

  -- strkbeheer (3)
  ('strkbeheer', 'DealRadar Funda scanner',       'Profit ≥€1000/m² Telegram alerts',                                 'live',      100, 'Acquisitie', 'Live', '2026-04-01'::timestamptz, '2026-05-01'::timestamptz),
  ('strkbeheer', 'OffMarket Engine',              'Leegstand + Streetview + kadaster detectie',                       'building',   45, 'Acquisitie', 'Fase 2 GIS layer', '2026-05-01'::timestamptz, '2026-06-30'::timestamptz),
  ('strkbeheer', 'Investor Match',                'JV pipeline + investor CRM',                                       'planned',    15, 'Acquisitie', 'Schema design', '2026-05-20'::timestamptz, '2026-07-15'::timestamptz),

  -- strkbouw (2)
  ('strkbouw', 'SterkCalc STABU MVP',             'STABU structuren + materiaal+arbeid + opslagen',                  'building',   40, 'STRKBOUW', 'Fase 2 PDF analyse', '2026-04-15'::timestamptz, '2026-07-01'::timestamptz),
  ('strkbouw', 'BouwplaatsApp',                   'Mobile dagrapportage + urenregistratie + foto-upload',             'planned',    10, 'STRKBOUW', 'UX wireframes', '2026-05-15'::timestamptz, '2026-08-01'::timestamptz),

  -- bouwproffs (2)
  ('bouwproffs', 'Calculatie Pipeline Bouwproffs', 'Fixed Price + regionale prijsvariaties + winst&risico',           'building',   50, 'Bouwproffs', 'Regio-multipliers live', '2026-04-01'::timestamptz, '2026-06-30'::timestamptz),
  ('bouwproffs', 'Offerte Generator',              'PDF-output professioneel + financieringswaardig',                  'planned',    15, 'Bouwproffs', 'Template-design', '2026-05-10'::timestamptz, '2026-07-15'::timestamptz)
) as x(slug, name, description, status, progress_pct, owner, milestone, start_at, target_at)
join c on c.slug = x.slug
on conflict (company_id, name) do nothing;
