/**
 * Owned backlink: zet per finance-kanaal een UTM-getagde Aquier-link in de KANAAL-
 * BESCHRIJVING (NL → kennisbank-niche-hub, EN → /en, AquierDE → /de). De logica zit in
 * lib/owned-link.ts (ensureOwnedLinks) en wordt óók dagelijks door de publish-sweep gedraaid.
 *
 * Dry-run standaard. Echt schrijven: APPLY=1.
 *   npx ts-node --transpile-only src/add-owned-link.ts          # dry-run
 *   APPLY=1 npx ts-node --transpile-only src/add-owned-link.ts  # toepassen
 */
import 'dotenv/config'
import { ensureOwnedLinks } from './lib/owned-link'
import { logger } from './lib/logger'

const APPLY = process.env.APPLY === '1'

async function main() {
  logger.info(`add-owned-link — ${APPLY ? 'APPLY (live)' : 'DRY-RUN'}`)
  const r = await ensureOwnedLinks(APPLY, logger)
  logger.info('Klaar', r)
}

main().catch((e) => { logger.error(`Fatal: ${(e as Error).message}`); process.exit(1) })
