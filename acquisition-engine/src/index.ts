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
import { runFundaScraper } from './workers/funda-scraper'
import { runKadasterScraper } from './workers/kadaster-scraper'
import { runPermitsScraper } from './workers/permits-scraper'
import { runImmobeltScraper } from './workers/immobelt-scraper'
import { runKvKCompanyProfiler } from './workers/kvk-company-profiler'
import { runSpatialPlanningScraper } from './workers/spatial-planning-scraper'
import { runBuildingInspectionScraper } from './workers/building-inspection-scraper'
import { runMarketAnalysisScraper } from './workers/market-analysis-scraper'
import { runEnvironmentalRiskScraper } from './workers/environmental-risk-scraper'
import { runNeighborhoodAnalyticsScraper } from './workers/neighborhood-analytics-scraper'
import { runPropertyValuationScraper } from './workers/property-valuation-scraper'
import { runOpportunityScraper } from './workers/opportunity-scoring-scraper'
import { runPredictiveModelsScraper } from './workers/predictive-models-scraper'
import { runPortfolioOptimizationScraper } from './workers/portfolio-optimization-scraper'
import { runAlertAnomalyDetectionScraper } from './workers/alert-anomaly-detection-scraper'

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

app.post('/workers/funda-scraper/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('FundaScraper', runFundaScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/kadaster-scraper/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('KadasterScraper', runKadasterScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/permits-scraper/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('PermitsScraper', runPermitsScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/immobelt-scraper/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('ImmobeltScraper', runImmobeltScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/kvk-profiler/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('KvKCompanyProfiler', runKvKCompanyProfiler)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/spatial-planning/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('SpatialPlanningScraper', runSpatialPlanningScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/building-inspection/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('BuildingInspectionScraper', runBuildingInspectionScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/market-analysis/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('MarketAnalysisScraper', runMarketAnalysisScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/environmental-risk/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('EnvironmentalRiskScraper', runEnvironmentalRiskScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/neighborhood-analytics/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('NeighborhoodAnalyticsScraper', runNeighborhoodAnalyticsScraper)
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/property-valuation/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('PropertyValuationScraper', runPropertyValuationScraper)
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/opportunity-scoring/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('OpportunityScoringScraperWorker', runOpportunityScraper)
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/predictive-models/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('PredictiveModelsScraperWorker', runPredictiveModelsScraper)
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/portfolio-optimization/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('PortfolioOptimizationScraper', runPortfolioOptimizationScraper)
    res.json(result)
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

app.post('/workers/alert-anomaly-detection/run', async (_req: Request, res: Response) => {
  try {
    const result = await withAgentGuard('AlertAnomalyDetectionScraper', runAlertAnomalyDetectionScraper)
    res.json(result)
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

// FundaScraper: elke 4 uur (00:00, 04:00, 08:00, etc.) — 150 listings/run
cron.schedule('0 */4 * * *', () => {
  withAgentGuard('FundaScraper', runFundaScraper)
    .catch(err => logger.error('Scheduled FundaScraper failed', { err: String(err) }))
}, { timezone: TZ })

// KadasterScraper: dagelijks om 05:00 deals verrijken met BAG data
cron.schedule('0 5 * * *', () => {
  withAgentGuard('KadasterScraper', runKadasterScraper)
    .catch(err => logger.error('Scheduled KadasterScraper failed', { err: String(err) }))
}, { timezone: TZ })

// PermitsScraper: dagelijks om 07:00 recente bouwvergunningen ophalen
cron.schedule('0 7 * * *', () => {
  withAgentGuard('PermitsScraper', runPermitsScraper)
    .catch(err => logger.error('Scheduled PermitsScraper failed', { err: String(err) }))
}, { timezone: TZ })

// ImmobeltScraper: dagelijks om 03:00 commerciële vastgoedopportuniteiten
cron.schedule('0 3 * * *', () => {
  withAgentGuard('ImmobeltScraper', runImmobeltScraper)
    .catch(err => logger.error('Scheduled ImmobeltScraper failed', { err: String(err) }))
}, { timezone: TZ })

// KvKCompanyProfiler: elke 6 uur bedrijfsinformatie verrijken
cron.schedule('0 */6 * * *', () => {
  withAgentGuard('KvKCompanyProfiler', runKvKCompanyProfiler)
    .catch(err => logger.error('Scheduled KvKCompanyProfiler failed', { err: String(err) }))
}, { timezone: TZ })

// SpatialPlanningScraper: dagelijks om 04:00 ruimtelijke planningen verrijken
cron.schedule('0 4 * * *', () => {
  withAgentGuard('SpatialPlanningScraper', runSpatialPlanningScraper)
    .catch(err => logger.error('Scheduled SpatialPlanningScraper failed', { err: String(err) }))
}, { timezone: TZ })

// BuildingInspectionScraper: dagelijks om 02:00 bouwveiligheid/inspecties verrijken
cron.schedule('0 2 * * *', () => {
  withAgentGuard('BuildingInspectionScraper', runBuildingInspectionScraper)
    .catch(err => logger.error('Scheduled BuildingInspectionScraper failed', { err: String(err) }))
}, { timezone: TZ })

// MarketAnalysisScraper: elke 12 uur marktgegevens verrijken
cron.schedule('0 */12 * * *', () => {
  withAgentGuard('MarketAnalysisScraper', runMarketAnalysisScraper)
    .catch(err => logger.error('Scheduled MarketAnalysisScraper failed', { err: String(err) }))
}, { timezone: TZ })

// EnvironmentalRiskScraper: elke 8 uur risico-analyse voor milieu, grond, overstromingsgevaar
cron.schedule('0 */8 * * *', () => {
  withAgentGuard('EnvironmentalRiskScraper', runEnvironmentalRiskScraper)
    .catch(err => logger.error('Scheduled EnvironmentalRiskScraper failed', { err: String(err) }))
}, { timezone: TZ })

// NeighborhoodAnalyticsScraper: elke 6 uur buurt-analyses (scholen, criminaliteit, openbaar vervoer, demografie)
cron.schedule('0 */6 * * *', () => {
  withAgentGuard('NeighborhoodAnalyticsScraper', runNeighborhoodAnalyticsScraper)
    .catch(err => logger.error('Scheduled NeighborhoodAnalyticsScraper failed', { err: String(err) }))
}, { timezone: TZ })

// PropertyValuationScraper: elke 6 uur waarderinganalyses (WOZ, historische prijzen, comparables, ROI)
cron.schedule('0 */6 * * *', () => {
  withAgentGuard('PropertyValuationScraper', runPropertyValuationScraper)
    .catch(err => logger.error('Scheduled PropertyValuationScraper failed', { err: String(err) }))
}, { timezone: TZ })

// OpportunityScoringScraperWorker: elke 4 uur opportunity-ranking van alle verrijkte deals
cron.schedule('0 */4 * * *', () => {
  withAgentGuard('OpportunityScoringScraperWorker', runOpportunityScraper)
    .catch(err => logger.error('Scheduled OpportunityScoringScraperWorker failed', { err: String(err) }))
}, { timezone: TZ })

// PredictiveModelsScraperWorker: elke 4 uur ML-gebaseerde ROI/prijs/markt prognoses
cron.schedule('0 */4 * * *', () => {
  withAgentGuard('PredictiveModelsScraperWorker', runPredictiveModelsScraper)
    .catch(err => logger.error('Scheduled PredictiveModelsScraperWorker failed', { err: String(err) }))
}, { timezone: TZ })

// PortfolioOptimizationScraper: elke 6 uur portfolio-samenstelling, diversificatie, rebalancing aanbevelingen
cron.schedule('0 */6 * * *', () => {
  withAgentGuard('PortfolioOptimizationScraper', runPortfolioOptimizationScraper)
    .catch(err => logger.error('Scheduled PortfolioOptimizationScraper failed', { err: String(err) }))
}, { timezone: TZ })

// AlertAnomalyDetectionScraper: elke 2 uur alerts en anomalieën detecteren voor actieve deals
cron.schedule('0 */2 * * *', () => {
  withAgentGuard('AlertAnomalyDetectionScraper', runAlertAnomalyDetectionScraper)
    .catch(err => logger.error('Scheduled AlertAnomalyDetectionScraper failed', { err: String(err) }))
}, { timezone: TZ })

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Acquisition Engine started on :${PORT} (tz=${TZ})`)
  logger.info('23 cron schedules: DealHunter, OffMarketAI, PermitAI, MunicipalityAI, InvestorAI, OutreachAI, RiskAI, AcquisitionDirectorAI, FundaScraper, KadasterScraper, PermitsScraper, ImmobeltScraper, KvKCompanyProfiler, SpatialPlanningScraper, BuildingInspectionScraper, MarketAnalysisScraper, EnvironmentalRiskScraper, NeighborhoodAnalyticsScraper, PropertyValuationScraper, OpportunityScoringScraperWorker, PredictiveModelsScraperWorker, PortfolioOptimizationScraper, AlertAnomalyDetectionScraper')
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down')
  process.exit(0)
})
