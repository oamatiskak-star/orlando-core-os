import { supabase } from '../supabase'
import { logger } from '../logger'
import { computeDedupeKey } from '../fund-fit'

// ── RVO — NL non-dilutive regelingen (🟢 publieke open data, geen scraping) ───
// RVO biedt geen schone JSON-API voor regelingen; de regelingen zelf zijn
// publiek. We seeden daarom de kern-NL-regelingen die passen bij een AI/
// proptech-platform als grant-prospects. Idempotent via dedupe_key.
// Bijwerken = deze lijst aanpassen (publieke bron-URL's per regeling).

interface RvoScheme {
  name: string
  url: string
  thesis: string
  ticketMin: number | null
  ticketMax: number | null
}

const RVO_SCHEMES: RvoScheme[] = [
  {
    name: 'RVO — WBSO (R&D-afdrachtvermindering)',
    url: 'https://www.rvo.nl/subsidies-financiering/wbso',
    thesis: 'Fiscale R&D-stimulering: afdrachtvermindering loonheffing voor speur- en ontwikkelingswerk (software/AI). Non-dilutive.',
    ticketMin: null, ticketMax: null,
  },
  {
    name: 'RVO — Innovatiekrediet',
    url: 'https://www.rvo.nl/subsidies-financiering/innovatiekrediet',
    thesis: 'Risicodragend krediet voor technische ontwikkelprojecten. Tot ca. €5M, terugbetaling alleen bij succes.',
    ticketMin: 150_000, ticketMax: 5_000_000,
  },
  {
    name: 'RVO — MIT (MKB-innovatiestimulering)',
    url: 'https://www.rvo.nl/subsidies-financiering/mit',
    thesis: 'MKB-innovatiesubsidie: haalbaarheidsprojecten en R&D-samenwerking binnen topsectoren.',
    ticketMin: 20_000, ticketMax: 200_000,
  },
  {
    name: 'RVO — Vroegefasefinanciering (VFF)',
    url: 'https://www.rvo.nl/subsidies-financiering/vff',
    thesis: 'Lening voor startups/MKB om een idee naar de fase te brengen waarin het te financieren is door investeerders.',
    ticketMin: 50_000, ticketMax: 350_000,
  },
  {
    name: 'RVO — SEED Capital (fondsregeling)',
    url: 'https://www.rvo.nl/subsidies-financiering/seed-capital',
    thesis: 'Verdubbelt privaat investeringskapitaal in technostarters via aangesloten investeringsfondsen.',
    ticketMin: 100_000, ticketMax: 3_500_000,
  },
]

export interface RvoResult {
  schemesSeeded: number
  prospectsInserted: number
  prospectsSkipped: number
}

/** Seed de NL non-dilutive RVO-regelingen als grant-prospects. Idempotent. */
export async function ingestRvoSchemes(): Promise<RvoResult> {
  const result: RvoResult = { schemesSeeded: RVO_SCHEMES.length, prospectsInserted: 0, prospectsSkipped: 0 }

  for (const scheme of RVO_SCHEMES) {
    const dedupeKey = computeDedupeKey(scheme.name, scheme.url)

    const { data: existing } = await supabase
      .from('fund_prospects')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()
    if (existing) { result.prospectsSkipped++; continue }

    const { data: inserted, error } = await supabase
      .from('fund_prospects')
      .insert({
        name:           scheme.name,
        investor_type:  'grant',
        thesis:         scheme.thesis,
        focus_sectors:  ['ai', 'saas', 'deeptech', 'proptech'],
        stage_focus:    ['grant'],
        ticket_min_eur: scheme.ticketMin,
        ticket_max_eur: scheme.ticketMax,
        geo_focus:      ['NL'],
        website:        scheme.url,
        source:         'rvo',
        source_url:     scheme.url,
        status:         'nieuw',
        dedupe_key:     dedupeKey,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      logger.error(`ingestRvoSchemes: insert mislukt voor "${scheme.name}"`, { err: error?.message })
      result.prospectsSkipped++
      continue
    }
    result.prospectsInserted++

    await supabase.from('fund_activity_log').insert({
      prospect_id: inserted.id,
      agent:       'InvestorScoutAI',
      action:      'discovered',
      detail:      { source: 'rvo', scheme: scheme.name },
    })
  }

  logger.info('ingestRvoSchemes done', result)
  return result
}
