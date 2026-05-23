-- ─────────────────────────────────────────────────────────────────────────
-- Migration 086 — Aquier Projects Timeline
-- ─────────────────────────────────────────────────────────────────────────
-- Bron: 25_IMPLEMENTATION_ROADMAP/ROADMAP.md (5 phases over 14 maanden)
-- Doel:
--   1) Backfill start_at/due_at op de 26 bestaande masterplan-doc-projects
--      (retrospectief: dit zijn strategie-docs uit april-juni 2026)
--   2) Insert 14 nieuwe execution-projects (AQ-EX-M-1 t/m AQ-EX-M12) voor
--      de maand-per-maand uitvoering vanaf kickoff 2026-05-25 t/m EOY1
--      (juni 2027). Stuk-voor-stuk gemapped op ROADMAP.md month-blocks.

-- ── deel 1: backfill bestaande masterplan-doc-projects ───────────────────
-- Strategie-docs liepen feitelijk april-mei 2026 (M-2/M-1 fase).
-- Completed → start in M-2 (april), due eind M-1 (mei).
-- In_progress → start M-1, due M0 (juni 2026, MVP beta close).
update public.aquier_projects
   set start_at = '2026-04-01 09:00:00+02',
       due_at   = '2026-05-23 18:00:00+02',
       updated_at = now()
 where code in (
   'AQ-M00', 'AQ-M01', 'AQ-M02', 'AQ-M04',
   'AQ-M15', 'AQ-M18', 'AQ-M21', 'AQ-M25'
 ) and status = 'completed';

update public.aquier_projects
   set start_at = '2026-05-01 09:00:00+02',
       due_at   = '2026-06-30 18:00:00+02',
       updated_at = now()
 where code in (
   'AQ-M03', 'AQ-M05', 'AQ-M06', 'AQ-M07', 'AQ-M08', 'AQ-M09',
   'AQ-M10', 'AQ-M11', 'AQ-M12', 'AQ-M13', 'AQ-M14',
   'AQ-M16', 'AQ-M17', 'AQ-M19', 'AQ-M20',
   'AQ-M22', 'AQ-M23', 'AQ-M24'
 ) and status in ('in_progress', 'planned');

-- ── deel 2: nieuwe execution projects per roadmap-maand ──────────────────
-- Status logica:
--   M-1 (huidige maand, kickoff 2026-05-25)  → in_progress
--   M0+ (juni 2026+)                          → planned
-- Priority logica:
--   Launch milestones (M1 NL, M7 UK, M9 UAE, M12 DE/ES) → critical
--   Funding milestones (M0 pre-seed, M11 seed)          → critical
--   Quarterly reviews / hires                            → high
--   Tussenmaanden                                        → medium

insert into public.aquier_projects (
  code, name, module_ref, description,
  status, priority, progress_pct, owner_agent,
  start_at, due_at, metadata
)
values
  ('AQ-EX-M-1', 'M-1 · MVP Alpha + Design Partner Outreach',
   '25_IMPLEMENTATION_ROADMAP',
   'MVP alpha (scoring + reporting + dashboard) live; 15 outreach → 5-7 design partners close; LinkedIn presence + 4 thought-leadership posts; pre-seed deck v1.',
   'in_progress', 'critical', 25, 'CHRONOS-AQ',
   '2026-05-25 09:00:00+02', '2026-05-31 23:59:59+02',
   jsonb_build_object('phase', '0_Foundation', 'month_index', -1, 'mrr_target_eur', 0, 'customers_target', 0)),

  ('AQ-EX-M0', 'M0 · MVP Beta + Pre-seed €100K Close',
   '25_IMPLEMENTATION_ROADMAP',
   'MVP beta met 5 design partners; daily feedback loop; pre-seed €100K target close eind maand; fractional senior full-stack start; GDPR DPIA + ToS + Privacy Policy NL.',
   'planned', 'critical', 0, 'ORACLE-IR',
   '2026-06-01 09:00:00+02', '2026-06-30 23:59:59+02',
   jsonb_build_object('phase', '0_Foundation', 'month_index', 0, 'mrr_target_eur', 0, 'customers_target', 5)),

  ('AQ-EX-M1', 'M1 · NL LAUNCH — Aquier Pro v1.0 Live',
   '25_IMPLEMENTATION_ROADMAP',
   'Aquier Pro v1.0 public; Pro Starter €99/mo + Pro Premium €499/mo; LinkedIn NL paid €8K; Orlando direct outreach 10 demos; PHOENIX-CS + MIDAS-REV activated; eerste Deal-of-the-Day.',
   'planned', 'critical', 0, 'TITAN-S',
   '2026-07-01 09:00:00+02', '2026-07-31 23:59:59+02',
   jsonb_build_object('phase', '1_NL_Launch', 'month_index', 1, 'mrr_target_eur', 2500, 'customers_target', 10)),

  ('AQ-EX-M2', 'M2 · NL Traction + v1.1',
   '25_IMPLEMENTATION_ROADMAP',
   'Product v1.1 op M1 feedback; eerste enterprise pilot gesprek (1 family office); webinar #1 "Off-market intelligence NL Q3 2026".',
   'planned', 'high', 0, 'TITAN-S',
   '2026-08-01 09:00:00+02', '2026-08-31 23:59:59+02',
   jsonb_build_object('phase', '1_NL_Launch', 'month_index', 2, 'mrr_target_eur', 5500, 'customers_target', 22)),

  ('AQ-EX-M3', 'M3 · Q1 Review + v1.2 JV Matching Beta',
   '25_IMPLEMENTATION_ROADMAP',
   'v1.2 JV matching beta; enterprise pilot → paid conversion attempt; Belgium data feed; RBF €40K bridge tranche optioneel; pivot triggers Q1.',
   'planned', 'high', 0, 'CHRONOS-AQ',
   '2026-09-01 09:00:00+02', '2026-09-30 23:59:59+02',
   jsonb_build_object('phase', '1_NL_Launch', 'month_index', 3, 'mrr_target_eur', 9700, 'customers_target', 38)),

  ('AQ-EX-M4', 'M4 · UK PREP + Land Registry Integration',
   '25_IMPLEMENTATION_ROADMAP',
   'v1.3 UK Land Registry preview; UK entity (Ltd) + GDPR alignment; UK content + LinkedIn ads; Marketing/Content Lead start €5.5K/mo; 1ste enterprise paid €25K/yr.',
   'planned', 'high', 0, 'HERALD-C',
   '2026-10-01 09:00:00+02', '2026-10-31 23:59:59+02',
   jsonb_build_object('phase', '2_UK_Expansion', 'month_index', 4, 'mrr_target_eur', 13400, 'customers_target', 55)),

  ('AQ-EX-M5', 'M5 · UK Design Partners + EXPO REAL Munich',
   '25_IMPLEMENTATION_ROADMAP',
   'v1.4 full UK dataset live; UK design partners outreach (5 target); EXPO REAL Munich networking; €15K acquisition success fee.',
   'planned', 'medium', 0, 'TITAN-S',
   '2026-11-01 09:00:00+02', '2026-11-30 23:59:59+02',
   jsonb_build_object('phase', '2_UK_Expansion', 'month_index', 5, 'mrr_target_eur', 17300, 'customers_target', 72)),

  ('AQ-EX-M6', 'M6 · Senior Backend FT Hire + Q2 Review',
   '25_IMPLEMENTATION_ROADMAP',
   'Senior Backend Dev FT (€8K/mo); v1.5 stability+scaling; year-end annual prepay (15% discount); Q2 close — full forecast vs actual; pivot if >20% off.',
   'planned', 'high', 0, 'VULCAN-INFRA',
   '2026-12-01 09:00:00+02', '2026-12-31 23:59:59+02',
   jsonb_build_object('phase', '2_UK_Expansion', 'month_index', 6, 'mrr_target_eur', 21200, 'customers_target', 90)),

  ('AQ-EX-M7', 'M7 · UK LAUNCH — Public Go-Live',
   '25_IMPLEMENTATION_ROADMAP',
   'UK public launch; eerste 8 UK design partners + 5 UK customers; Enterprise Sales Lead (€7K/mo + commission); UK campaign €15K/mo; €150K SAFE bridge optioneel.',
   'planned', 'critical', 0, 'TITAN-S',
   '2027-01-01 09:00:00+02', '2027-01-31 23:59:59+02',
   jsonb_build_object('phase', '2_UK_Expansion', 'month_index', 7, 'mrr_target_eur', 26800, 'customers_target', 115)),

  ('AQ-EX-M8', 'M8 · v2.0 Multi-country UI + UK Enterprise Pipeline',
   '25_IMPLEMENTATION_ROADMAP',
   'v2.0 multi-country UI + FX normalization; UK enterprise pipeline (10 prospects); sales-led growth in volle gang.',
   'planned', 'medium', 0, 'SAGE-LAB',
   '2027-02-01 09:00:00+02', '2027-02-28 23:59:59+02',
   jsonb_build_object('phase', '3_UAE_Entry', 'month_index', 8, 'mrr_target_eur', 33300, 'customers_target', 148)),

  ('AQ-EX-M9', 'M9 · UAE SOFT LAUNCH — DIFC + Reidin Data',
   '25_IMPLEMENTATION_ROADMAP',
   'UAE soft launch via DIFC partnership + Reidin data deal; AI/Data Engineer FT (€7K/mo); v2.1 UAE DLD + Arabic UI; Cityscape Dubai pre-show outreach; 1ste white-label pilot €8K/mo.',
   'planned', 'critical', 0, 'COMPASS-INT',
   '2027-03-01 09:00:00+02', '2027-03-31 23:59:59+02',
   jsonb_build_object('phase', '3_UAE_Entry', 'month_index', 9, 'mrr_target_eur', 40300, 'customers_target', 180)),

  ('AQ-EX-M10', 'M10 · UAE Growth + Customer Success Lead',
   '25_IMPLEMENTATION_ROADMAP',
   'Customer Success Lead (€5K/mo); UAE family office outreach via Orlando-netwerk; SAGE-LAB confidence scoring v2; cross-country dataset maturity.',
   'planned', 'high', 0, 'PHOENIX-CS',
   '2027-04-01 09:00:00+02', '2027-04-30 23:59:59+02',
   jsonb_build_object('phase', '3_UAE_Entry', 'month_index', 10, 'mrr_target_eur', 47500, 'customers_target', 215)),

  ('AQ-EX-M11', 'M11 · DE+ES Prep + Seed €250K Close',
   '25_IMPLEMENTATION_ROADMAP',
   'Seed €250K close target (€150K Horizon + €100K angels); DE GmbH + ES SL entity formation; DE+ES content adaptation; €40K acquisition success fee.',
   'planned', 'critical', 0, 'ORACLE-IR',
   '2027-05-01 09:00:00+02', '2027-05-31 23:59:59+02',
   jsonb_build_object('phase', '4_EU_Scaling', 'month_index', 11, 'mrr_target_eur', 55200, 'customers_target', 255)),

  ('AQ-EX-M12', 'M12 · DE+ES LAUNCH + EOY1 — €3M ARR Y1 Close',
   '25_IMPLEMENTATION_ROADMAP',
   'DE + ES public launch (parallel); SIMA Madrid (ES kickoff); IZ Immobilien Zeitung partnership; EOY1 ARR run-rate ~€2.0M; total Y1 reportable revenue €3.0M target.',
   'planned', 'critical', 0, 'CHRONOS-AQ',
   '2027-06-01 09:00:00+02', '2027-06-30 23:59:59+02',
   jsonb_build_object('phase', '4_EU_Scaling', 'month_index', 12, 'mrr_target_eur', 63800, 'customers_target', 300))
on conflict (code) do update set
  name        = excluded.name,
  description = excluded.description,
  status      = excluded.status,
  priority    = excluded.priority,
  start_at    = excluded.start_at,
  due_at      = excluded.due_at,
  module_ref  = excluded.module_ref,
  metadata    = excluded.metadata,
  updated_at  = now();
