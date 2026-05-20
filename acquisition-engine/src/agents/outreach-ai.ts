import { supabase } from '../lib/supabase'
import { anthropic, HAIKU } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// OutreachAI: genereert outreach berichten voor geplande messages in actieve sequences.

export async function runOutreachAI(): Promise<AgentRunResult> {
  const start = Date.now()
  const AGENT = 'OutreachAI'

  await setAgentStatus(AGENT, 'running')

  const { data: messages } = await supabase
    .from('acq_outreach_messages')
    .select(`
      id, step_nr, channel, subject, body, status,
      sequence_id,
      contact_id,
      acq_outreach_sequences!inner(name, seq_type, status),
      acq_crm_contacts(name, company, contact_type)
    `)
    .eq('status', 'gepland')
    .is('body', null)
    .lte('scheduled_at', new Date().toISOString())
    .limit(10)

  let processed = 0

  for (const msg of messages ?? []) {
    try {
      const body = await generateMessage(msg)
      await supabase
        .from('acq_outreach_messages')
        .update({ body, subject: msg.subject ?? await generateSubject(msg) })
        .eq('id', msg.id)
      processed++
    } catch (err) {
      logger.error(`OutreachAI message ${msg.id} failed`, { err: String(err) })
    }
  }

  await setAgentStatus(AGENT, 'idle')
  logger.info(`OutreachAI run done`, { processed, duration_ms: Date.now() - start })

  return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start }
}

async function generateMessage(msg: Record<string, unknown>): Promise<string> {
  const sequence = msg['acq_outreach_sequences'] as Record<string, string> | null
  const contact  = msg['acq_crm_contacts'] as Record<string, string> | null

  const response = await anthropic.messages.create({
    model:      HAIKU,
    max_tokens: 400,
    system: `Je schrijft professionele Nederlandse acquisitie-berichten voor vastgoed.
Kanaal: ${msg['channel'] ?? 'email'}, Stap: ${msg['step_nr'] ?? 1}.
Schrijf een kort, direct, professioneel bericht. Geen sjabloon-placeholders. Max 150 woorden.`,
    messages: [{
      role: 'user',
      content: [
        sequence ? `Campagne: ${sequence['name']} (${sequence['seq_type']})` : '',
        contact  ? `Contactpersoon: ${contact['name']}${contact['company'] ? ` — ${contact['company']}` : ''} (${contact['contact_type'] ?? 'contact'})` : '',
        `Stap ${msg['step_nr'] ?? 1} van de outreach.`,
      ].filter(Boolean).join('\n'),
    }],
  })

  return response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim().slice(0, 1000)
}

async function generateSubject(msg: Record<string, unknown>): Promise<string> {
  const sequence = msg['acq_outreach_sequences'] as Record<string, string> | null
  return `Kennismaking${sequence ? ` — ${sequence['name']}` : ''} (stap ${msg['step_nr'] ?? 1})`
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
