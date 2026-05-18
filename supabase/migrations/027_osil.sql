-- OSIL: Orlando Strategic Intelligence Layer
-- Central strategic AI command layer above all systems

-- Strategic sessions: AI board meetings, scenario analysis
CREATE TABLE IF NOT EXISTS osil_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL, -- 'board_meeting', 'crisis', 'opportunity', 'quarterly_review'
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'completed'
  priority TEXT NOT NULL DEFAULT 'normaal', -- 'kritiek', 'hoog', 'normaal', 'laag'
  triggered_by TEXT, -- 'manual', 'auto_alert', 'cron'
  company_ids TEXT[] DEFAULT '{}',
  context_snapshot JSONB DEFAULT '{}', -- live KPIs captured at session start
  ai_analysis TEXT,
  ai_recommendations JSONB DEFAULT '[]',
  executive_summary TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategic decisions logged from AI sessions
CREATE TABLE IF NOT EXISTS osil_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES osil_sessions(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL, -- 'go', 'no_go', 'escalate', 'defer', 'investigate'
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_estimate TEXT, -- 'high', 'medium', 'low'
  deadline DATE,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'done', 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunity radar: deals, trends, market signals
CREATE TABLE IF NOT EXISTS osil_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'ai_scan', 'market_signal', 'manual'
  category TEXT NOT NULL, -- 'vastgoed', 'saas', 'youtube', 'financieel', 'legal'
  title TEXT NOT NULL,
  description TEXT,
  potential_value NUMERIC(14,2),
  probability_pct INTEGER DEFAULT 0,
  time_horizon TEXT, -- 'nu', 'kwartaal', 'jaar'
  status TEXT NOT NULL DEFAULT 'radar', -- 'radar', 'onderzoek', 'actief', 'afgewezen', 'gewonnen'
  ai_score INTEGER DEFAULT 0, -- 0-100
  ai_analysis TEXT,
  linked_company_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survival/growth KPI snapshots
CREATE TABLE IF NOT EXISTS osil_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  company_id TEXT NOT NULL,
  -- Cashflow
  cash_balance NUMERIC(14,2) DEFAULT 0,
  monthly_revenue NUMERIC(14,2) DEFAULT 0,
  monthly_costs NUMERIC(14,2) DEFAULT 0,
  burn_rate NUMERIC(14,2) DEFAULT 0,
  runway_months NUMERIC(5,1) DEFAULT 0,
  -- Receivables
  ar_open NUMERIC(14,2) DEFAULT 0,
  ar_overdue NUMERIC(14,2) DEFAULT 0,
  ar_incasso NUMERIC(14,2) DEFAULT 0,
  -- Tax
  btw_debt NUMERIC(14,2) DEFAULT 0,
  vpb_reserve NUMERIC(14,2) DEFAULT 0,
  -- Projects
  active_projects INTEGER DEFAULT 0,
  project_pipeline_value NUMERIC(14,2) DEFAULT 0,
  -- YouTube
  youtube_monthly_revenue NUMERIC(10,2) DEFAULT 0,
  youtube_total_subscribers INTEGER DEFAULT 0,
  -- Mode
  survival_mode BOOLEAN DEFAULT FALSE,
  growth_mode BOOLEAN DEFAULT FALSE,
  ai_verdict TEXT, -- AI assessment text
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts from the OSIL layer
CREATE TABLE IF NOT EXISTS osil_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'cashflow_critical', 'legal_risk', 'tax_deadline', 'opportunity', 'market_signal', 'portfolio_risk'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_action TEXT,
  company_id TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-updated timestamps
CREATE OR REPLACE FUNCTION osil_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'osil_sessions_updated_at') THEN
    CREATE TRIGGER osil_sessions_updated_at BEFORE UPDATE ON osil_sessions FOR EACH ROW EXECUTE FUNCTION osil_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'osil_opportunities_updated_at') THEN
    CREATE TRIGGER osil_opportunities_updated_at BEFORE UPDATE ON osil_opportunities FOR EACH ROW EXECUTE FUNCTION osil_set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE osil_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE osil_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE osil_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE osil_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE osil_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osil_sessions' AND policyname = 'osil_sessions_auth') THEN
    CREATE POLICY osil_sessions_auth ON osil_sessions FOR ALL TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osil_decisions' AND policyname = 'osil_decisions_auth') THEN
    CREATE POLICY osil_decisions_auth ON osil_decisions FOR ALL TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osil_opportunities' AND policyname = 'osil_opportunities_auth') THEN
    CREATE POLICY osil_opportunities_auth ON osil_opportunities FOR ALL TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osil_kpi_snapshots' AND policyname = 'osil_kpi_snapshots_auth') THEN
    CREATE POLICY osil_kpi_snapshots_auth ON osil_kpi_snapshots FOR ALL TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osil_alerts' AND policyname = 'osil_alerts_auth') THEN
    CREATE POLICY osil_alerts_auth ON osil_alerts FOR ALL TO authenticated USING (true);
  END IF;
END $$;
