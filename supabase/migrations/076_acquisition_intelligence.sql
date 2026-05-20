-- ============================================================
-- 076 ACQUISITION INTELLIGENCE LAYER
-- ============================================================

-- acq_deals: Hoofddeal tabel (DealRadar)
CREATE TABLE IF NOT EXISTS acq_deals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  address         text,
  city            text,
  province        text,
  object_type     text,  -- woning/appartement/kantoor/loods/winkel/horeca/industrie/grond
  deal_type       text,  -- aankoop/ontwikkeling/transformatie/splitsing/renovatie
  asking_price    numeric(14,2),
  estimated_value numeric(14,2),
  roi_pct         numeric(6,2),
  margin_pct      numeric(6,2),
  profit_est      numeric(14,2),
  area_m2         numeric(10,2),
  build_year      int,
  energy_label    text,  -- A/B/C/D/E/F/G
  pipeline_stage  text NOT NULL DEFAULT 'radar',  -- radar/analyse/due_diligence/bod/gewonnen/verloren
  ai_score        int CHECK (ai_score >= 0 AND ai_score <= 100),
  risk_score      int CHECK (risk_score >= 0 AND risk_score <= 100),
  source          text,  -- funda/kadaster/offmarket/handmatig/aquier
  source_url      text,
  notes           text,
  status          text NOT NULL DEFAULT 'actief',  -- actief/gearchiveerd
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- acq_deal_scores: AI score history per deal
CREATE TABLE IF NOT EXISTS acq_deal_scores (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id   uuid NOT NULL REFERENCES acq_deals(id) ON DELETE CASCADE,
  score     int NOT NULL,
  reasoning text,
  model     text,
  scored_at timestamptz NOT NULL DEFAULT now()
);

-- acq_build_opps: BouwRadar — bouwopdrachten / ontwikkelkansen
CREATE TABLE IF NOT EXISTS acq_build_opps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  municipality  text,
  province      text,
  opp_type      text,  -- nieuwbouw/renovatie/transformatie/uitbouw/sloop-nieuwbouw
  client        text,
  estimated_value numeric(14,2),
  deadline      date,
  source        text,
  source_url    text,
  pipeline_stage text NOT NULL DEFAULT 'signalering',  -- signalering/analyse/inschrijving/gewonnen/verloren
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- acq_offmarket_leads: Off-market leads
CREATE TABLE IF NOT EXISTS acq_offmarket_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address          text NOT NULL,
  city             text,
  province         text,
  lead_type        text,  -- leegstand/faillissement/slechte_staat/energielabel_fg/stilstand/onderbenutt
  distress_signals jsonb DEFAULT '[]'::jsonb,
  days_vacant      int,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  owner_info       jsonb DEFAULT '{}'::jsonb,
  contact_strategy text,
  dev_scenario     text,
  roi_prognose     numeric(6,2),
  status           text NOT NULL DEFAULT 'nieuw',  -- nieuw/contacted/afgewezen/omgezet
  deal_id          uuid REFERENCES acq_deals(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- acq_permits: Vergunning aanvragen
CREATE TABLE IF NOT EXISTS acq_permits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality     text NOT NULL,
  address          text,
  permit_type      text,  -- omgevingsvergunning/sloopvergunning/splitsingsvergunning/bestemmingswijziging
  applicant        text,
  status           text NOT NULL DEFAULT 'aangevraagd',  -- aangevraagd/verleend/geweigerd/bezwaar/ingetrokken
  submitted_at     date,
  decision_at      date,
  object_type      text,
  area_m2          numeric(10,2),
  floors           int,
  source_url       text,
  relevance_score  int CHECK (relevance_score >= 0 AND relevance_score <= 100),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- acq_municipalities: Gemeente intelligentie
CREATE TABLE IF NOT EXISTS acq_municipalities (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  province                text NOT NULL,
  population              int,
  housing_shortage_score  int CHECK (housing_shortage_score >= 0 AND housing_shortage_score <= 100),
  transformation_policy   text,
  permit_lenience_score   int CHECK (permit_lenience_score >= 0 AND permit_lenience_score <= 100),
  political_stance        text,
  growth_areas            jsonb DEFAULT '[]'::jsonb,
  notes                   text,
  last_updated            timestamptz NOT NULL DEFAULT now()
);

-- acq_investors: Investeerder profielen
CREATE TABLE IF NOT EXISTS acq_investors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  company           text,
  email             text,
  phone             text,
  investment_min    numeric(14,2),
  investment_max    numeric(14,2),
  regions           jsonb DEFAULT '[]'::jsonb,
  risk_profile      text NOT NULL DEFAULT 'midden',  -- laag/midden/hoog
  return_target_pct numeric(6,2),
  object_types      jsonb DEFAULT '[]'::jsonb,
  exit_strategies   jsonb DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'actief',  -- actief/inactief
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- acq_investor_matches: Deal ↔ Investeerder koppelingen
CREATE TABLE IF NOT EXISTS acq_investor_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES acq_deals(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES acq_investors(id) ON DELETE CASCADE,
  match_score int CHECK (match_score >= 0 AND match_score <= 100),
  status      text NOT NULL DEFAULT 'voorgesteld',  -- voorgesteld/gecontacteerd/geïnteresseerd/afgewezen/gecommitteerd
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, investor_id)
);

-- acq_crm_contacts: Acquisitie CRM
CREATE TABLE IF NOT EXISTS acq_crm_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  company        text,
  email          text,
  phone          text,
  contact_type   text,  -- eigenaar/makelaar/investeerder/aannemer/gemeente/notaris/other
  status         text NOT NULL DEFAULT 'actief',  -- actief/inactief/blacklist
  deal_id        uuid REFERENCES acq_deals(id) ON DELETE SET NULL,
  last_contact   timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- acq_outreach_sequences: Outreach campagnes
CREATE TABLE IF NOT EXISTS acq_outreach_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  seq_type      text,  -- email/whatsapp/telefoon/linkedin
  status        text NOT NULL DEFAULT 'concept',  -- concept/actief/gepauzeerd/afgerond
  step_count    int NOT NULL DEFAULT 0,
  response_rate numeric(6,2),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- acq_outreach_messages: Individuele outreach berichten
CREATE TABLE IF NOT EXISTS acq_outreach_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES acq_outreach_sequences(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES acq_crm_contacts(id) ON DELETE SET NULL,
  step_nr     int NOT NULL DEFAULT 1,
  channel     text,  -- email/whatsapp/telefoon/linkedin
  subject     text,
  body        text,
  status      text NOT NULL DEFAULT 'gepland',  -- gepland/verzonden/gelezen/beantwoord/mislukt
  scheduled_at timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- acq_settings: Acquisition settings per user
CREATE TABLE IF NOT EXISTS acq_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  config     jsonb NOT NULL DEFAULT '{
    "landen": ["NL"],
    "provincies": [],
    "roi_min_pct": 8,
    "winst_min_m2": 0,
    "object_types": ["woning","appartement","loods","kantoor"],
    "risicoprofiel": "midden",
    "scrape_frequentie": "dag",
    "ai_aggressiveness": 3,
    "outreach_auto": false,
    "budget_max": null
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- acq_agent_registry: Acquisition agents
CREATE TABLE IF NOT EXISTS acq_agent_registry (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL UNIQUE,
  agent_type     text NOT NULL,  -- DealHunter/OffMarketAI/PermitAI/MunicipalityAI/InvestorAI/OutreachAI/RiskAI/AcquisitionDirectorAI
  status         text NOT NULL DEFAULT 'idle',  -- idle/running/error/disabled
  last_heartbeat timestamptz,
  tasks_done     int NOT NULL DEFAULT 0,
  tasks_failed   int NOT NULL DEFAULT 0,
  config         jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- acq_scan_jobs: Scan jobs voor scraper workers
CREATE TABLE IF NOT EXISTS acq_scan_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name   text NOT NULL,
  job_type     text NOT NULL,  -- deal_scan/offmarket_scan/permit_scan/municipality_scan/investor_scan
  status       text NOT NULL DEFAULT 'queued',  -- queued/running/done/failed
  payload      jsonb DEFAULT '{}'::jsonb,
  result_count int NOT NULL DEFAULT 0,
  error_msg    text,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_acq_deals_pipeline_stage ON acq_deals(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_acq_deals_province ON acq_deals(province);
CREATE INDEX IF NOT EXISTS idx_acq_deals_ai_score ON acq_deals(ai_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_acq_deals_created_at ON acq_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acq_offmarket_status ON acq_offmarket_leads(status);
CREATE INDEX IF NOT EXISTS idx_acq_permits_municipality ON acq_permits(municipality);
CREATE INDEX IF NOT EXISTS idx_acq_permits_status ON acq_permits(status);
CREATE INDEX IF NOT EXISTS idx_acq_investors_status ON acq_investors(status);
CREATE INDEX IF NOT EXISTS idx_acq_scan_jobs_status ON acq_scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_acq_scan_jobs_created ON acq_scan_jobs(created_at DESC);

-- ── updated_at triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION acq_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER acq_deals_updated_at BEFORE UPDATE ON acq_deals
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_build_opps_updated_at BEFORE UPDATE ON acq_build_opps
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_offmarket_leads_updated_at BEFORE UPDATE ON acq_offmarket_leads
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_investors_updated_at BEFORE UPDATE ON acq_investors
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_crm_contacts_updated_at BEFORE UPDATE ON acq_crm_contacts
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_outreach_sequences_updated_at BEFORE UPDATE ON acq_outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER acq_settings_updated_at BEFORE UPDATE ON acq_settings
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();

-- ── Seed default agents (idle) ─────────────────────────────────────────────
INSERT INTO acq_agent_registry (name, agent_type, status) VALUES
  ('DealHunter',            'DealHunter',            'idle'),
  ('OffMarketAI',           'OffMarketAI',            'idle'),
  ('PermitAI',              'PermitAI',               'idle'),
  ('MunicipalityAI',        'MunicipalityAI',         'idle'),
  ('InvestorAI',            'InvestorAI',             'idle'),
  ('OutreachAI',            'OutreachAI',             'idle'),
  ('RiskAI',                'RiskAI',                 'idle'),
  ('AcquisitionDirectorAI', 'AcquisitionDirectorAI',  'idle')
ON CONFLICT (name) DO NOTHING;
