-- Migration 024: CFO Agent — Volledig AI Finance & Accountant systeem
-- Tabellen voor: transacties, leveranciers, belastingreserveringen,
--                cashflow forecast, AI inzichten, risico alerts,
--                maandrapportages, grootboekregels, abonnementen

-- ── cfo_transactions ─────────────────────────────────────────────────────────
-- Alle financiële transacties, gesynchroniseerd vanuit Moneybird + banken
CREATE TABLE IF NOT EXISTS public.cfo_transactions (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            text          NOT NULL,
  source                text          NOT NULL DEFAULT 'moneybird'
                        CHECK (source IN ('moneybird','bunq','ing','handmatig','mail')),
  external_id           text,
  direction             text          NOT NULL CHECK (direction IN ('debet','credit')),
  amount_excl           numeric(12,2) NOT NULL DEFAULT 0,
  amount_vat            numeric(12,2) NOT NULL DEFAULT 0,
  amount_incl           numeric(12,2) NOT NULL DEFAULT 0,
  vat_pct               numeric(5,2)  DEFAULT 21,
  currency              text          NOT NULL DEFAULT 'EUR',
  description           text,
  reference             text,
  supplier_id           uuid,
  ledger_account        text,
  ledger_account_code   text,
  category              text,
  project_id            uuid,
  transaction_date      date          NOT NULL,
  payment_date          date,
  status                text          NOT NULL DEFAULT 'geboekt'
                        CHECK (status IN ('concept','geboekt','betaald','geannuleerd')),
  ai_category           text,
  ai_confidence         numeric(5,2)  DEFAULT 0,
  ai_ledger_suggestion  text,
  approved_by_human     boolean       NOT NULL DEFAULT false,
  moneybird_id          text,
  moneybird_type        text,
  raw_data              jsonb,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_tx_company_idx    ON public.cfo_transactions (company_id);
CREATE INDEX IF NOT EXISTS cfo_tx_date_idx       ON public.cfo_transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS cfo_tx_direction_idx  ON public.cfo_transactions (direction);
CREATE INDEX IF NOT EXISTS cfo_tx_supplier_idx   ON public.cfo_transactions (supplier_id);
CREATE INDEX IF NOT EXISTS cfo_tx_status_idx     ON public.cfo_transactions (status);
CREATE INDEX IF NOT EXISTS cfo_tx_external_idx   ON public.cfo_transactions (external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cfo_tx_mb_unique ON public.cfo_transactions (company_id, moneybird_id, moneybird_type)
  WHERE moneybird_id IS NOT NULL;

ALTER TABLE public.cfo_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_transactions_all ON public.cfo_transactions USING (true);

-- ── cfo_suppliers ─────────────────────────────────────────────────────────────
-- AI-lerende leveranciersdatabase met fingerprinting
CREATE TABLE IF NOT EXISTS public.cfo_suppliers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text          NOT NULL,
  aliases             text[]        NOT NULL DEFAULT '{}',
  kvk                 text,
  btw_number          text,
  iban                text,
  email               text,
  website             text,
  category            text          NOT NULL DEFAULT 'overig',
  subcategory         text,
  default_ledger      text,
  default_ledger_code text,
  default_vat_pct     numeric(5,2)  DEFAULT 21,
  risk_level          text          NOT NULL DEFAULT 'laag'
                      CHECK (risk_level IN ('laag','midden','hoog','kritiek')),
  is_subscription     boolean       NOT NULL DEFAULT false,
  subscription_amount numeric(10,2),
  subscription_cycle  text          CHECK (subscription_cycle IN ('maandelijks','kwartaal','jaarlijks')),
  total_spend_ytd     numeric(12,2) NOT NULL DEFAULT 0,
  total_spend_all     numeric(12,2) NOT NULL DEFAULT 0,
  transaction_count   integer       NOT NULL DEFAULT 0,
  last_invoice_at     date,
  ai_fingerprint      jsonb,
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_suppliers_name_idx ON public.cfo_suppliers (name);
CREATE INDEX IF NOT EXISTS cfo_suppliers_cat_idx  ON public.cfo_suppliers (category);

ALTER TABLE public.cfo_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_suppliers_all ON public.cfo_suppliers USING (true);

-- Foreign key na aanmaken tabel
ALTER TABLE public.cfo_transactions
  ADD CONSTRAINT IF NOT EXISTS cfo_tx_supplier_fk
  FOREIGN KEY (supplier_id) REFERENCES public.cfo_suppliers(id) ON DELETE SET NULL;

-- ── cfo_ledger_rules ─────────────────────────────────────────────────────────
-- Zelflerend grootboek: AI onthoudt welke leverancier naar welk grootboek gaat
CREATE TABLE IF NOT EXISTS public.cfo_ledger_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid        REFERENCES public.cfo_suppliers(id) ON DELETE CASCADE,
  keyword         text,
  company_id      text,
  ledger_account  text        NOT NULL,
  ledger_code     text,
  vat_pct         numeric(5,2) DEFAULT 21,
  confidence      numeric(5,2) NOT NULL DEFAULT 100,
  hit_count       integer     NOT NULL DEFAULT 0,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_ledger_rules_supplier ON public.cfo_ledger_rules (supplier_id);
CREATE INDEX IF NOT EXISTS cfo_ledger_rules_keyword  ON public.cfo_ledger_rules (keyword);

ALTER TABLE public.cfo_ledger_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_ledger_rules_all ON public.cfo_ledger_rules USING (true);

-- ── cfo_tax_reservations ─────────────────────────────────────────────────────
-- BTW, VPB, IB reserveringen per maand per BV
CREATE TABLE IF NOT EXISTS public.cfo_tax_reservations (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text          NOT NULL,
  tax_type        text          NOT NULL CHECK (tax_type IN ('btw','vpb','ib','loonheffing','overig')),
  period_year     integer       NOT NULL,
  period_quarter  integer       CHECK (period_quarter BETWEEN 1 AND 4),
  period_month    integer       CHECK (period_month BETWEEN 1 AND 12),
  amount_required numeric(12,2) NOT NULL DEFAULT 0,
  amount_reserved numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid     numeric(12,2) NOT NULL DEFAULT 0,
  deadline        date,
  status          text          NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','gereserveerd','ingediend','betaald','te_laat')),
  ai_forecast     numeric(12,2),
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_tax_company_idx ON public.cfo_tax_reservations (company_id);
CREATE INDEX IF NOT EXISTS cfo_tax_type_idx    ON public.cfo_tax_reservations (tax_type);
CREATE INDEX IF NOT EXISTS cfo_tax_deadline_idx ON public.cfo_tax_reservations (deadline);
CREATE UNIQUE INDEX IF NOT EXISTS cfo_tax_period_unique
  ON public.cfo_tax_reservations (company_id, tax_type, period_year, period_quarter, period_month)
  WHERE period_month IS NOT NULL;

ALTER TABLE public.cfo_tax_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_tax_reservations_all ON public.cfo_tax_reservations USING (true);

-- ── cfo_cashflow_forecast ─────────────────────────────────────────────────────
-- AI cashflow voorspelling per dag/week/maand
CREATE TABLE IF NOT EXISTS public.cfo_cashflow_forecast (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text          NOT NULL,
  forecast_date   date          NOT NULL,
  period_type     text          NOT NULL DEFAULT 'dag' CHECK (period_type IN ('dag','week','maand')),
  expected_in     numeric(12,2) NOT NULL DEFAULT 0,
  expected_out    numeric(12,2) NOT NULL DEFAULT 0,
  net_flow        numeric(12,2) GENERATED ALWAYS AS (expected_in - expected_out) STORED,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  closing_balance numeric(12,2) GENERATED ALWAYS AS (opening_balance + (expected_in - expected_out)) STORED,
  confidence      numeric(5,2)  DEFAULT 80,
  risk_flag       boolean       NOT NULL DEFAULT false,
  risk_reason     text,
  actuals_in      numeric(12,2),
  actuals_out     numeric(12,2),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_cashflow_company_idx ON public.cfo_cashflow_forecast (company_id);
CREATE INDEX IF NOT EXISTS cfo_cashflow_date_idx    ON public.cfo_cashflow_forecast (forecast_date);
CREATE UNIQUE INDEX IF NOT EXISTS cfo_cashflow_unique
  ON public.cfo_cashflow_forecast (company_id, forecast_date, period_type);

ALTER TABLE public.cfo_cashflow_forecast ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_cashflow_forecast_all ON public.cfo_cashflow_forecast USING (true);

-- ── cfo_ai_insights ───────────────────────────────────────────────────────────
-- AI-gegenereerde financiële inzichten, adviezen en waarschuwingen
CREATE TABLE IF NOT EXISTS public.cfo_ai_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text,
  insight_type    text        NOT NULL
                  CHECK (insight_type IN ('kostenoptimalisatie','omzetgroei','liquiditeit','belasting','risico','groei','anomalie','advies')),
  priority        text        NOT NULL DEFAULT 'middel'
                  CHECK (priority IN ('kritiek','hoog','middel','laag')),
  title           text        NOT NULL,
  body            text        NOT NULL,
  impact_amount   numeric(12,2),
  impact_pct      numeric(5,2),
  action_required boolean     NOT NULL DEFAULT false,
  action_label    text,
  action_url      text,
  is_dismissed    boolean     NOT NULL DEFAULT false,
  dismissed_at    timestamptz,
  ai_model        text,
  confidence      numeric(5,2),
  valid_until     date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_insights_company_idx  ON public.cfo_ai_insights (company_id);
CREATE INDEX IF NOT EXISTS cfo_insights_type_idx     ON public.cfo_ai_insights (insight_type);
CREATE INDEX IF NOT EXISTS cfo_insights_priority_idx ON public.cfo_ai_insights (priority);
CREATE INDEX IF NOT EXISTS cfo_insights_active_idx   ON public.cfo_ai_insights (is_dismissed, created_at DESC);

ALTER TABLE public.cfo_ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_ai_insights_all ON public.cfo_ai_insights USING (true);

-- ── cfo_risk_alerts ───────────────────────────────────────────────────────────
-- Realtime risico alertering
CREATE TABLE IF NOT EXISTS public.cfo_risk_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text,
  alert_type      text        NOT NULL
                  CHECK (alert_type IN ('lage_liquiditeit','hoge_burnrate','openstaande_debiteuren','btw_deadline','vpb_deadline','ib_deadline','loonheffing_deadline','overig_deadline','wanbetaler','vaste_lasten','leverancier_risico','cashflow_kritiek','overig')),
  severity        text        NOT NULL DEFAULT 'medium'
                  CHECK (severity IN ('critical','high','medium','low')),
  title           text        NOT NULL,
  message         text        NOT NULL,
  threshold       numeric(12,2),
  current_value   numeric(12,2),
  is_resolved     boolean     NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     text,
  notified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_alerts_company_idx   ON public.cfo_risk_alerts (company_id);
CREATE INDEX IF NOT EXISTS cfo_alerts_type_idx      ON public.cfo_risk_alerts (alert_type);
CREATE INDEX IF NOT EXISTS cfo_alerts_severity_idx  ON public.cfo_risk_alerts (severity);
CREATE INDEX IF NOT EXISTS cfo_alerts_active_idx    ON public.cfo_risk_alerts (is_resolved, created_at DESC);

ALTER TABLE public.cfo_risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_risk_alerts_all ON public.cfo_risk_alerts USING (true);

-- ── cfo_monthly_reports ───────────────────────────────────────────────────────
-- Gegenereerde maandelijkse CFO PDF rapportages
CREATE TABLE IF NOT EXISTS public.cfo_monthly_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        text,
  period_year       integer     NOT NULL,
  period_month      integer     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  report_type       text        NOT NULL DEFAULT 'cfo_maand'
                    CHECK (report_type IN ('cfo_maand','cfo_kwartaal','cfo_jaar','belasting','liquiditeit')),
  status            text        NOT NULL DEFAULT 'concept'
                    CHECK (status IN ('concept','genereren','gereed','fout')),
  -- Financiële kerngegevens
  revenue_total     numeric(12,2) NOT NULL DEFAULT 0,
  costs_total       numeric(12,2) NOT NULL DEFAULT 0,
  profit_net        numeric(12,2) NOT NULL DEFAULT 0,
  profit_margin_pct numeric(5,2) NOT NULL DEFAULT 0,
  cashflow_end      numeric(12,2) NOT NULL DEFAULT 0,
  btw_to_pay        numeric(12,2) NOT NULL DEFAULT 0,
  vpb_reserved      numeric(12,2) NOT NULL DEFAULT 0,
  debtors_open      numeric(12,2) NOT NULL DEFAULT 0,
  -- AI rapport content
  executive_summary text,
  kpi_data          jsonb,
  cashflow_data     jsonb,
  tax_data          jsonb,
  insights_data     jsonb,
  action_list       jsonb,
  -- Rapport opslag
  pdf_url           text,
  pdf_storage_path  text,
  generated_at      timestamptz,
  generated_by      text        NOT NULL DEFAULT 'cfo_agent',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_reports_company_idx ON public.cfo_monthly_reports (company_id);
CREATE INDEX IF NOT EXISTS cfo_reports_period_idx  ON public.cfo_monthly_reports (period_year, period_month DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cfo_reports_period_unique
  ON public.cfo_monthly_reports (company_id, period_year, period_month, report_type);

ALTER TABLE public.cfo_monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_monthly_reports_all ON public.cfo_monthly_reports USING (true);

-- ── cfo_subscriptions ─────────────────────────────────────────────────────────
-- Gedetecteerde terugkerende kosten / abonnementen
CREATE TABLE IF NOT EXISTS public.cfo_subscriptions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        text          NOT NULL,
  supplier_id       uuid          REFERENCES public.cfo_suppliers(id) ON DELETE SET NULL,
  name              text          NOT NULL,
  description       text,
  category          text          NOT NULL DEFAULT 'software',
  amount_monthly    numeric(10,2) NOT NULL DEFAULT 0,
  amount_yearly     numeric(10,2) GENERATED ALWAYS AS (amount_monthly * 12) STORED,
  currency          text          NOT NULL DEFAULT 'EUR',
  billing_cycle     text          NOT NULL DEFAULT 'maandelijks'
                    CHECK (billing_cycle IN ('maandelijks','kwartaal','jaarlijks','onbekend')),
  next_billing_date date,
  last_seen_date    date,
  is_active         boolean       NOT NULL DEFAULT true,
  is_essential      boolean       NOT NULL DEFAULT false,
  ai_detected       boolean       NOT NULL DEFAULT true,
  ai_confidence     numeric(5,2)  DEFAULT 90,
  notes             text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfo_subs_company_idx ON public.cfo_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS cfo_subs_active_idx  ON public.cfo_subscriptions (is_active, amount_monthly DESC);

ALTER TABLE public.cfo_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_subscriptions_all ON public.cfo_subscriptions USING (true);

-- ── cfo_budget_lines ──────────────────────────────────────────────────────────
-- Budgetregels per BV/divisie/categorie
CREATE TABLE IF NOT EXISTS public.cfo_budget_lines (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text          NOT NULL,
  category        text          NOT NULL,
  period_year     integer       NOT NULL,
  period_month    integer       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  budget_amount   numeric(12,2) NOT NULL DEFAULT 0,
  actual_amount   numeric(12,2) NOT NULL DEFAULT 0,
  variance        numeric(12,2) GENERATED ALWAYS AS (actual_amount - budget_amount) STORED,
  variance_pct    numeric(5,2),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cfo_budget_unique
  ON public.cfo_budget_lines (company_id, category, period_year, period_month);
CREATE INDEX IF NOT EXISTS cfo_budget_company_idx ON public.cfo_budget_lines (company_id, period_year, period_month);

ALTER TABLE public.cfo_budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_budget_lines_all ON public.cfo_budget_lines USING (true);

-- ── cfo_moneybird_sync_log ────────────────────────────────────────────────────
-- Audit log van Moneybird synchronisaties
CREATE TABLE IF NOT EXISTS public.cfo_moneybird_sync_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text        NOT NULL,
  sync_type       text        NOT NULL
                  CHECK (sync_type IN ('facturen','contacten','transacties','grootboek','btw','volledig')),
  status          text        NOT NULL DEFAULT 'gestart'
                  CHECK (status IN ('gestart','voltooid','fout','gedeeltelijk')),
  records_fetched integer     NOT NULL DEFAULT 0,
  records_new     integer     NOT NULL DEFAULT 0,
  records_updated integer     NOT NULL DEFAULT 0,
  records_failed  integer     NOT NULL DEFAULT 0,
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  duration_ms     integer
);

CREATE INDEX IF NOT EXISTS cfo_mb_sync_company_idx ON public.cfo_moneybird_sync_log (company_id);
CREATE INDEX IF NOT EXISTS cfo_mb_sync_started_idx ON public.cfo_moneybird_sync_log (started_at DESC);

ALTER TABLE public.cfo_moneybird_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfo_moneybird_sync_log_all ON public.cfo_moneybird_sync_log USING (true);

-- ── Trigger: updated_at auto-update ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cfo_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cfo_transactions','cfo_suppliers','cfo_tax_reservations',
    'cfo_subscriptions','cfo_budget_lines'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.cfo_set_updated_at()', t);
  END LOOP;
END;
$$;
