/**
 * One-shot: publiceer de overdue private video's van de FINANCE-kanalen (niet de
 * loop-kanalen). Handmatige variant — publiceert standaard ALLES (max 1000); de
 * gedeelde logica + dagelijkse window-gated sweep zit in workers/publish-overdue-sweep.ts.
 * Run: npx ts-node --transpile-only src/publish-overdue-finance.ts
 *      PUBLISH_FINANCE_MAX_PER_RUN=40 npx ts-node --transpile-only src/publish-overdue-finance.ts
 */
import "dotenv/config";
import { publishOverdueFinance } from "./workers/publish-overdue-sweep";

async function main() {
  const max = parseInt(process.env.PUBLISH_FINANCE_MAX_PER_RUN ?? "1000", 10);
  const { published, quotaHit } = await publishOverdueFinance(max);
  console.log(`Gepubliceerd: ${published}${quotaHit ? " (YouTube-quota bereikt — herhaal later)" : ""}.`);
  process.exit(0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
