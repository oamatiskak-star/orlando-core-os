import { supabase } from '../lib/supabase'
import { anthropic, SONNET } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// AcquisitionDirectorAI: dagelijkse briefing — samenvatting van pipeline,
// hottest deals, acties voor de dag. Inserts als note in eerste actieve deal
// (of als log entry). Vergelijkbaar met ATLAS voor executive layer.

export async function runAcquisitionDirector(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'AcquisitionDirectorAI'

  await setAgentStatus(AGENT, 'running')

  // Snapshot van huidige staat
  const [dealsRes, offmarketRes, permitsRes, investorRes] = await Promise.all([
    supabase.from('acq_deals').select('pipeline_stage, roi_pct, ai_score, city, object_type').eq('status', 'actief'),
    supabase.from('acq_offmarket_leads').select('status, lead_type').limit(100),
    supabase.from('acq_permits').select('status, municipality, permit_type').limit(100),
    supabase.from('acq_investor_matches').select('status, match_score').limit(100),
  ])

  const deals     = dealsRes.data ?? []
  const offmarket = offmarketRes.data ?? []
  const permits   = permitsRes.data ?? []
  const matches   = investorRes.data ?? []

  const pipelineCount = (stage: string) => deals.filter(d => d.pipeline_stage === stage).length
  const topDeals = [...deals].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0)).slice(0, 5)

  const snapshot = [
    `PIPELINE: radar=${pipelineCount('radar')}, analyse=${pipelineCount('analyse')}, due_diligence=${pipelineCount('due_diligence')}, bod=${pipelineCount('bod')}, gewonnen=${pipelineCount('gewonnen')}`,
    `OFFMARKET: ${offmarket.filter(o => o.status === 'nieuw').length} nieuw, ${offmarket.length} totaal`,
    `PERMITS: ${permits.filter(p => p.status === 'aangevraagd').length} aangevraagd, ${permits.filter(p => p.status === 'verleend').length} verleend`,
    `INVESTOR MATCHES: ${matches.filter(m => m.status === 'geïnteresseerd').length} geïnteresseerd, ${matches.filter(m => m.status === 'gecommitteerd').length} gecommitteerd`,
    `TOP DEALS: ${topDeals.map(d => `${d.city ?? '?'} (${d.object_type ?? '?'}, score=${d.ai_score ?? '?'}, ROI=${d.roi_pct ?? '?'}%)`).join(' | ')}`,
  ].join('\n')

  let briefing = ''
  try {
    const msg = await anthropic.messages.create({
      model:      SONNET,
      max_tokens: 600,
      system: `Je bent de Acquisitie Directeur van een Nederlandse vastgoedontwikkelaar.
Analyseer de dagelijkse acquisitie snapshot en geef:
1. TOP-3 prioritaire acties voor vandaag (concreet, actionable)
2. Grootste risico in de huidige pipeline
3. Kans van de dag (beste deal of lead)
Wees direct, zakelijk, max 200 woorden totaal.`,
      messages: [{ role: 'user', content: snapshot }],
    })

    briefing = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim()
  } catch (err) {
    logger.error('AcquisitionDirector LLM failed', { err: String(err) })
    briefing = `Briefing niet beschikbaar (${(err as Error).message.slice(0, 100)})`
  }

  // Sla op als scan_job result (permanent log)
  await supabase.from('acq_scan_jobs').insert({
    agent_name:   AGENT,
    job_type:     'director_briefing',
    status:       'done',
    payload:      { snapshot_lines: snapshot.split('\n').length },
    result_count: deals.length,
    error_msg:    null,
    started_at:   new Date(start).toISOString(),
    finished_at:  new Date().toISOString(),
  })

  logger.info('AcquisitionDirector briefing generated', { deals: deals.length })
  logger.info(briefing)

  await setAgentStatus(AGENT, 'idle')

  return { agent: AGENT, jobsProcessed: 1, jobsCreated: 0, duration_ms: Date.now() - start }
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
