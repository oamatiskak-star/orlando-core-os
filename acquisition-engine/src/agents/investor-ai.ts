import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// InvestorAI: koppelt actieve deals aan potentiële investeerders op basis van
// overlap regio / object_type / ROI vs return_target_pct. Inserts acq_investor_matches.

export async function runInvestorAI(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'InvestorAI'

  await setAgentStatus(AGENT, 'running')

  // Deals in analyse/due_diligence/bod zonder matches
  const { data: deals } = await supabase
    .from('acq_deals')
    .select('id, city, province, object_type, roi_pct, ai_score, asking_price')
    .eq('status', 'actief')
    .in('pipeline_stage', ['analyse', 'due_diligence', 'bod'])
    .limit(20)

  const { data: investors } = await supabase
    .from('acq_investors')
    .select('id, regions, object_types, risk_profile, return_target_pct, investment_min, investment_max')
    .eq('status', 'actief')

  // Bestaande matches ophalen om duplicaten te voorkomen
  const { data: existingMatches } = await supabase
    .from('acq_investor_matches')
    .select('deal_id, investor_id')

  const matchSet = new Set(
    (existingMatches ?? []).map(m => `${m.deal_id}:${m.investor_id}`)
  )

  let created = 0

  for (const deal of deals ?? []) {
    for (const investor of investors ?? []) {
      const key = `${deal.id}:${investor.id}`
      if (matchSet.has(key)) continue

      const score = computeMatchScore(deal, investor)
      if (score < 40) continue  // alleen sterke matches

      const { error } = await supabase.from('acq_investor_matches').insert({
        deal_id:     deal.id,
        investor_id: investor.id,
        match_score: score,
        status:      'voorgesteld',
      }).select().single()

      if (!error) {
        matchSet.add(key)
        created++
      }
    }
  }

  await setAgentStatus(AGENT, 'idle')
  logger.info(`InvestorAI run done`, { created, duration_ms: Date.now() - start })

  return { agent: AGENT, jobsProcessed: (deals ?? []).length, jobsCreated: created, duration_ms: Date.now() - start }
}

function computeMatchScore(
  deal: { province: string | null; object_type: string | null; roi_pct: number | null; asking_price: number | null; ai_score: number | null },
  investor: { regions: unknown; object_types: unknown; return_target_pct: number | null; investment_min: number | null; investment_max: number | null; risk_profile: string },
): number {
  let score = 30

  const regions      = Array.isArray(investor.regions)      ? investor.regions as string[]      : []
  const objectTypes  = Array.isArray(investor.object_types) ? investor.object_types as string[] : []

  if (deal.province && regions.some(r => r.toLowerCase().includes(deal.province!.toLowerCase()))) score += 20
  if (deal.object_type && objectTypes.includes(deal.object_type)) score += 20

  if (deal.roi_pct !== null && investor.return_target_pct !== null) {
    if (deal.roi_pct >= investor.return_target_pct) score += 15
    else if (deal.roi_pct >= investor.return_target_pct * 0.8) score += 8
    else score -= 10
  }

  if (deal.asking_price !== null) {
    const min = investor.investment_min ?? 0
    const max = investor.investment_max ?? Infinity
    if (deal.asking_price >= min && deal.asking_price <= max) score += 15
    else score -= 15
  }

  if (deal.ai_score !== null) {
    if (investor.risk_profile === 'laag'  && deal.ai_score >= 70) score += 10
    if (investor.risk_profile === 'midden' && deal.ai_score >= 50) score += 10
    if (investor.risk_profile === 'hoog'  && deal.ai_score >= 30) score += 10
  }

  return Math.max(0, Math.min(100, score))
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
