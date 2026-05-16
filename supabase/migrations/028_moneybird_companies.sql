-- 028: Moneybird multi-company koppeling met directe API keys
-- Slaat administration_id en api_key op per BV — server-side only

CREATE TABLE IF NOT EXISTS public.moneybird_companies (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        text        NOT NULL UNIQUE,           -- 'MODIWERIJO', 'BOUWPROFFS'
  company_name      text        NOT NULL,
  administration_id text        NOT NULL,                  -- Moneybird administratie ID
  api_key           text        NOT NULL,                  -- Direct API token (Bearer)
  digit_email       text,                                  -- Digit brievenbus
  is_active         boolean     DEFAULT true,
  last_sync_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.moneybird_companies ENABLE ROW LEVEL SECURITY;

-- Alleen service_role (server-side) mag lezen — nooit naar client
CREATE POLICY "service_only_select" ON public.moneybird_companies
  FOR SELECT TO service_role USING (true);

CREATE POLICY "service_only_insert" ON public.moneybird_companies
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_only_update" ON public.moneybird_companies
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- Moneybird follow-up log: welke facturen hebben een herinnering ontvangen
CREATE TABLE IF NOT EXISTS public.moneybird_followups (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       text        NOT NULL,
  invoice_id       text        NOT NULL,                  -- Moneybird invoice ID
  invoice_nr       text,
  contact_name     text,
  amount_incl      numeric,
  due_date         date,
  days_overdue     int,
  followup_type    text        DEFAULT 'herinnering',     -- herinnering | aanmaning | incasso
  status           text        DEFAULT 'verzonden',       -- verzonden | genegeerd | betaald
  notes            text,
  sent_at          timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.moneybird_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only_followups" ON public.moneybird_followups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_followups" ON public.moneybird_followups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_followups" ON public.moneybird_followups
  FOR INSERT TO authenticated WITH CHECK (true);

-- Seed: alle drie BV's met directe API keys
INSERT INTO public.moneybird_companies
  (company_id, company_name, administration_id, api_key, digit_email)
VALUES
  (
    'MODIWERIJO',
    'Modiwerijo Financial Management BV',
    '461906748297446498',
    'l5VL_l4FqE9esfsFflNVCPSCB6K2du3ySwCh_RGuGA8',
    'modiwerijo-fef2953b@facturen.moneybird.nl'
  ),
  (
    'BOUWPROFFS',
    'Bouwproffs BV',
    '471239385558287489',
    'maKN9yR3zapZjxR3ONW7TrpUb3LwjPXETfTGcPYPj1g',
    'bouwproffs-07496978@facturen.moneybird.nl'
  ),
  (
    'BOUWPROFFS_HOLDING',
    'Bouwproffs Holding BV',
    '471075953802478696',
    'GGqHWuC4bGOEC5XiQC80QXdXv49xSl3rCibjzHmiQ9E',
    'bouwproffs-ec5196da@facturen.moneybird.nl'
  )
ON CONFLICT (company_id) DO UPDATE SET
  administration_id = EXCLUDED.administration_id,
  api_key           = EXCLUDED.api_key,
  digit_email       = EXCLUDED.digit_email,
  updated_at        = now();
