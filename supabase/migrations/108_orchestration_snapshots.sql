-- ============================================================================
-- Migration 108: Orchestration Snapshots and Reports
-- ============================================================================
-- Depends on: 107 (ai_ceo_system)
-- Doel: executive_snapshots, strategic_reports, weekly_ceo_reviews
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. EXECUTIVE SNAPSHOTS (daily aggregated financial & operational data)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS executive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  financial JSONB NOT NULL,
  pending_approvals JSONB DEFAULT '[]'::JSONB,
  agent_status JSONB DEFAULT '[]'::JSONB,
  critical_alerts JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_snapshots_date ON executive_snapshots(date DESC);

-- --------------------------------------------------------------------------
-- 2. STRATEGIC REPORTS (daily strategic analysis & insights)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  insights JSONB NOT NULL,
  summary TEXT,
  recommendations JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategic_reports_date ON strategic_reports(date DESC);

-- --------------------------------------------------------------------------
-- 3. WEEKLY CEO REVIEWS (weekly reconciliation records)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_ceo_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  reconciliation_items JSONB NOT NULL,
  approvals_created INT DEFAULT 0,
  completed_by TEXT DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_week_year UNIQUE(week_number, year)
);

CREATE INDEX IF NOT EXISTS idx_weekly_ceo_reviews_date ON weekly_ceo_reviews(date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_ceo_reviews_week ON weekly_ceo_reviews(week_number, year);

-- --------------------------------------------------------------------------
-- 4. RLS POLICIES
-- --------------------------------------------------------------------------
ALTER TABLE executive_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_ceo_reviews ENABLE ROW LEVEL SECURITY;

-- service_role full access
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['executive_snapshots','strategic_reports','weekly_ceo_reviews'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'service_role_full'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "service_role_full" ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- authenticated read access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'executive_snapshots' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON executive_snapshots FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'strategic_reports' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON strategic_reports FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_ceo_reviews' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON weekly_ceo_reviews FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS weekly_ceo_reviews;
-- DROP TABLE IF EXISTS strategic_reports;
-- DROP TABLE IF EXISTS executive_snapshots;
