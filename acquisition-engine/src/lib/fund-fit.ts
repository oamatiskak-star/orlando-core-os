import type { FundProspect } from './types'

// ── AQUIER_PROFILE — fit-criteria voor fundraising (overschrijfbaar via config) ─
// Hard-coded profiel: proptech/AI, pre-seed/seed, NL/EU, ticket €250k–€3M,
// grants-first (non-dilutive). Kan via acq_agent_registry.config jsonb worden
// overschreven (zie investor-scout-ai.ts → loadProfile()).

export interface AquierProfile {
  sectors: string[]
  stage: string[]
  geo: string[]
  ticket: { min: number; max: number }
  prefer_grants: boolean
  edge_signals: string[]
}

export const AQUIER_PROFILE: AquierProfile = {
  sectors: ['proptech', 'real-estate-tech', 'real-estate', 'ai', 'saas', 'vertical-saas', 'fintech-adjacent'],
  stage:   ['pre_seed', 'seed'],
  geo:     ['NL', 'EU', 'DACH', 'benelux'],
  ticket:  { min: 250_000, max: 3_000_000 },
  prefer_grants: true,
  edge_signals: ['domain-expertise-thesis', 'operator-vc', 'real-estate-portfolio'],
}

export interface FundFitResult {
  score: number
  reasoning: string
}

const PROPTECH_TERMS = ['proptech', 'real-estate', 'real estate', 'realestate', 'vastgoed', 'construction', 'contech']
const AI_SAAS_TERMS  = ['ai', 'artificial intelligence', 'machine learning', 'saas', 'vertical-saas', 'vertical saas', 'software']

function lc(arr: unknown): string[] {
  return Array.isArray(arr) ? (arr as unknown[]).map(v => String(v).toLowerCase()) : []
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return haystack.some(h => needles.some(n => h.includes(n)))
}

/** Normaliseer een fund/persoon-naam + website tot een stabiele dedupe-sleutel. */
export function computeDedupeKey(name: string, website: string | null | undefined): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ')
  let domain = ''
  if (website) {
    domain = website
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
  }
  return `${n}|${domain}`
}

/**
 * Rule-engine fit-score (0-100) tegen AQUIER_PROFILE. Basis 30, clamp 0-100.
 * Uitlegbaar: retourneert een opsomming van de toegekende punten.
 * Zelfde stijl als computeMatchScore() in investor-ai.ts.
 */
export function computeFundFit(
  prospect: Pick<
    FundProspect,
    'investor_type' | 'thesis' | 'focus_sectors' | 'stage_focus' |
    'ticket_min_eur' | 'ticket_max_eur' | 'geo_focus' | 'notable_portfolio'
  >,
  profile: AquierProfile = AQUIER_PROFILE,
  hasContactEmail = true,
): FundFitResult {
  let score = 30
  const reasons: string[] = ['basis +30']

  const sectors   = lc(prospect.focus_sectors)
  const stages    = lc(prospect.stage_focus)
  const geos      = lc(prospect.geo_focus)
  const portfolio = lc(prospect.notable_portfolio)
  const thesis    = (prospect.thesis ?? '').toLowerCase()
  const sectorHay = [...sectors, thesis]

  // Sector-overlap.
  if (hasAny(sectorHay, PROPTECH_TERMS)) {
    score += 25; reasons.push('sector proptech/real-estate +25')
  } else if (hasAny(sectorHay, AI_SAAS_TERMS)) {
    score += 12; reasons.push('sector ai/saas +12')
  } else {
    reasons.push('geen sector-overlap +0')
  }

  // Stage.
  const earlyStage = stages.some(s => s === 'pre_seed' || s === 'seed' || s === 'rolling')
  const laterOnly  = stages.length > 0 &&
    stages.every(s => ['series_a', 'series_b', 'series_c', 'growth', 'late'].includes(s))
  if (prospect.investor_type === 'grant') {
    score += 20; reasons.push('grant = altijd vroege fase +20')
  } else if (earlyStage) {
    score += 20; reasons.push('stage pre-seed/seed +20')
  } else if (laterOnly) {
    score -= 15; reasons.push('alleen series_a/later -15')
  }

  // Geo.
  if (geos.some(g => g === 'nl' || g === 'netherlands' || g === 'nederland' || g === 'benelux')) {
    score += 15; reasons.push('geo NL/benelux +15')
  } else if (geos.some(g => ['eu', 'europe', 'dach', 'emea'].includes(g))) {
    score += 10; reasons.push('geo EU +10')
  } else if (geos.some(g => g === 'global' || g === 'worldwide')) {
    score += 3; reasons.push('geo global +3')
  } else if (geos.length > 0 && geos.every(g => ['us', 'usa', 'united states', 'north-america', 'north america'].includes(g))) {
    score -= 10; reasons.push('US-only zonder EU -10')
  }

  // Ticket-overlap met €250k–€3M (range-overlap, niet strikt binnen).
  const tMin = prospect.ticket_min_eur
  const tMax = prospect.ticket_max_eur
  if (prospect.investor_type === 'grant') {
    reasons.push('ticket n.v.t. (grant)')
  } else if (tMin !== null || tMax !== null) {
    const lo = tMin ?? 0
    const hi = tMax ?? Number.POSITIVE_INFINITY
    const overlaps = lo <= profile.ticket.max && hi >= profile.ticket.min
    if (overlaps) { score += 15; reasons.push('ticket overlap €250k–€3M +15') }
    else { score -= 15; reasons.push('ticket buiten €250k–€3M -15') }
  }

  // Grant + prefer_grants (non-dilutive bonus).
  if (prospect.investor_type === 'grant' && profile.prefer_grants) {
    score += 15; reasons.push('non-dilutive grant + prefer_grants +15')
  }

  // Operator/domain-expertise thesis (snapt vastgoed-moat).
  const operatorSignals = ['operator', 'domain expert', 'domein', 'founder-led', 'vertical', 'industry insider', 'real estate']
  if (operatorSignals.some(s => thesis.includes(s))) {
    score += 10; reasons.push('operator/domain-expertise thesis +10')
  }

  // Notable proptech/RE in portfolio.
  if (hasAny(portfolio, PROPTECH_TERMS)) {
    score += 10; reasons.push('proptech/RE in portfolio +10')
  }

  // Geen email/contact (lagere prioriteit, niet diskwalificerend).
  if (!hasContactEmail) {
    score -= 5; reasons.push('geen contact-email -5')
  }

  const clamped = Math.max(0, Math.min(100, score))
  return { score: clamped, reasoning: `${clamped}/100 — ${reasons.join('; ')}` }
}
