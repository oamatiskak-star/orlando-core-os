-- ============================================================================
-- Migration 107: AI CEO System (ORLAND-O) — tables for orchestration
-- ============================================================================
-- Depends on: 104 (hermes schema)
-- Doel: ai_ceo_runs, approval_queue, morning_briefs, agent_registry
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. AI CEO RUNS (ORLAND-O execution records)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_ceo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT DEFAULT 'manual',
  summary TEXT,
  critical_alerts JSONB DEFAULT '[]'::JSONB,
  execution_plan JSONB NOT NULL,
  orlando_personal_tasks JSONB DEFAULT '[]'::JSONB,
  blockers JSONB DEFAULT '[]'::JSONB,
  autonomous_dispatched INT DEFAULT 0,
  approval_queued INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_ceo_runs_created ON ai_ceo_runs(created_at DESC);

-- --------------------------------------------------------------------------
-- 2. APPROVAL QUEUE (items awaiting Orlando's decisions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES ai_ceo_runs(id) ON DELETE SET NULL,
  source_table TEXT,
  source_id TEXT,
  title TEXT NOT NULL,
  entity TEXT,
  assigned_agent TEXT,
  priority_score INT,
  week INT,
  estimated_hours NUMERIC,
  checkpoints JSONB NOT NULL,
  current_checkpoint INT DEFAULT 0,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_approval','approved','declined','in_progress','completed','skipped')),
  last_decision TEXT,
  last_decision_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_entity ON approval_queue(entity);
CREATE INDEX IF NOT EXISTS idx_approval_queue_run ON approval_queue(run_id);

-- --------------------------------------------------------------------------
-- 3. MORNING BRIEFS (daily briefings per entity)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS morning_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  generated_by TEXT DEFAULT 'IRIS',
  orlando_tasks JSONB NOT NULL,
  ai_ceo_tasks_today JSONB NOT NULL,
  approvals_pending JSONB DEFAULT '[]'::JSONB,
  per_entity JSONB NOT NULL,
  summary TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_morning_briefs_date ON morning_briefs(date DESC);

-- --------------------------------------------------------------------------
-- 4. AGENT REGISTRY (all management agents)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  entity TEXT,
  reports_to TEXT,
  capabilities TEXT[],
  worker_type TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_name ON agent_registry(name);
CREATE INDEX IF NOT EXISTS idx_agent_registry_active ON agent_registry(is_active);

-- --------------------------------------------------------------------------
-- 5. RLS POLICIES
-- --------------------------------------------------------------------------
ALTER TABLE ai_ceo_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

-- service_role full access
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_ceo_runs','approval_queue','morning_briefs','agent_registry'] LOOP
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_ceo_runs' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON ai_ceo_runs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approval_queue' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON approval_queue FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'morning_briefs' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON morning_briefs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_registry' AND policyname = 'auth_read') THEN
    CREATE POLICY "auth_read" ON agent_registry FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- DROP TABLE IF EXISTS agent_registry;
-- DROP TABLE IF EXISTS morning_briefs;
-- DROP TABLE IF EXISTS approval_queue;
-- DROP TABLE IF EXISTS ai_ceo_runs;
