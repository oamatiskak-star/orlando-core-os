import { getSupabase, ChannelRecord } from './supabase'
import { buildOAuthClient, appendChannelDescriptionLink } from './youtube-api'

/**
 * Owned backlink-logica (gedeeld door het handmatige add-owned-link-script én de
 * dagelijkse publish-sweep). Per finance-kanaal een UTM-getagde Aquier-link in de
 * KANAALBESCHRIJVING: NL → kennisbank-niche-hub, EN → /en, AquierDE → /de.
 * Idempotent (appendChannelDescriptionLink vervangt een oudere aquier.com-regel /
 * skipt als de exacte regel er al staat).
 */
const FINANCE_CHANNELS = [
  'VermogenTv', 'SpaarTv', 'VastgoedTv', 'CryptoVermogen', 'BeleggingsTv',
  'AquierTv', 'AquierNL', 'AquierTvEs', 'AquierDE', 'PropertyInvestorTv',
]
const NICHE_BY_CHANNEL: Record<string, string> = {
  VermogenTv: 'vermogen', SpaarTv: 'sparen', VastgoedTv: 'vastgoed',
  CryptoVermogen: 'crypto', BeleggingsTv: 'beleggen',
}
const EN_CHANNELS = new Set(['PropertyInvestorTv', 'AquierTvEs', 'AquierTv'])

export function ownedLinkLine(naam: string): string {
  const utm = `utm_source=youtube&utm_medium=channel&utm_campaign=${naam.toLowerCase()}`
  if (naam === 'AquierDE') {
    return `🔗 Verborgenen Immobilienwert finden, bevor der Markt es tut → https://aquier.com/de?${utm}`
  }
  if (EN_CHANNELS.has(naam)) {
    return `🔗 Off-market real estate deals & AI analysis → https://aquier.com/en?${utm}`
  }
  const niche = NICHE_BY_CHANNEL[naam]
  const path = niche ? `/kennisbank/onderwerp/${niche}` : '/kennisbank'
  return `🔗 Off-market vastgoeddeals & AI-analyse → https://aquier.com${path}?${utm}`
}

type Logger = { info: (m: string, x?: unknown) => void; warn: (m: string, x?: unknown) => void; error: (m: string, x?: unknown) => void }

/** Zet/ververst de owned-link op alle finance-kanalen. apply=false = dry-run. */
export async function ensureOwnedLinks(apply: boolean, log?: Logger): Promise<{ updated: number; skipped: number; failed: number }> {
  const db = getSupabase()
  let updated = 0, skipped = 0, failed = 0
  for (const naam of FINANCE_CHANNELS) {
    try {
      const { data: channel } = await db.from('youtube_channels').select('*').eq('naam', naam).maybeSingle()
      const ch = channel as ChannelRecord | null
      if (!ch?.refresh_token) { skipped++; continue }
      const auth = buildOAuthClient(ch)
      const result = await appendChannelDescriptionLink(auth, ownedLinkLine(naam), { apply })
      if (result === 'updated' || result === 'would_update') updated++
      else skipped++
      log?.info(`owned-link ${naam}: ${result}`)
    } catch (e) {
      failed++
      log?.warn(`owned-link ${naam} faalde`, { error: (e as Error).message })
    }
  }
  return { updated, skipped, failed }
}
