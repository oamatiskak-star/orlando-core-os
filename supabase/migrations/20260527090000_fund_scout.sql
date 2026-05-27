-- ============================================================================
-- Startup Investor Scout — fundraising voor Modiwe/Aquier (bedrijf, NIET vastgoed)
-- Schema: public | Supabase ref: shaunumewswpxhmgbtvv (orlando-core-os)
-- ----------------------------------------------------------------------------
-- Doel: bedrijfs-financiers (VC's, angels, family offices, accelerators, grants)
-- vinden voor de cap table van Modiwe/Aquier. Volledig los van de bestaande
-- vastgoed-pipeline (acq_investors / acq_investor_matches blijven ongemoeid).
--
-- NB RLS: de bestaande acq_* tabellen draaien ZONDER row level security
-- (de service-role engine schrijft direct). De fund_* tabellen spiegelen dit
-- bewust: geen RLS, schrijftoegang uitsluitend via de service-role engine.
-- ============================================================================

-- 1) PROSPECTS — de leads (funds/angels/accelerators/grants)
CREATE TABLE IF NOT EXISTS public.fund_prospects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,                         -- fund/persoon/programma
  investor_type     text NOT NULL,                         -- vc/angel/family_office/accelerator/grant/corporate_vc/rom/crowdfunding
  thesis            text,                                  -- focus/these (vrije tekst)
  focus_sectors     jsonb NOT NULL DEFAULT '[]'::jsonb,    -- ["proptech","ai","saas","real-estate"]
  stage_focus       jsonb NOT NULL DEFAULT '[]'::jsonb,    -- ["pre_seed","seed","series_a","grant","rolling"]
  ticket_min_eur    numeric(14,2),
  ticket_max_eur    numeric(14,2),
  geo_focus         jsonb NOT NULL DEFAULT '[]'::jsonb,    -- ["NL","EU","DACH","benelux","global"]
  website           text,
  source            text NOT NULL,                         -- openvc/crunchbase/dealroom/f6s/rvo/eu_portal/rom/linkedin_manual/seed_csv
  source_url        text,
  notable_portfolio jsonb NOT NULL DEFAULT '[]'::jsonb,    -- bekende proptech/ai deals
  fit_score         integer CHECK (fit_score >= 0 AND fit_score <= 100),
  fit_reasoning     text,                                  -- waarom deze score (uitlegbaar)
  status            text NOT NULL DEFAULT 'nieuw',         -- nieuw/verrijkt/gekwalificeerd/afgewezen/outreach_queued/in_gesprek/term_sheet/gesloten
  priority          text NOT NULL DEFAULT 'normaal',       -- laag/normaal/hoog
  last_action       text,
  last_action_at    timestamptz,
  next_action_at    timestamptz,
  dedupe_key        text UNIQUE,                           -- lower(name)+'|'+domain(website), voor dedupe
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_prospects_status   ON public.fund_prospects (status);
CREATE INDEX IF NOT EXISTS idx_fund_prospects_fitscore ON public.fund_prospects (fit_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fund_prospects_type     ON public.fund_prospects (investor_type);

-- 2) CONTACTS — partners/personen bij een prospect (apart van acq_crm_contacts)
CREATE TABLE IF NOT EXISTS public.fund_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES public.fund_prospects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text,                                    -- "Partner", "Investment Manager"
  email           text,
  linkedin_url    text,
  warm_intro_path text,                                    -- hoe Orlando warm bij deze persoon komt (mens-in-de-loop)
  is_primary      boolean NOT NULL DEFAULT false,
  -- crm_contact_id: shadow-koppeling naar bestaande outreach-machinerie (acq_crm_contacts)
  crm_contact_id  uuid REFERENCES public.acq_crm_contacts(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_contacts_prospect ON public.fund_contacts (prospect_id);
CREATE INDEX IF NOT EXISTS idx_fund_contacts_crm      ON public.fund_contacts (crm_contact_id);

-- 3) ACTIVITY LOG — elke agent-actie + outreach-koppeling (audit/uitlegbaar)
CREATE TABLE IF NOT EXISTS public.fund_activity_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id         uuid REFERENCES public.fund_prospects(id) ON DELETE CASCADE,
  agent               text NOT NULL,                       -- InvestorScoutAI/FundOutreachAI
  action              text NOT NULL,                       -- discovered/enriched/scored/deduped/queued_outreach/drafted_email/approved/sent/replied/status_change
  detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
  outreach_message_id uuid REFERENCES public.acq_outreach_messages(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_activity_prospect ON public.fund_activity_log (prospect_id);
CREATE INDEX IF NOT EXISTS idx_fund_activity_agent    ON public.fund_activity_log (agent);
CREATE INDEX IF NOT EXISTS idx_fund_activity_created  ON public.fund_activity_log (created_at DESC);

-- ── updated_at triggers (hergebruik bestaande acq_set_updated_at() uit 076) ──
CREATE TRIGGER fund_prospects_updated_at BEFORE UPDATE ON public.fund_prospects
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();
CREATE TRIGGER fund_contacts_updated_at BEFORE UPDATE ON public.fund_contacts
  FOR EACH ROW EXECUTE FUNCTION acq_set_updated_at();

-- 4) Registreer de twee nieuwe agents in het bestaande registry
INSERT INTO public.acq_agent_registry (name, agent_type, status) VALUES
  ('InvestorScoutAI', 'InvestorScoutAI', 'idle'),
  ('FundOutreachAI',  'FundOutreachAI',  'idle')
ON CONFLICT (name) DO NOTHING;

-- 5) Eén outreach-sequence voor fundraising (hergebruik bestaande outreach-tabellen).
--    acq_outreach_sequences.name heeft GEEN unique constraint, dus idempotent via WHERE NOT EXISTS.
INSERT INTO public.acq_outreach_sequences (name, seq_type, status, step_count, notes)
SELECT 'Fundraising — Aquier/Modiwe', 'fundraising', 'actief', 3,
       'Cold-email sequence richting startup-investeerders. Drafts via FundOutreachAI, verzending alleen na approval via Orlando-account.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.acq_outreach_sequences WHERE name = 'Fundraising — Aquier/Modiwe'
);
