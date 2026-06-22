/**
 * Owned backlink: voegt per finance-kanaal een UTM-getagde Aquier-link toe aan de
 * KANAALBESCHRIJVING (NIET de loop-kanalen BrickPulse/LoopForge/SliceTheory — daar past
 * een finance-link niet). NL-kanalen → de matchende kennisbank-niche-hub; EN-kanalen → /en.
 * Idempotent (vervangt een oudere aquier.com-regel door de UTM-versie) + veilig (GET-eerst).
 *
 * UTM (utm_medium=channel, utm_campaign=<kanaal>) → verkeer telt als kanaal 'youtube' in
 * vastgoed_core.v_youtube_channel_health / v_growth_channels.
 *
 * Dry-run standaard (toont wat zou gebeuren). Echt schrijven: APPLY=1.
 *   npx ts-node --transpile-only src/add-owned-link.ts          # dry-run
 *   APPLY=1 npx ts-node --transpile-only src/add-owned-link.ts  # toepassen
 */
import 'dotenv/config'
import { getSupabase, ChannelRecord } from './lib/supabase'
import { buildOAuthClient, appendChannelDescriptionLink } from './lib/youtube-api'
import { logger } from './lib/logger'

const FINANCE_CHANNELS = [
  'VermogenTv', 'SpaarTv', 'VastgoedTv', 'CryptoVermogen', 'BeleggingsTv',
  'AquierTv', 'AquierNL', 'AquierTvEs', 'AquierDE', 'PropertyInvestorTv',
]
// NL-kanaal → kennisbank-niche-hub (matchend onderwerp).
const NICHE_BY_CHANNEL: Record<string, string> = {
  VermogenTv: 'vermogen', SpaarTv: 'sparen', VastgoedTv: 'vastgoed',
  CryptoVermogen: 'crypto', BeleggingsTv: 'beleggen',
}
// Engelstalige kanalen → /en. AquierDE → de Duitse landing /de.
const EN_CHANNELS = new Set(['PropertyInvestorTv', 'AquierTvEs', 'AquierTv'])

/** Per-kanaal UTM-getagde owned-link. */
function ownedLinkLine(naam: string): string {
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
const APPLY = process.env.APPLY === '1'

async function main() {
  const db = getSupabase()
  logger.info(`add-owned-link — ${APPLY ? 'APPLY (live)' : 'DRY-RUN'} — ${FINANCE_CHANNELS.length} finance-kanalen`)

  for (const naam of FINANCE_CHANNELS) {
    const { data: channel } = await db
      .from('youtube_channels').select('*').eq('naam', naam).maybeSingle()
    const ch = channel as ChannelRecord | null
    if (!ch) { logger.warn(`  ${naam}: niet gevonden`); continue }
    if (!ch.refresh_token) { logger.warn(`  ${naam}: geen OAuth-token`); continue }

    try {
      const auth = buildOAuthClient(ch)
      const line = ownedLinkLine(naam)
      const result = await appendChannelDescriptionLink(auth, line, { apply: APPLY })
      logger.info(`  ${naam}: ${result} — ${line}`)
    } catch (e) {
      logger.error(`  ${naam}: FOUT — ${(e as Error).message}`)
    }
  }
  logger.info(APPLY ? 'Klaar (toegepast).' : 'Klaar (dry-run — herhaal met APPLY=1 om te schrijven).')
}

main().catch((e) => { logger.error(`Fatal: ${(e as Error).message}`); process.exit(1) })
