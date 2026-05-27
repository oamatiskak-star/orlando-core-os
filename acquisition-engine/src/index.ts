import 'dotenv/config'
import express, { Request, Response } from 'express'
import cron from 'node-cron'
import { logger } from './lib/logger'
import { supabase } from './lib/supabase'
import { runDealHunter } from './agents/deal-hunter'
import { runOffMarketAI } from './agents/offmarket-ai'
import { runPermitAI } from './agents/permit-ai'
import { runMunicipalityAI } from './agents/municipality-ai'
import { runInvestorAI } from './agents/investor-ai'
import { runOutreachAI } from './agents/outreach-ai'
import { runRiskAI } from './agents/risk-ai'
import { runAcquisitionDirector } from './agents/acquisition-director'
import { runBuildOppsScanner } from './agents/build-opps-scanner'
import { runInvestorScoutAI } from './agents/investor-scout-ai'
import { runFundOutreachAI } from './agents/fund-outreach-ai'

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.PORT ?? '3005', 10)
const TZ   = process.env.AGENT_TIMEZONE ?? 'Europe/Amsterdam'

async function withAgentGuard<T>(agentName: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn()
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('acq_agent_registry')
      .update({ status: 'error', last_heartbeat: new Date().toISOString() })
      .eq('name', agentName)
    logger.error(`${agentName} guard caught error`, { message })
    throw err
  }
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status:  'ok',
    service: 'acquisition-engine',
    time:    new Date().toISOString(),
    tz:      TZ,
  })
})

// ── Manual trigger endpoints ─────────────────────────────────────────────────
app.post('/agents/deal-hunter/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('DealHunter', runDealHunter)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/offmarket-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('OffMarketAI', runOffMarketAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/permit-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('PermitAI', runPermitAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/municipality-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('MunicipalityAI', runMunicipalityAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/investor-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('InvestorAI', runInvestorAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/outreach-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('OutreachAI', runOutreachAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/risk-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('RiskAI', runRiskAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/director/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('AcquisitionDirectorAI', runAcquisitionDirector)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/build-opps-scanner/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('BuildOppsScanner', runBuildOppsScanner)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// ── Startup Investor Scout (fundraising voor Modiwe/Aquier) ──────────────────
app.post('/agents/investor-scout-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('InvestorScoutAI', runInvestorScoutAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/agents/fund-outreach-ai/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('FundOutreachAI', runFundOutreachAI)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// ── Scan jobs endpoint (Vercel cron callback) ────────────────────────────────
// POST /scan — Vercel cron routes inserteren scan_jobs, worker pakt ze op
app.post('/scan', async (_req: Request, res: Response) => {
  try {
    const results = await Promise.allSettled([
      withAgentGuard('DealHunter', runDealHunter),
      withAgentGuard('PermitAI',   runPermitAI),
      withAgentGuard('RiskAI',     runRiskAI),
      withAgentGuard('InvestorAI', runInvestorAI),
    ])
    res.json({ status: 'ok', results: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message }) })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// ── Cron schedules ────────────────────────────────────────────────────────────
// DealHunter: elk uur scan van queued jobs + ongescoorde deals
cron.schedule('0 * * * *', () => {
  withAgentGuard('DealHunter', runDealHunter)
    .catch(err => logger.error('Scheduled DealHunter failed', { err: String(err) }))
}, { timezone: TZ })

// OffMarketAI: elke 2 uur nieuwe leads verrijken
cron.schedule('0 */2 * * *', () => {
  withAgentGuard('OffMarketAI', runOffMarketAI)
    .catch(err => logger.error('Scheduled OffMarketAI failed', { err: String(err) }))
}, { timezone: TZ })

// PermitAI: elke 4 uur relevantie-scores bijwerken
cron.schedule('30 */4 * * *', () => {
  withAgentGuard('PermitAI', runPermitAI)
    .catch(err => logger.error('Scheduled PermitAI failed', { err: String(err) }))
}, { timezone: TZ })

// MunicipalityAI: dagelijks om 06:00 gemeente-profielen verrijken
cron.schedule('0 6 * * *', () => {
  withAgentGuard('MunicipalityAI', runMunicipalityAI)
    .catch(err => logger.error('Scheduled MunicipalityAI failed', { err: String(err) }))
}, { timezone: TZ })

// InvestorAI: 3x per dag investor-deal matching
cron.schedule('0 8,13,18 * * *', () => {
  withAgentGuard('InvestorAI', runInvestorAI)
    .catch(err => logger.error('Scheduled InvestorAI failed', { err: String(err) }))
}, { timezone: TZ })

// OutreachAI: elke 30 min geplande berichten genereren
cron.schedule('*/30 * * * *', () => {
  withAgentGuard('OutreachAI', runOutreachAI)
    .catch(err => logger.error('Scheduled OutreachAI failed', { err: String(err) }))
}, { timezone: TZ })

// RiskAI: elke 2 uur risk scores bijwerken
cron.schedule('15 */2 * * *', () => {
  withAgentGuard('RiskAI', runRiskAI)
    .catch(err => logger.error('Scheduled RiskAI failed', { err: String(err) }))
}, { timezone: TZ })

// AcquisitionDirectorAI: dagelijkse briefing om 07:30
cron.schedule('30 7 * * *', () => {
  withAgentGuard('AcquisitionDirectorAI', runAcquisitionDirector)
    .catch(err => logger.error('Scheduled AcquisitionDirector failed', { err: String(err) }))
}, { timezone: TZ })

// BuildOppsScanner: dagelijks om 06:30 (na bouw-scan cron)
cron.schedule('30 6 * * *', () => {
  withAgentGuard('BuildOppsScanner', runBuildOppsScanner)
    .catch(err => logger.error('Scheduled BuildOppsScanner failed', { err: String(err) }))
}, { timezone: TZ })

// InvestorScoutAI: 2x per dag startup-investeerders discover/score/queue
cron.schedule('0 7,15 * * *', () => {
  withAgentGuard('InvestorScoutAI', runInvestorScoutAI)
    .catch(err => logger.error('Scheduled InvestorScoutAI failed', { err: String(err) }))
}, { timezone: TZ })

// FundOutreachAI: elke 30 min fundraising cold-email drafts (klaar_voor_review)
cron.schedule('*/30 * * * *', () => {
  withAgentGuard('FundOutreachAI', runFundOutreachAI)
    .catch(err => logger.error('Scheduled FundOutreachAI failed', { err: String(err) }))
}, { timezone: TZ })

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Acquisition Engine started on :${PORT} (tz=${TZ})`)
  logger.info('10 cron schedules: DealHunter, OffMarketAI, PermitAI, MunicipalityAI, InvestorAI, OutreachAI, RiskAI, AcquisitionDirectorAI, InvestorScoutAI, FundOutreachAI')
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down')
  process.exit(0)
})
