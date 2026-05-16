-- 029: Persoonlijke bankrekening koppeling (GoCardless PSD2), transacties, budgetten, DGA loonstroken

-- Bank connections (GoCardless requisitions)
CREATE TABLE IF NOT EXISTS public.personal_bank_connections (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_name        text        NOT NULL DEFAULT 'Orlando Amatiskak',
  bank_id           text        NOT NULL,                        -- 'ING_INGBNL2A', etc.
  bank_name         text        NOT NULL,
  gocardless_req_id text,                                        -- requisition ID van GoCardless
  gocardless_account_id text,                                    -- account ID na autorisatie
  iban              text,
  currency          text        DEFAULT 'EUR',
  status            text        DEFAULT 'pending',               -- pending | active | expired | error
  access_expires_at timestamptz,
  last_sync_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.personal_bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_bank_conn" ON public.personal_bank_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_bank_conn" ON public.personal_bank_connections
  FOR SELECT TO authenticated USING (true);

-- GoCardless credentials (server-side only)
CREATE TABLE IF NOT EXISTS public.personal_bank_credentials (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider       text NOT NULL DEFAULT 'gocardless',
  secret_id      text NOT NULL,
  secret_key     text NOT NULL,
  access_token   text,
  token_expires  timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.personal_bank_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_cred" ON public.personal_bank_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Persoonlijke banktransacties
CREATE TABLE IF NOT EXISTS public.personal_transactions (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id     uuid        REFERENCES public.personal_bank_connections(id) ON DELETE CASCADE,
  external_id       text        NOT NULL UNIQUE,                 -- GoCardless transaction ID
  booking_date      date,
  value_date        date,
  amount            numeric(12,2) NOT NULL,
  currency          text        DEFAULT 'EUR',
  description       text,
  creditor_name     text,
  debtor_name       text,
  creditor_iban     text,
  debtor_iban       text,
  reference         text,
  direction         text        NOT NULL,                        -- 'credit' | 'debet'
  category          text        DEFAULT 'overig',               -- ai categorisering
  subcategory       text,
  ai_confidence     numeric(4,2) DEFAULT 0,
  is_salary         boolean     DEFAULT false,
  is_savings        boolean     DEFAULT false,
  is_investment     boolean     DEFAULT false,
  is_housing        boolean     DEFAULT false,
  budget_id         uuid,
  notes             text,
  raw_data          jsonb,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_tx_date_idx  ON public.personal_transactions(booking_date DESC);
CREATE INDEX IF NOT EXISTS personal_tx_conn_idx  ON public.personal_transactions(connection_id);
CREATE INDEX IF NOT EXISTS personal_tx_cat_idx   ON public.personal_transactions(category);

ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_tx" ON public.personal_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_tx" ON public.personal_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_tx" ON public.personal_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Persoonlijke budgetten per categorie
CREATE TABLE IF NOT EXISTS public.personal_budgets (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  category      text        NOT NULL,
  maandbudget   numeric(10,2) NOT NULL DEFAULT 0,
  kleur         text        DEFAULT '#6366f1',
  icon          text        DEFAULT 'wallet',
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(category)
);

ALTER TABLE public.personal_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_budgets" ON public.personal_budgets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Standaard budgetten seeden
INSERT INTO public.personal_budgets (category, maandbudget, kleur) VALUES
  ('wonen',         1500, '#6366f1'),
  ('boodschappen',   600, '#22c55e'),
  ('auto',           400, '#f59e0b'),
  ('kleding',        200, '#ec4899'),
  ('horeca',         300, '#f97316'),
  ('abonnementen',   150, '#8b5cf6'),
  ('gezondheid',     100, '#14b8a6'),
  ('sport',           80, '#06b6d4'),
  ('entertainment',  150, '#a855f7'),
  ('sparen',         500, '#10b981'),
  ('investeren',     500, '#3b82f6'),
  ('overig',         300, '#94a3b8')
ON CONFLICT (category) DO NOTHING;

-- DGA Loonstroken
CREATE TABLE IF NOT EXISTS public.dga_loonstroken (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  periode           text        NOT NULL,                        -- '2025-05'
  bruto             numeric(10,2) NOT NULL,
  loonheffing       numeric(10,2) NOT NULL,
  heffingskorting   numeric(10,2) NOT NULL DEFAULT 0,
  zvw_bijdrage      numeric(10,2) NOT NULL DEFAULT 0,
  netto             numeric(10,2) NOT NULL,
  vakantiegeld      numeric(10,2) DEFAULT 0,
  pensioen          numeric(10,2) DEFAULT 0,
  overuren          numeric(10,2) DEFAULT 0,
  bonus             numeric(10,2) DEFAULT 0,
  betaald_op        date,
  status            text        DEFAULT 'concept',               -- concept | definitief | betaald
  pdf_url           text,
  berekenings_data  jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(periode)
);

ALTER TABLE public.dga_loonstroken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_dga_loon" ON public.dga_loonstroken
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Maandelijkse persoonlijke financiën snapshot
CREATE TABLE IF NOT EXISTS public.personal_finance_snapshots (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  periode            text        NOT NULL UNIQUE,                -- '2025-05'
  netto_inkomen      numeric(12,2) DEFAULT 0,
  totaal_uitgaven    numeric(12,2) DEFAULT 0,
  netto_cashflow     numeric(12,2) DEFAULT 0,
  spaarsaldo         numeric(12,2) DEFAULT 0,
  beleggingen        numeric(12,2) DEFAULT 0,
  schulden           numeric(12,2) DEFAULT 0,
  netto_vermogen     numeric(12,2) DEFAULT 0,
  spaarquote_pct     numeric(5,2)  DEFAULT 0,
  uitgaven_per_cat   jsonb,
  created_at         timestamptz  DEFAULT now(),
  updated_at         timestamptz  DEFAULT now()
);

ALTER TABLE public.personal_finance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_snapshots" ON public.personal_finance_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
