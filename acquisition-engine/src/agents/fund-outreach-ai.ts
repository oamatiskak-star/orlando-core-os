import { supabase } from '../lib/supabase'
import { anthropic, SONNET } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'

// ── FundOutreachAI ────────────────────────────────────────────────────────────
// Schrijft 3-touch cold-email DRAFTS voor de fundraising-sequence richting
// startup-investeerders. HARDE APPROVAL-GATE: zet status NOOIT op 'verzonden'.
// Vult subject+body en zet status -> 'klaar_voor_review'. Orlando reviewt en
// verstuurt via eigen account. Spiegelt het OutreachAI-patroon.

const AGENT = 'FundOutreachAI'
const FUNDRAISING_SEQUENCE = 'Fundraising — Aquier/Modiwe'
const BATCH = 10

export async function runFundOutreachAI(): Promise<AgentRunResult> {
  const start = Date.now()
  await setAgentStatus(AGENT, 'running')

  const { data: messages } = await supabase
    .from('acq_outreach_messages')
    .select(`
      id, step_nr, channel, subject, body, status, sequence_id, contact_id,
      acq_outreach_sequences!inner(name, seq_type),
      acq_crm_contacts(name, company, contact_type)
    `)
    .eq('status', 'gepland')
    .is('body', null)
    .lte('scheduled_at', new Date().toISOString())
    .limit(BATCH)

  // Alleen messages uit de fundraising-sequence (OutreachAI pakt de vastgoed-sequences).
  const fundMessages = (messages ?? []).filter(m => {
    const seq = (m as Record<string, unknown>)['acq_outreach_sequences'] as Record<string, string> | null
    return seq?.name === FUNDRAISING_SEQUENCE
  })

  let processed = 0
  for (const msg of fundMessages) {
    try {
      const ctx = await loadProspectContext(msg.contact_id as string | null)
      const { subject, body } = await draftEmail(msg, ctx)

      // Approval-gate: status -> 'klaar_voor_review', NOOIT 'verzonden'.
      await supabase
        .from('acq_outreach_messages')
        .update({ subject, body, status: 'klaar_voor_review' })
        .eq('id', msg.id)

      if (ctx?.prospectId) {
        await supabase.from('fund_activity_log').insert({
          prospect_id:         ctx.prospectId,
          agent:               AGENT,
          action:              'drafted_email',
          detail:              { step_nr: msg.step_nr, subject },
          outreach_message_id: msg.id as string,
        })
      }
      processed++
    } catch (err) {
      logger.error(`${AGENT}: draft mislukt voor message ${msg.id}`, { err: String(err) })
    }
  }

  await setAgentStatus(AGENT, 'idle')
  const duration_ms = Date.now() - start
  logger.info(`${AGENT} run done`, { processed, duration_ms })

  return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms }
}

interface ProspectContext {
  prospectId: string | null
  contactName: string
  fundName: string
  thesis: string | null
  fitReasoning: string | null
  notablePortfolio: string[]
}

async function loadProspectContext(crmContactId: string | null): Promise<ProspectContext | null> {
  if (!crmContactId) return null

  // Vind de fund_contact die naar deze crm-shadow wijst, en de prospect.
  const { data: fc } = await supabase
    .from('fund_contacts')
    .select('name, prospect_id')
    .eq('crm_contact_id', crmContactId)
    .maybeSingle()

  if (!fc) {
    // Fallback: gebruik de crm-contact zelf.
    const { data: crm } = await supabase
      .from('acq_crm_contacts')
      .select('name, company')
      .eq('id', crmContactId)
      .maybeSingle()
    return crm
      ? { prospectId: null, contactName: crm.name, fundName: crm.company ?? '', thesis: null, fitReasoning: null, notablePortfolio: [] }
      : null
  }

  const { data: prospect } = await supabase
    .from('fund_prospects')
    .select('name, thesis, fit_reasoning, notable_portfolio')
    .eq('id', fc.prospect_id)
    .maybeSingle()

  return {
    prospectId:       fc.prospect_id,
    contactName:      fc.name,
    fundName:         prospect?.name ?? '',
    thesis:           prospect?.thesis ?? null,
    fitReasoning:     prospect?.fit_reasoning ?? null,
    notablePortfolio: Array.isArray(prospect?.notable_portfolio) ? (prospect!.notable_portfolio as string[]) : [],
  }
}

const SYSTEM_PROMPT = `Je schrijft een korte, scherpe fundraising cold-email namens de oprichter (Orlando) van Aquier (Modiwe BV) aan een startup-investeerder.
Toon: zelfverzekerd operator, geen hype, geen buzzwords, geen placeholders.
Max 120 woorden body. Eén concrete CTA (15-minuten call).
Personaliseer op de thesis/portfolio van de investeerder. Leid met traction/insight, niet met "wij zijn een AI-platform".
Context Aquier: automatiseert de eerste volledige haalbaarheidsfase van vastgoedontwikkeling (weken handwerk → minuten). De moat is 22 jaar bouw-, calculatie- en ontwikkelervaring verwerkt in het product. Live in NL met betaalde tiers (Scout/Developer/Institutional), USA-data-engine draait, eerste betaalde rapporten en pricing live. Doel: pre-seed/seed ronde voor internationale uitrol.
Schrijf in het Nederlands tenzij de fund duidelijk Engelstalig/internationaal is.
Retourneer UITSLUITEND geldige JSON: {"subject": string, "body": string}. Geen extra tekst.`

function touchInstruction(step: number): string {
  switch (step) {
    case 1:
      return 'Touch 1 (dag 0) — koude introductie. Begin met een thesis-haak, dan traction, dan de pre-seed/seed-vraag + 15-min CTA.'
    case 2:
      return 'Touch 2 (dag ~4, reply op zelfde thread, subject begint met "Re:") — korte bump, één scherp cijfer/inzicht over snelheid-van-besluitvorming als pricing-power, bied 1-pager memo of directe 15 min.'
    case 3:
      return 'Touch 3 (dag ~9) — break-up/value-drop. Respecteer hun inbox, bied maandelijkse tractie-update aan als het nu niet past. Geen druk.'
    default:
      return 'Vervolg-touch — kort, waardevol, één CTA.'
  }
}

async function draftEmail(
  msg: Record<string, unknown>,
  ctx: ProspectContext | null,
): Promise<{ subject: string; body: string }> {
  const step = Number(msg['step_nr'] ?? 1)

  const contextLines = [
    ctx?.fundName ? `Fund: ${ctx.fundName}` : '',
    ctx?.contactName ? `Contactpersoon (voornaam afleiden): ${ctx.contactName}` : '',
    ctx?.thesis ? `Thesis van de fund: ${ctx.thesis}` : '',
    ctx?.notablePortfolio.length ? `Bekende portfolio: ${ctx.notablePortfolio.join(', ')}` : '',
    ctx?.fitReasoning ? `Waarom een match: ${ctx.fitReasoning}` : '',
    touchInstruction(step),
  ].filter(Boolean).join('\n')

  const response = await anthropic.messages.create({
    model:      SONNET,
    max_tokens: 600,
    system:     SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contextLines || `Touch ${step} fundraising cold-email.` }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim()

  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { subject?: string; body?: string }
      if (parsed.body) {
        return {
          subject: (parsed.subject ?? defaultSubject(step, ctx)).slice(0, 200),
          body:    parsed.body.slice(0, 2000),
        }
      }
    } catch {
      // val terug op platte tekst
    }
  }
  return { subject: defaultSubject(step, ctx), body: text.slice(0, 2000) }
}

function defaultSubject(step: number, ctx: ProspectContext | null): string {
  const fund = ctx?.fundName ? ` ${ctx.fundName}` : ''
  if (step === 2) return 'Re: Aquier — proptech intelligence'
  if (step === 3) return 'Laatste — Aquier dealflow-update'
  return `Aquier — proptech intelligence vanuit 22 jaar ontwikkelpraktijk${fund ? ` voor${fund}` : ''}`.slice(0, 200)
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
