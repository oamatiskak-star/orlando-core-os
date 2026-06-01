import { supabase } from '../lib/supabase'
import { anthropic, HAIKU } from '../lib/anthropic'
import { logger } from '../lib/logger'
import { AgentRunResult } from '../lib/types'
import { AQUIER_PROFILE, AquierProfile, computeDedupeKey, computeFundFit } from '../lib/fund-fit'
import { ingestEuPortalGrants } from '../lib/sources/eu-portal'
import { ingestRvoSchemes } from '../lib/sources/rvo'

// ── InvestorScoutAI ───────────────────────────────────────────────────────────
// Zoekt CONTINU startup-/bedrijfsinvesteerders (VC's, angels, family offices,
// accelerators, grants) om kapitaal op te halen voor Aquier/Modiwe — NIET het
// matchen van vastgoed-LP's (dat doet InvestorAI). Pipeline:
//   discover/ingest → dedupe → enrich (HAIKU) → fit-score (rule-engine) → queue.
// Verzendt niets; queue-t alleen drafts in de fundraising-sequence.

const AGENT = 'InvestorScoutAI'
const FUNDRAISING_SEQUENCE = 'Fundraising — Aquier/Modiwe'
const ENRICH_BATCH = 15
const SCORE_BATCH  = 50
const QUEUE_FIT_THRESHOLD = 70

export async function runInvestorScoutAI(): Promise<AgentRunResult> {
  const start = Date.now()
  await setAgentStatus(AGENT, 'running')

  const profile = await loadProfile()

  // STAP A — DISCOVER / INGEST (🟢 open-data bronnen; geen ToS-scraping)
  let jobsCreated = 0
  try {
    const [eu, rvo] = await Promise.all([ingestEuPortalGrants(), ingestRvoSchemes()])
    jobsCreated += eu.prospectsInserted + rvo.prospectsInserted
  } catch (err) {
    logger.warn(`${AGENT}: open-data ingest gedeeltelijk mislukt`, { err: String(err) })
  }

  // STAP B — DEDUPE backfill (rijen zonder dedupe_key, bv. handmatige inserts)
  await backfillDedupeKeys()

  // STAP C — ENRICH (HAIKU): genormaliseerde velden voor rijen met lege focus/stage
  const enriched = await enrichNewProspects()

  // STAP D — FIT-SCORE (rule-engine + uitlegbare reasoning)
  const { data: toScore } = await supabase
    .from('fund_prospects')
    .select('id, investor_type, thesis, focus_sectors, stage_focus, ticket_min_eur, ticket_max_eur, geo_focus, notable_portfolio')
    .in('status', ['nieuw', 'verrijkt'])
    .limit(SCORE_BATCH)

  let scored = 0
  for (const p of toScore ?? []) {
    const hasEmail = await prospectHasEmail(p.id)
    const fit = computeFundFit(p as never, profile, hasEmail)

    const nextStatus =
      fit.score >= 60 ? 'gekwalificeerd' :
      fit.score < 40  ? 'afgewezen' :
      'verrijkt' // 40-59 = nurture (blijft 'verrijkt')

    await supabase
      .from('fund_prospects')
      .update({
        fit_score:      fit.score,
        fit_reasoning:  fit.reasoning,
        status:         nextStatus,
        last_action:    'scored',
        last_action_at: new Date().toISOString(),
      })
      .eq('id', p.id)

    await supabase.from('fund_activity_log').insert({
      prospect_id: p.id,
      agent:       AGENT,
      action:      'scored',
      detail:      { fit_score: fit.score, status: nextStatus },
    })
    scored++
  }

  // STAP E — QUEUE OUTREACH (fit>=70, contact met email, geen warme-intro-route)
  const queued = await queueOutreach()

  await setAgentStatus(AGENT, 'idle')
  const duration_ms = Date.now() - start
  logger.info(`${AGENT} run done`, { jobsCreated, enriched, scored, queued, duration_ms })

  return { agent: AGENT, jobsProcessed: scored + enriched, jobsCreated: jobsCreated + queued, duration_ms }
}

// ── Profile (overschrijfbaar via acq_agent_registry.config) ──────────────────
async function loadProfile(): Promise<AquierProfile> {
  const { data } = await supabase
    .from('acq_agent_registry')
    .select('config')
    .eq('name', AGENT)
    .maybeSingle()

  const cfg = (data?.config ?? {}) as Partial<AquierProfile>
  return {
    sectors:       Array.isArray(cfg.sectors)      ? cfg.sectors      : AQUIER_PROFILE.sectors,
    stage:         Array.isArray(cfg.stage)        ? cfg.stage        : AQUIER_PROFILE.stage,
    geo:           Array.isArray(cfg.geo)          ? cfg.geo          : AQUIER_PROFILE.geo,
    ticket:        cfg.ticket && typeof cfg.ticket.min === 'number' && typeof cfg.ticket.max === 'number'
                     ? cfg.ticket : AQUIER_PROFILE.ticket,
    prefer_grants: typeof cfg.prefer_grants === 'boolean' ? cfg.prefer_grants : AQUIER_PROFILE.prefer_grants,
    edge_signals:  Array.isArray(cfg.edge_signals) ? cfg.edge_signals : AQUIER_PROFILE.edge_signals,
  }
}

// ── Dedupe ───────────────────────────────────────────────────────────────────
async function backfillDedupeKeys(): Promise<void> {
  const { data: rows } = await supabase
    .from('fund_prospects')
    .select('id, name, website')
    .is('dedupe_key', null)
    .limit(100)

  for (const r of rows ?? []) {
    const key = computeDedupeKey(r.name, r.website)

    // Bestaat de sleutel al op een andere rij → markeer deze als afgewezen (dedupe).
    const { data: clash } = await supabase
      .from('fund_prospects')
      .select('id')
      .eq('dedupe_key', key)
      .neq('id', r.id)
      .maybeSingle()

    if (clash) {
      await supabase
        .from('fund_prospects')
        .update({ status: 'afgewezen', last_action: 'deduped', last_action_at: new Date().toISOString() })
        .eq('id', r.id)
      await supabase.from('fund_activity_log').insert({
        prospect_id: r.id, agent: AGENT, action: 'deduped', detail: { dedupe_key: key, kept: clash.id },
      })
      continue
    }

    await supabase.from('fund_prospects').update({ dedupe_key: key }).eq('id', r.id)
  }
}

// ── Enrich (HAIKU) ────────────────────────────────────────────────────────────
interface EnrichOut {
  focus_sectors: string[]
  stage_focus: string[]
  geo_focus: string[]
  ticket_min_eur: number | null
  ticket_max_eur: number | null
}

async function enrichNewProspects(): Promise<number> {
  // Rijen met een thesis maar zonder genormaliseerde velden.
  const { data: rows } = await supabase
    .from('fund_prospects')
    .select('id, name, thesis, investor_type, focus_sectors, stage_focus, geo_focus, ticket_min_eur, ticket_max_eur')
    .in('status', ['nieuw'])
    .not('thesis', 'is', null)
    .limit(ENRICH_BATCH)

  let enriched = 0
  for (const r of rows ?? []) {
    const sectors = Array.isArray(r.focus_sectors) ? r.focus_sectors : []
    const stages  = Array.isArray(r.stage_focus) ? r.stage_focus : []
    const geos    = Array.isArray(r.geo_focus) ? r.geo_focus : []
    // Alleen verrijken als er nog niets genormaliseerd is.
    if (sectors.length > 0 && stages.length > 0 && geos.length > 0) {
      await supabase.from('fund_prospects').update({ status: 'verrijkt' }).eq('id', r.id)
      enriched++
      continue
    }

    try {
      const out = await enrichWithLlm(r.name, r.thesis as string, r.investor_type)
      await supabase
        .from('fund_prospects')
        .update({
          focus_sectors:  out.focus_sectors.length ? out.focus_sectors : sectors,
          stage_focus:    out.stage_focus.length   ? out.stage_focus   : stages,
          geo_focus:      out.geo_focus.length      ? out.geo_focus     : geos,
          ticket_min_eur: r.ticket_min_eur ?? out.ticket_min_eur,
          ticket_max_eur: r.ticket_max_eur ?? out.ticket_max_eur,
          status:         'verrijkt',
          last_action:    'enriched',
          last_action_at: new Date().toISOString(),
        })
        .eq('id', r.id)

      await supabase.from('fund_activity_log').insert({
        prospect_id: r.id, agent: AGENT, action: 'enriched', detail: out as unknown as Record<string, unknown>,
      })
      enriched++
    } catch (err) {
      logger.warn(`${AGENT}: enrich mislukt voor ${r.id}`, { err: String(err) })
    }
  }
  return enriched
}

async function enrichWithLlm(name: string, thesis: string, investorType: string): Promise<EnrichOut> {
  const response = await anthropic.messages.create({
    model:      HAIKU,
    max_tokens: 300,
    system: `Je normaliseert investeerder-profielen voor een fundraising-pipeline.
Gegeven naam + thesis, retourneer UITSLUITEND geldige JSON (geen uitleg) met:
{"focus_sectors": string[], "stage_focus": string[], "geo_focus": string[], "ticket_min_eur": number|null, "ticket_max_eur": number|null}
Gebruik korte slug-waarden. focus_sectors uit: proptech, real-estate, ai, saas, vertical-saas, fintech, deeptech, climate, healthtech, other.
stage_focus uit: pre_seed, seed, series_a, series_b, growth, grant, rolling.
geo_focus uit: NL, EU, DACH, benelux, UK, US, global. Bedragen in euro of null.`,
    messages: [{ role: 'user', content: `Type: ${investorType}\nNaam: ${name}\nThesis: ${thesis}` }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('')
    .trim()

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('geen JSON in enrich-respons')
  const parsed = JSON.parse(match[0]) as Partial<EnrichOut>

  return {
    focus_sectors:  Array.isArray(parsed.focus_sectors) ? parsed.focus_sectors.map(String) : [],
    stage_focus:    Array.isArray(parsed.stage_focus)   ? parsed.stage_focus.map(String)   : [],
    geo_focus:      Array.isArray(parsed.geo_focus)     ? parsed.geo_focus.map(String)     : [],
    ticket_min_eur: typeof parsed.ticket_min_eur === 'number' ? parsed.ticket_min_eur : null,
    ticket_max_eur: typeof parsed.ticket_max_eur === 'number' ? parsed.ticket_max_eur : null,
  }
}

// ── Queue outreach ────────────────────────────────────────────────────────────
async function prospectHasEmail(prospectId: string): Promise<boolean> {
  const { count } = await supabase
    .from('fund_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('prospect_id', prospectId)
    .not('email', 'is', null)
  return (count ?? 0) > 0
}

async function getFundraisingSequenceId(): Promise<string | null> {
  const { data } = await supabase
    .from('acq_outreach_sequences')
    .select('id')
    .eq('name', FUNDRAISING_SEQUENCE)
    .maybeSingle()
  return data?.id ?? null
}

async function queueOutreach(): Promise<number> {
  const sequenceId = await getFundraisingSequenceId()
  if (!sequenceId) {
    logger.warn(`${AGENT}: fundraising-sequence ontbreekt (migratie nog niet toegepast?) — queue overgeslagen`)
    return 0
  }

  const { data: prospects } = await supabase
    .from('fund_prospects')
    .select('id, name, fit_score, fit_reasoning, thesis, priority')
    .eq('status', 'gekwalificeerd')
    .gte('fit_score', QUEUE_FIT_THRESHOLD)
    .limit(25)

  let queued = 0
  for (const p of prospects ?? []) {
    // Primair contact met email.
    const { data: contact } = await supabase
      .from('fund_contacts')
      .select('id, name, email, role, warm_intro_path, crm_contact_id')
      .eq('prospect_id', p.id)
      .not('email', 'is', null)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!contact) continue

    // Warme intro eerst: geen cold-email queue, wel prioriteit + notificatie-log.
    if (contact.warm_intro_path && contact.warm_intro_path.trim().length > 0) {
      await supabase
        .from('fund_prospects')
        .update({ priority: 'hoog', last_action: 'warm_intro_flagged', last_action_at: new Date().toISOString() })
        .eq('id', p.id)
      await supabase.from('fund_activity_log').insert({
        prospect_id: p.id, agent: AGENT, action: 'status_change',
        detail: { reason: 'warm_intro_path aanwezig — cold-email overgeslagen, mens-in-de-loop', contact: contact.name },
      })
      continue
    }

    // Shadow-row in acq_crm_contacts zodat de bestaande outreach-machinerie werkt.
    const crmContactId = await ensureCrmShadow(contact.crm_contact_id, contact.name, p.name, contact.id)

    // Touch 1 alleen queuen als er nog geen message voor dit contact in deze sequence bestaat.
    const { count: existingCount } = await supabase
      .from('acq_outreach_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', sequenceId)
      .eq('contact_id', crmContactId)

    if ((existingCount ?? 0) > 0) continue

    const { data: msg, error } = await supabase
      .from('acq_outreach_messages')
      .insert({
        sequence_id:  sequenceId,
        contact_id:   crmContactId,
        step_nr:      1,
        channel:      'email',
        status:       'gepland',
        body:         null,
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !msg) {
      logger.error(`${AGENT}: outreach insert mislukt voor ${p.id}`, { err: error?.message })
      continue
    }

    await supabase
      .from('fund_prospects')
      .update({ status: 'outreach_queued', last_action: 'queued_outreach', last_action_at: new Date().toISOString() })
      .eq('id', p.id)

    await supabase.from('fund_activity_log').insert({
      prospect_id:         p.id,
      agent:               AGENT,
      action:              'queued_outreach',
      detail:              { step_nr: 1, contact: contact.name, fit_score: p.fit_score },
      outreach_message_id: msg.id,
    })
    queued++
  }
  return queued
}

/** Maak (of hergebruik) een acq_crm_contacts-shadow zodat FundOutreachAI via de bestaande join werkt. */
async function ensureCrmShadow(
  existingCrmId: string | null,
  contactName: string,
  fundName: string,
  fundContactId: string,
): Promise<string> {
  if (existingCrmId) return existingCrmId

  const { data: crm, error } = await supabase
    .from('acq_crm_contacts')
    .insert({
      name:         contactName,
      company:      fundName,
      contact_type: 'fund_investor',
      status:       'actief',
    })
    .select('id')
    .single()

  if (error || !crm) throw new Error(`crm-shadow insert mislukt: ${error?.message}`)

  await supabase.from('fund_contacts').update({ crm_contact_id: crm.id }).eq('id', fundContactId)
  return crm.id
}

async function setAgentStatus(name: string, status: 'idle' | 'running' | 'error') {
  await supabase
    .from('acq_agent_registry')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('name', name)
}
