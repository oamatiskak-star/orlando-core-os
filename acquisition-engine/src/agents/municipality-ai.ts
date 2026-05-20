import { supabase } from '../lib/supabase'
import { anthropic, HAIKU } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// MunicipalityAI: verrijkt gemeenteprofielen zonder transformation_policy
// via LLM op basis van naam/provincie.

export async function runMunicipalityAI(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'MunicipalityAI'

  await setAgentStatus(AGENT, 'running')

  const { data: muns } = await supabase
    .from('acq_municipalities')
    .select('id, name, province, population, housing_shortage_score, permit_lenience_score, political_stance')
    .is('transformation_policy', null)
    .limit(5)

  let processed = 0

  for (const mun of muns ?? []) {
    try {
      const policy = await generatePolicy(mun)
      await supabase
        .from('acq_municipalities')
        .update({
          transformation_policy: policy,
          last_updated: new Date().toISOString(),
        })
        .eq('id', mun.id)
      processed++
    } catch (err) {
      logger.error(`MunicipalityAI ${mun.name} failed`, { err: String(err) })
    }
  }

  await setAgentStatus(AGENT, 'idle')
  logger.info(`MunicipalityAI run done`, { processed, duration_ms: Date.now() - start })

  return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start }
}

async function generatePolicy(mun: {
  name: string
  province: string
  population: number | null
  housing_shortage_score: number | null
  permit_lenience_score: number | null
  political_stance: string | null
}): Promise<string> {
  const msg = await anthropic.messages.create({
    model:      HAIKU,
    max_tokens: 250,
    system: `Je bent een Nederlandse vastgoedanalist. Geef een korte omschrijving (max 2 zinnen) van het transformatie- en woningbouwbeleid van de gegeven gemeente op basis van de bekende kenmerken. Wees concreet en feitelijk.`,
    messages: [{
      role: 'user',
      content: [
        `Gemeente: ${mun.name} (${mun.province})`,
        mun.population ? `Bevolking: ~${mun.population.toLocaleString('nl-NL')}` : '',
        mun.housing_shortage_score !== null ? `Woningtekort score: ${mun.housing_shortage_score}/100` : '',
        mun.permit_lenience_score !== null ? `Vergunningsbereidheid: ${mun.permit_lenience_score}/100` : '',
        mun.political_stance ? `Politieke compositie: ${mun.political_stance}` : '',
      ].filter(Boolean).join('\n'),
    }],
  })

  return msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim().slice(0, 400)
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
