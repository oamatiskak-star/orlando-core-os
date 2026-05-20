export interface AcqScanJob {
  id: string
  agent_name: string
  job_type: string
  status: 'queued' | 'running' | 'done' | 'failed'
  payload: Record<string, unknown>
  result_count: number
  error_msg: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface AcqDeal {
  id: string
  title: string
  address: string | null
  city: string | null
  province: string | null
  object_type: string | null
  deal_type: string | null
  asking_price: number | null
  estimated_value: number | null
  roi_pct: number | null
  margin_pct: number | null
  profit_est: number | null
  area_m2: number | null
  build_year: number | null
  energy_label: string | null
  pipeline_stage: string
  ai_score: number | null
  risk_score: number | null
  source: string | null
  notes: string | null
  status: string
  created_at: string
}

export interface AgentRunResult {
  agent: string
  jobsProcessed: number
  jobsCreated: number
  duration_ms: number
}
