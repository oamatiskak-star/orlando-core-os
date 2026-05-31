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

// ── Startup Investor Scout (fundraising voor Modiwe/Aquier) ──────────────────

export type FundInvestorType =
  | 'vc' | 'angel' | 'family_office' | 'accelerator'
  | 'grant' | 'corporate_vc' | 'rom' | 'crowdfunding'

export type FundProspectStatus =
  | 'nieuw' | 'verrijkt' | 'gekwalificeerd' | 'afgewezen'
  | 'outreach_queued' | 'in_gesprek' | 'term_sheet' | 'gesloten'

export interface FundProspect {
  id: string
  name: string
  investor_type: FundInvestorType
  thesis: string | null
  focus_sectors: string[]
  stage_focus: string[]
  ticket_min_eur: number | null
  ticket_max_eur: number | null
  geo_focus: string[]
  website: string | null
  source: string
  source_url: string | null
  notable_portfolio: string[]
  fit_score: number | null
  fit_reasoning: string | null
  status: FundProspectStatus
  priority: 'laag' | 'normaal' | 'hoog'
  last_action: string | null
  last_action_at: string | null
  next_action_at: string | null
  dedupe_key: string | null
  created_at: string
  updated_at: string
}

export interface FundContact {
  id: string
  prospect_id: string
  name: string
  role: string | null
  email: string | null
  linkedin_url: string | null
  warm_intro_path: string | null
  is_primary: boolean
  crm_contact_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
