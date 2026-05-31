import { supabase } from '../supabase'
import { logger } from '../logger'
import { computeDedupeKey } from '../fund-fit'

// ── EU Funding & Tenders Portal — open calls (🟢 legaal, publieke API) ────────
// Haalt open grant-calls op (EIC Accelerator, Horizon Europe, Eurostars-achtig)
// via de publieke SEDIA search-API en insert ze als grant-prospects.
// Geen ToS-schending: dit is de officiële open zoek-API van ec.europa.eu.
//
// De API is een POST multipart-search. We filteren op open calls en mappen
// elke call naar een fund_prospect (investor_type='grant', source='eu_portal').
// Bij netwerk-/API-fouten faalt deze functie GRACEFUL (logt + 0 inserts) zodat
// de agent-run niet breekt.

const SEDIA_SEARCH_URL =
  'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=*&pageSize=50'

interface EuCall {
  title: string
  identifier: string
  url: string
  status: string
  deadline?: string
}

export interface EuPortalResult {
  callsFetched: number
  prospectsInserted: number
  prospectsSkipped: number
}

function buildQuery(): string {
  // SEDIA-querytaal: alleen open grant-calls (TendersApplicationsOpenForSubmission).
  return JSON.stringify({
    bool: {
      must: [
        { terms: { type: ['1', '2'] } }, // 1=grant call, 2=tender
        { terms: { status: ['31094502'] } }, // 31094502 = Forthcoming/Open for submission
      ],
    },
  })
}

async function fetchOpenCalls(): Promise<EuCall[]> {
  const form = new FormData()
  form.append('query', buildQuery())
  form.append('languages', JSON.stringify(['en']))

  const res = await fetch(SEDIA_SEARCH_URL, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`EU portal HTTP ${res.status}`)

  const json = (await res.json()) as { results?: Array<Record<string, unknown>> }
  const out: EuCall[] = []

  for (const r of json.results ?? []) {
    const meta = (r['metadata'] as Record<string, unknown[]> | undefined) ?? {}
    const title =
      (r['title'] as string | undefined) ??
      (Array.isArray(meta['title']) ? String(meta['title'][0]) : undefined)
    const identifier =
      Array.isArray(meta['identifier']) ? String(meta['identifier'][0]) :
      (r['reference'] as string | undefined)
    const url = (r['url'] as string | undefined) ?? ''
    if (!title || !identifier) continue

    out.push({
      title,
      identifier,
      url,
      status: 'open',
      deadline: Array.isArray(meta['deadlineDate']) ? String(meta['deadlineDate'][0]) : undefined,
    })
  }
  return out
}

/** Insert open EU-calls als grant-prospects. Idempotent via dedupe_key. */
export async function ingestEuPortalGrants(): Promise<EuPortalResult> {
  const result: EuPortalResult = { callsFetched: 0, prospectsInserted: 0, prospectsSkipped: 0 }

  let calls: EuCall[]
  try {
    calls = await fetchOpenCalls()
  } catch (err) {
    logger.warn('ingestEuPortalGrants: EU-portal fetch mislukt (graceful skip)', { err: String(err) })
    return result
  }
  result.callsFetched = calls.length

  for (const call of calls) {
    const name = `EU — ${call.title}`.slice(0, 300)
    const dedupeKey = computeDedupeKey(call.identifier, 'ec.europa.eu')

    const { data: existing } = await supabase
      .from('fund_prospects')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()
    if (existing) { result.prospectsSkipped++; continue }

    const { data: inserted, error } = await supabase
      .from('fund_prospects')
      .insert({
        name,
        investor_type:     'grant',
        thesis:            `EU Funding & Tenders open call (${call.identifier}).`,
        focus_sectors:     ['ai', 'saas', 'deeptech'],
        stage_focus:       ['grant'],
        geo_focus:         ['EU'],
        website:           call.url || 'https://ec.europa.eu/info/funding-tenders/opportunities',
        source:            'eu_portal',
        source_url:        call.url || null,
        next_action_at:    call.deadline ?? null,
        status:            'nieuw',
        dedupe_key:        dedupeKey,
      })
      .select('id')
      .single()

    if (error || !inserted) { result.prospectsSkipped++; continue }
    result.prospectsInserted++

    await supabase.from('fund_activity_log').insert({
      prospect_id: inserted.id,
      agent:       'InvestorScoutAI',
      action:      'discovered',
      detail:      { source: 'eu_portal', identifier: call.identifier, deadline: call.deadline ?? null },
    })
  }

  logger.info('ingestEuPortalGrants done', result)
  return result
}
