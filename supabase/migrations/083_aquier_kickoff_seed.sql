-- ─────────────────────────────────────────────────────────────────────────
-- Migration 083 — Aquier Kickoff Seed
-- ─────────────────────────────────────────────────────────────────────────
-- Seeds:
--   - Sprint W22 (2026-05-25) tasks
--   - Kickoff brief van CHRONOS-AQ voor maandag 09:00
--   - Eerste batch monitor events (baseline KPIs)
--   - Voorbeelden van approvals waiting decision

-- Sprint W22 taken — verkrijg sprint id
with sp as (
  select id from public.aquier_sprints where sprint_code = 'SP-2026-W22'
),
proj as (
  select id, code from public.aquier_projects
)
insert into public.aquier_tasks (project_id, sprint_id, title, body, status, priority, owner_agent, estimate_hours, due_at)
select
  p.id, sp.id, t.title, t.body, t.status, t.priority, t.owner_agent, t.estimate_hours, t.due_at::timestamptz
from sp
cross join lateral (values
  -- Maandag 2026-05-25
  ('AQ-M25', 'Kickoff sessie 09:00 met Orlando', 'Doornemen masterplan + week 1 sprint plan + Q3 launch sequence', 'pending', 'critical', 'CHRONOS-AQ', 1.5, '2026-05-25 10:30:00+02'),
  ('AQ-M00', 'Investor deck PPTX v1 starten', 'Outline uit 15_INVESTOR_RELATIONS/04 omzetten naar Pitch.com slides', 'pending', 'critical', 'ORACLE-IR', 8, '2026-05-29 17:00:00+02'),
  ('AQ-M03', 'NL design partner outreach wave 1', '15 prospects: top NL family offices + 5 vastgoedfondsen via LinkedIn', 'pending', 'critical', 'TITAN-S', 4, '2026-05-25 18:00:00+02'),
  -- Dinsdag
  ('AQ-M22', 'Aquier BV juridische entiteit oprichten', 'Notaris afspraak + KvK registratie + statuten', 'pending', 'critical', 'ATLAS-A', 6, '2026-05-26 18:00:00+02'),
  ('AQ-M22', 'aquier.com / .nl / .ai domeinen registreren', 'Eigendom + DNS + Vercel setup', 'pending', 'high', 'VULCAN-INFRA', 1, '2026-05-26 14:00:00+02'),
  ('AQ-M21', 'AI org Slack workspace opzetten', 'Channels per team + Telegram bridge', 'pending', 'high', 'VULCAN-INFRA', 2, '2026-05-26 17:00:00+02'),
  -- Woensdag
  ('AQ-M23', 'GDPR DPIA template voor data sources', 'Per-bron Kadaster/KvK/BAG/PDOK + DPO consultatie', 'pending', 'high', 'COMPLIANCE-AI', 4, '2026-05-27 17:00:00+02'),
  ('AQ-M08', 'LinkedIn Aquier company page live', 'Profile + banner + first 3 posts gepland', 'pending', 'medium', 'HERALD-C', 3, '2026-05-27 17:00:00+02'),
  ('AQ-M01', 'Pre-seed pitch deck 15 slides v0.5', 'Story arc + financials van forecast.csv injecteren', 'pending', 'critical', 'ORACLE-IR', 6, '2026-05-28 17:00:00+02'),
  -- Donderdag
  ('AQ-M02', 'Eerste 5 design partner gesprekken', 'Tijd-blokken voor demo gesprekken in agenda zetten', 'pending', 'critical', 'TITAN-S', 4, '2026-05-28 18:00:00+02'),
  ('AQ-M24', 'Validation layer scope freeze v1', 'Confidence scoring + explainability v1 features', 'pending', 'high', 'SAGE-LAB', 4, '2026-05-28 17:00:00+02'),
  -- Vrijdag
  ('AQ-M25', 'Sprint W22 review + W23 planning', 'Retro + nieuwe sprint kickoff', 'pending', 'high', 'CHRONOS-AQ', 1.5, '2026-05-29 17:00:00+02'),
  ('AQ-M15', 'Pre-seed investor longlist 30 angels/RBF', 'NL + UK contacten, RBF providers (Capchase Pipe Wayflyer)', 'pending', 'high', 'ORACLE-IR', 4, '2026-05-29 17:00:00+02'),
  ('AQ-M18', 'Stripe + Moneybird setup voor billing', 'Test mode, subscription products voor Pro tiers', 'pending', 'medium', 'TREASURY-AI', 3, '2026-05-29 17:00:00+02')
) as t(code, title, body, status, priority, owner_agent, estimate_hours, due_at)
join proj p on p.code = t.code
on conflict do nothing;

-- Kickoff brief voor maandag 09:00
insert into public.aquier_ai_lead_briefs (
  brief_type, generated_at, for_date, headline, summary,
  priorities, risks, recommendations, metrics_snapshot
)
values (
  'kickoff',
  '2026-05-23 18:00:00+02',
  '2026-05-25',
  'Aquier project gaat maandag 09:00 live — alles staat klaar',
  'Het volledige masterplan is gereed (25 modules, €3.0M Y1 ARR target, NL→UK→UAE launch sequence). Maandag start sprint W22 met 14 prioritaire taken verdeeld over 9 AI teams. Founder kickoff 09:00 met sprint plan walkthrough. Design partner outreach gaat dezelfde ochtend live. Pre-seed deck v1 deadline vrijdag.',
  jsonb_build_array(
    jsonb_build_object('rank', 1, 'title', 'Kickoff sessie 09:00 — sprint W22 plan vrijgeven', 'owner', 'CHRONOS-AQ'),
    jsonb_build_object('rank', 2, 'title', 'NL design partner outreach wave 1 (15 prospects)', 'owner', 'TITAN-S'),
    jsonb_build_object('rank', 3, 'title', 'Aquier BV juridische entiteit oprichting starten', 'owner', 'ATLAS-A'),
    jsonb_build_object('rank', 4, 'title', 'Investor pitch deck v0.5 (deadline vrijdag)', 'owner', 'ORACLE-IR'),
    jsonb_build_object('rank', 5, 'title', 'GDPR DPIA framework + DPO consultatie initieren', 'owner', 'COMPLIANCE-AI')
  ),
  jsonb_build_array(
    jsonb_build_object('title', 'Cashflow dip risico M3-M6 — pre-arrange RBF tranche', 'level', 'medium'),
    jsonb_build_object('title', 'Funda/Pararius scraping verleiding — strikt vermijden', 'level', 'high'),
    jsonb_build_object('title', 'Founder key-person dependency — documentatie+cross-train vanaf dag 1', 'level', 'high')
  ),
  jsonb_build_array(
    jsonb_build_object('title', 'Start fractional senior dev gesprek deze week (parallel met outreach)'),
    jsonb_build_object('title', 'Kadaster bulk licentie aanvraag deze week indienen (lead-time 6-8 weken)'),
    jsonb_build_object('title', 'RVO MIT subsidie aanvraag voorbereiden (€25K non-dilutive)')
  ),
  jsonb_build_object(
    'masterplan_modules_completed', 9,
    'masterplan_modules_outline', 16,
    'sprint_tasks_planned', 14,
    'first_launch_country', 'NL',
    'launch_quarter', 'Q3-2026',
    'y1_target_eur', 3000000,
    'pre_seed_target_eur', 100000
  )
)
on conflict do nothing;

-- Update AI lead state met laatste/volgende brief tijdstippen
update public.aquier_ai_lead_state
set
  last_brief_at = '2026-05-23 18:00:00+02',
  next_brief_at = '2026-05-25 06:00:00+02'
where id = 'singleton';

-- Initial monitor events
insert into public.aquier_monitor_events (event_at, severity, category, source_agent, title, detail, advice) values
  ('2026-05-23 17:30:00+02', 'success', 'operations', 'VULCAN-INFRA',
   'Dashboard structuur Aquier live in Software-map',
   'Hub + 6 sub-pages + Supabase schema 082 + kickoff seed 083 — alles operationeel',
   'Bevestig migration 082+083 zijn applied; verifieer dat alle pages laden'),
  ('2026-05-23 18:00:00+02', 'info', 'ai', 'CHRONOS-AQ',
   'Kickoff brief gegenereerd voor maandag 09:00',
   '14 taken in sprint W22, 9 owner agents toegewezen, 5 prioriteiten + 3 risico''s + 3 aanbevelingen klaar',
   'Lees brief maandag voor 08:30 zodat kickoff strak verloopt'),
  ('2026-05-23 18:15:00+02', 'warning', 'risk', 'COMPLIANCE-AI',
   'GDPR DPIA framework moet vóór eerste data scrape klaar zijn',
   'Per-source DPIA template ontbreekt. Risico op GDPR breach bij eerste productie data acquisition.',
   'Plan DPO consultatie deze week; budget €4-€6K eerste DPIA batch')
on conflict do nothing;

-- Voorbeelden van approvals waiting decision (geseed door agents)
insert into public.aquier_approvals (
  requested_at, category, title, rationale, proposed_action, impact,
  estimated_cost_eur, proposed_by_agent, status
) values
  ('2026-05-23 18:30:00+02', 'strategie',
   'NL als enige launch markt Q3 2026, UK 3 mnd uitstel',
   'Lagere CAC NL (€165) vs UK (€210) en Orlando-netwerk is sterker in NL. Concentratie op één land in Q3 verhoogt slagingskans design partner conversie.',
   'Schuif UK launch van M7 (Jan 2027) naar M10 (Apr 2027). Compensatie: NL diepte-investering en eerste enterprise sales NL.',
   'Y1 ARR -€80K (UK timing), maar +€140K (NL kwaliteit) = netto +€60K plus lager risico',
   0, 'COMPASS-INT', 'pending'),

  ('2026-05-23 18:45:00+02', 'verbetering',
   'Validation layer v1 features uitbreiden met "comparable confidence per feature"',
   'SAGE-LAB analyse toont dat overall confidence niet voldoende is voor enterprise; per-feature confidence (location, asset class, comparable count) versterkt institutional trust significantly.',
   'Sprint W23: feature-level confidence in validation engine + UI updates. Extra 12u engineering effort.',
   'Hogere enterprise conversie verwacht (+3-5%pp). Geen extra licentiekosten.',
   2400, 'SAGE-LAB', 'pending'),

  ('2026-05-23 19:00:00+02', 'spend',
   'Kadaster bulk licentie aanvragen (€12K Y1)',
   'Kerninfrastructuur voor NL launch. Lead-time 6-8 weken — aanvraag deze week vereist voor Q3 launch.',
   'Pre-payment 50% (€6K) bij aanvraag, restant na approval. Geen alternatief; scraping is geen optie.',
   'Zonder dit: geen NL launch mogelijk. Met dit: NL data layer compleet.',
   12000, 'TREASURY-AI', 'pending')
on conflict do nothing;
