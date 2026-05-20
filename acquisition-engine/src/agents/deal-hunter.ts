import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// DealHunter: verwerkt queued deal_scan jobs.
// Echte Funda/Kadaster integratie vereist OAuth + scraper; hier: AI-scoring
// van bestaande radar-deals zonder score en markeer agent actief/done.

export async function runDealHunter(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'DealHunter'

  await setAgentStatus(AGENT, 'running')

  const { data: jobs } = await supabase
    .from('acq_scan_jobs')
    .select('*')
    .eq('agent_name', AGENT)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(10)

  const pending = jobs ?? []
  let processed = 0

  for (const job of pending) {
    await claimJob(job.id)
    try {
      // Verwerk unscored radar-deals
      const { data: unscored } = await supabase
        .from('acq_deals')
        .select('id, title, asking_price, roi_pct, area_m2, object_type, province, energy_label, build_year')
        .eq('status', 'actief')
        .eq('pipeline_stage', 'radar')
        .is('ai_score', null)
        .limit(20)

      let scored = 0
      for (const deal of unscored ?? []) {
        const score = computeBasicScore(deal)
        const risk  = computeRiskScore(deal)
        await supabase
          .from('acq_deals')
          .update({ ai_score: score, risk_score: risk, updated_at: new Date().toISOString() })
          .eq('id', deal.id)

        await supabase.from('acq_deal_scores').insert({
          deal_id:   deal.id,
          score,
          reasoning: `Basis AI-score: ROI=${deal.roi_pct ?? 'n/a'}%, type=${deal.object_type ?? '?'}, provincie=${deal.province ?? '?'}. Energielabel=${deal.energy_label ?? '?'}.`,
          model:     'rule-engine-v1',
        })
        scored++
      }

      await completeJob(job.id, scored)
      processed++
    } catch (err) {
      await failJob(job.id, (err as Error).message)
      logger.error(`DealHunter job ${job.id} failed`, { err: String(err) })
    }
  }

  await setAgentStatus(AGENT, 'idle')
  logger.info(`DealHunter run done`, { processed, duration_ms: Date.now() - start })

  return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start }
}

function computeBasicScore(deal: {
  asking_price: number | null
  roi_pct: number | null
  area_m2: number | null
  object_type: string | null
  energy_label: string | null
  build_year: number | null
}): number {
  let score = 40
  if (deal.roi_pct !== null) {
    if (deal.roi_pct >= 15) score += 25
    else if (deal.roi_pct >= 10) score += 18
    else if (deal.roi_pct >= 6)  score += 10
    else score -= 5
  }
  if (deal.area_m2 !== null) {
    if (deal.area_m2 >= 200) score += 10
    else if (deal.area_m2 >= 100) score += 5
  }
  const goodTypes = ['loods', 'kantoor', 'woning', 'appartement']
  if (deal.object_type && goodTypes.includes(deal.object_type)) score += 8
  const badLabels = ['F', 'G']
  if (deal.energy_label && badLabels.includes(deal.energy_label)) score -= 8
  if (deal.build_year && deal.build_year < 1970) score -= 5
  return Math.max(0, Math.min(100, score))
}

function computeRiskScore(deal: {
  asking_price: number | null
  energy_label: string | null
  build_year: number | null
}): number {
  let risk = 30
  if (deal.asking_price !== null && deal.asking_price > 1_000_000) risk += 15
  if (deal.energy_label && ['F', 'G'].includes(deal.energy_label)) risk += 20
  if (deal.build_year && deal.build_year < 1950) risk += 15
  return Math.max(0, Math.min(100, risk))
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}

async function claimJob(id: string) {
  await supabase
    .from('acq_scan_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', id)
}

async function completeJob(id: string, resultCount: number) {
  await supabase
    .from('acq_scan_jobs')
    .update({ status: 'done', result_count: resultCount, finished_at: new Date().toISOString() })
    .eq('id', id)
  await supabase
    .from('acq_agent_registry')
    .update({ tasks_done: supabase.rpc('increment', { x: 1 }) as unknown as number })
    .eq('name', 'DealHunter')
}

async function failJob(id: string, error: string) {
  await supabase
    .from('acq_scan_jobs')
    .update({ status: 'failed', error_msg: error.slice(0, 500), finished_at: new Date().toISOString() })
    .eq('id', id)
  await supabase
    .from('acq_agent_registry')
    .update({ tasks_failed: supabase.rpc('increment', { x: 1 }) as unknown as number })
    .eq('name', 'DealHunter')
}
