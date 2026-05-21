import { supabase } from '../lib/supabase'
import { anthropic, HAIKU } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// OffMarketAI: analyseert nieuwe off-market leads en genereert
// ontwikkelscenario + contactstrategie via LLM.

export async function runOffMarketAI(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'OffMarketAI'

  await setAgentStatus(AGENT, 'running')

  // Verwerk leads zonder dev_scenario
  const { data: leads } = await supabase
    .from('acq_offmarket_leads')
    .select('id, address, city, province, lead_type, distress_signals, days_vacant, roi_prognose')
    .eq('status', 'nieuw')
    .is('dev_scenario', null)
    .limit(5)

  let processed = 0

  for (const lead of leads ?? []) {
    try {
      const result = await generateScenario(lead)
      await supabase
        .from('acq_offmarket_leads')
        .update({
          dev_scenario:     result.scenario,
          contact_strategy: result.strategy,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', lead.id)
      processed++
    } catch (err) {
      logger.error(`OffMarketAI lead ${lead.id} failed`, { err: String(err) })
    }
  }

  // Update tasks_done
  if (processed > 0) {
    try {
      await supabase.rpc('acq_agent_increment_done', { agent_name: AGENT, n: processed })
    } catch {
      // RPC bestaat mogelijk niet — update direct
      await supabase.from('acq_agent_registry')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('name', AGENT)
    }
  }

  await setAgentStatus(AGENT, 'idle')
  logger.info(`OffMarketAI run done`, { processed, duration_ms: Date.now() - start })

  return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start }
}

async function generateScenario(lead: {
  address: string
  city: string | null
  province: string | null
  lead_type: string | null
  distress_signals: unknown
  days_vacant: number | null
  roi_prognose: number | null
}): Promise<{ scenario: string; strategy: string }> {
  const signals = Array.isArray(lead.distress_signals) ? lead.distress_signals.join(', ') : String(lead.distress_signals ?? '')

  const msg = await anthropic.messages.create({
    model:      HAIKU,
    max_tokens: 600,
    system: `Je bent een Nederlandse vastgoedanalist gespecialiseerd in off-market acquisitie.
Analyseer het pand en geef:
1. Ontwikkelscenario (max 3 zinnen): wat is het beste herbestemmingsplan?
2. Contactstrategie (max 2 zinnen): hoe benaderen we de eigenaar?
Output als JSON: {"scenario": "...", "strategy": "..."}
Geen markdown, alleen JSON.`,
    messages: [{
      role: 'user',
      content: [
        `Adres: ${lead.address}${lead.city ? `, ${lead.city}` : ''}${lead.province ? ` (${lead.province})` : ''}`,
        `Type lead: ${lead.lead_type ?? 'onbekend'}`,
        `Signalen: ${signals || 'geen'}`,
        lead.days_vacant ? `Leegstand: ${lead.days_vacant} dagen` : '',
        lead.roi_prognose ? `ROI prognose: ${lead.roi_prognose}%` : '',
      ].filter(Boolean).join('\n'),
    }],
  })

  const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim()
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as { scenario?: string; strategy?: string }
  return {
    scenario: String(parsed.scenario ?? 'Geen scenario gegenereerd').slice(0, 500),
    strategy: String(parsed.strategy ?? 'Directe benadering eigenaar').slice(0, 300),
  }
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
