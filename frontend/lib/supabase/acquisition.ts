import { createClient } from './server'

export type AcqDeal = {
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
  source_url: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

export type AcqOffmarketLead = {
  id: string
  address: string
  city: string | null
  province: string | null
  lead_type: string | null
  distress_signals: string[]
  days_vacant: number | null
  detected_at: string
  owner_info: Record<string, unknown>
  contact_strategy: string | null
  dev_scenario: string | null
  roi_prognose: number | null
  status: string
  deal_id: string | null
  notes: string | null
  created_at: string
}

export type AcqPermit = {
  id: string
  municipality: string
  address: string | null
  permit_type: string | null
  applicant: string | null
  status: string
  submitted_at: string | null
  decision_at: string | null
  object_type: string | null
  area_m2: number | null
  floors: number | null
  source_url: string | null
  relevance_score: number | null
  notes: string | null
  created_at: string
}

export type AcqMunicipality = {
  id: string
  name: string
  province: string
  population: number | null
  housing_shortage_score: number | null
  transformation_policy: string | null
  permit_lenience_score: number | null
  political_stance: string | null
  growth_areas: string[]
  notes: string | null
  last_updated: string
}

export type AcqInvestor = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  investment_min: number | null
  investment_max: number | null
  regions: string[]
  risk_profile: string
  return_target_pct: number | null
  object_types: string[]
  exit_strategies: string[]
  status: string
  notes: string | null
  created_at: string
}

export type AcqCrmContact = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  contact_type: string | null
  status: string
  deal_id: string | null
  last_contact: string | null
  notes: string | null
  created_at: string
}

export type AcqOutreachSequence = {
  id: string
  name: string
  seq_type: string | null
  status: string
  step_count: number
  response_rate: number | null
  notes: string | null
  created_at: string
}

export type AcqSettings = {
  id: string
  user_id: string | null
  config: {
    landen: string[]
    provincies: string[]
    roi_min_pct: number
    winst_min_m2: number
    object_types: string[]
    risicoprofiel: string
    scrape_frequentie: string
    ai_aggressiveness: number
    outreach_auto: boolean
    budget_max: number | null
  }
  created_at: string
  updated_at: string
}

export type AcqAgent = {
  id: string
  name: string
  agent_type: string
  status: string
  last_heartbeat: string | null
  tasks_done: number
  tasks_failed: number
  config: Record<string, unknown>
  created_at: string
}

export type AcqScanJob = {
  id: string
  agent_name: string
  job_type: string
  status: string
  payload: Record<string, unknown>
  result_count: number
  error_msg: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export type AcqBuildOpp = {
  id: string
  title: string
  municipality: string | null
  province: string | null
  opp_type: string | null
  client: string | null
  estimated_value: number | null
  deadline: string | null
  source: string | null
  source_url: string | null
  pipeline_stage: string
  notes: string | null
  created_at: string
}

export type AcqDealStats = {
  total: number
  actief: number
  pipeline_waarde: number
  avg_roi: number
  avg_score: number
  offmarket_total: number
  investor_total: number
  permit_total: number
}

export async function getAcqDeals(filters?: {
  province?: string
  object_type?: string
  pipeline_stage?: string
  min_roi?: number
  min_score?: number
}): Promise<AcqDeal[]> {
  const supabase = await createClient()
  let query = supabase
    .from('acq_deals')
    .select('*')
    .eq('status', 'actief')
    .order('created_at', { ascending: false })

  if (filters?.province) query = query.eq('province', filters.province)
  if (filters?.object_type) query = query.eq('object_type', filters.object_type)
  if (filters?.pipeline_stage) query = query.eq('pipeline_stage', filters.pipeline_stage)
  if (filters?.min_roi) query = query.gte('roi_pct', filters.min_roi)
  if (filters?.min_score) query = query.gte('ai_score', filters.min_score)

  const { data } = await query
  return (data ?? []) as AcqDeal[]
}

export async function getAcqDealById(id: string): Promise<AcqDeal | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_deals')
    .select('*')
    .eq('id', id)
    .single()
  return data as AcqDeal | null
}

export async function getAcqBuildOpps(): Promise<AcqBuildOpp[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_build_opps')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as AcqBuildOpp[]
}

export async function getAcqBuildOppById(id: string): Promise<AcqBuildOpp | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_build_opps')
    .select('*')
    .eq('id', id)
    .single()
  return data as AcqBuildOpp | null
}

export async function getAcqOffmarketLeads(filters?: {
  lead_type?: string
  province?: string
  status?: string
}): Promise<AcqOffmarketLead[]> {
  const supabase = await createClient()
  let query = supabase
    .from('acq_offmarket_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.lead_type) query = query.eq('lead_type', filters.lead_type)
  if (filters?.province) query = query.eq('province', filters.province)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data ?? []) as AcqOffmarketLead[]
}

export async function getAcqOffmarketLeadById(id: string): Promise<AcqOffmarketLead | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_offmarket_leads')
    .select('*')
    .eq('id', id)
    .single()
  return data as AcqOffmarketLead | null
}

export async function getAcqPermits(filters?: {
  municipality?: string
  status?: string
}): Promise<AcqPermit[]> {
  const supabase = await createClient()
  let query = supabase
    .from('acq_permits')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.municipality) query = query.eq('municipality', filters.municipality)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data ?? []) as AcqPermit[]
}

export async function getAcqMunicipalities(): Promise<AcqMunicipality[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_municipalities')
    .select('*')
    .order('housing_shortage_score', { ascending: false })
  return (data ?? []) as AcqMunicipality[]
}

export async function getAcqInvestors(filters?: {
  risk_profile?: string
  status?: string
}): Promise<AcqInvestor[]> {
  const supabase = await createClient()
  let query = supabase
    .from('acq_investors')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.risk_profile) query = query.eq('risk_profile', filters.risk_profile)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data ?? []) as AcqInvestor[]
}

export async function getAcqInvestorById(id: string): Promise<AcqInvestor | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_investors')
    .select('*')
    .eq('id', id)
    .single()
  return data as AcqInvestor | null
}

export async function getAcqCrmContacts(filters?: {
  contact_type?: string
  status?: string
}): Promise<AcqCrmContact[]> {
  const supabase = await createClient()
  let query = supabase
    .from('acq_crm_contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.contact_type) query = query.eq('contact_type', filters.contact_type)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data ?? []) as AcqCrmContact[]
}

export async function getAcqOutreachSequences(): Promise<AcqOutreachSequence[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_outreach_sequences')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as AcqOutreachSequence[]
}

export async function getAcqSettings(userId: string): Promise<AcqSettings | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data as AcqSettings | null
}

export async function getAcqAgents(): Promise<AcqAgent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_agent_registry')
    .select('*')
    .order('name')
  return (data ?? []) as AcqAgent[]
}

export async function getAcqScanJobs(limit = 20): Promise<AcqScanJob[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_scan_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AcqScanJob[]
}

export async function getAcqDealStats(): Promise<AcqDealStats> {
  const supabase = await createClient()
  const [dealsRes, offmarketRes, investorsRes, permitsRes] = await Promise.all([
    supabase.from('acq_deals').select('pipeline_stage, asking_price, roi_pct, ai_score').eq('status', 'actief'),
    supabase.from('acq_offmarket_leads').select('id', { count: 'exact', head: true }),
    supabase.from('acq_investors').select('id', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('acq_permits').select('id', { count: 'exact', head: true }),
  ])

  const deals = dealsRes.data ?? []
  const actief = deals.filter(d => !['gewonnen', 'verloren'].includes(d.pipeline_stage)).length
  const pipeline_waarde = deals
    .filter(d => !['gewonnen', 'verloren'].includes(d.pipeline_stage))
    .reduce((sum, d) => sum + (d.asking_price ?? 0), 0)
  const roiValues = deals.map(d => d.roi_pct).filter((v): v is number => v !== null)
  const scoreValues = deals.map(d => d.ai_score).filter((v): v is number => v !== null)
  const avg_roi = roiValues.length ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0
  const avg_score = scoreValues.length ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0

  return {
    total: deals.length,
    actief,
    pipeline_waarde,
    avg_roi: Math.round(avg_roi * 10) / 10,
    avg_score: Math.round(avg_score),
    offmarket_total: offmarketRes.count ?? 0,
    investor_total: investorsRes.count ?? 0,
    permit_total: permitsRes.count ?? 0,
  }
}

export async function getHotZones(limit = 5): Promise<{ city: string; count: number }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_deals')
    .select('city')
    .eq('status', 'actief')
    .not('city', 'is', null)

  if (!data || data.length === 0) return []

  const counts: Record<string, number> = {}
  for (const row of data) {
    if (row.city) counts[row.city] = (counts[row.city] ?? 0) + 1
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city, count]) => ({ city, count }))
}
