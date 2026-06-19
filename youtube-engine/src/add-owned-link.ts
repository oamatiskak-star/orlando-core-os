/**
 * Owned backlink: voegt de aquier.com-link toe aan de KANAALBESCHRIJVING van de
 * finance-kanalen (NIET de loop-kanalen BrickPulse/LoopForge/SliceTheory — daar
 * past een finance-link niet). Idempotent + veilig (GET-eerst, alleen aanvullen).
 *
 * Dry-run standaard (toont wat zou gebeuren). Echt schrijven: APPLY=1.
 *   npx ts-node --transpile-only src/add-owned-link.ts          # dry-run
 *   APPLY=1 npx ts-node --transpile-only src/add-owned-link.ts  # toepassen
 */
import 'dotenv/config'
import { getSupabase, ChannelRecord } from './lib/supabase'
import { buildOAuthClient, appendChannelDescriptionLink } from './lib/youtube-api'
import { logger } from './lib/logger'

const LINK_LINE = '🔗 Off-market vastgoeddeals & AI-analyse → https://aquier.com'
const FINANCE_CHANNELS = [
  'VermogenTv', 'SpaarTv', 'VastgoedTv', 'CryptoVermogen', 'BeleggingsTv',
  'AquierTv', 'AquierNL', 'AquierTvEs', 'PropertyInvestorTv',
]
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
      const result = await appendChannelDescriptionLink(auth, LINK_LINE, { apply: APPLY })
      logger.info(`  ${naam}: ${result}`)
    } catch (e) {
      logger.error(`  ${naam}: FOUT — ${(e as Error).message}`)
    }
  }
  logger.info(APPLY ? 'Klaar (toegepast).' : 'Klaar (dry-run — herhaal met APPLY=1 om te schrijven).')
}

main().catch((e) => { logger.error(`Fatal: ${(e as Error).message}`); process.exit(1) })
