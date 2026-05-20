import 'dotenv/config'
import express, { Request, Response } from 'express'
import cron from 'node-cron'
import { logger } from './lib/logger'
import { runAtlasBriefing } from './agents/atlas'
import { runViralAnalystSweep } from './agents/viral-analyst'
import { runChannelManagersSweep } from './agents/channel-manager'
import { runAlgorithmStrategist } from './agents/algorithm-strategist'
import { runRetentionScientist } from './agents/retention-scientist'
import { runContentFundManager } from './agents/content-fund-manager'
import { supabase } from './lib/supabase'

const app = express()
app.use(express.json())

const PORT = parseInt(process.env.PORT ?? '3004', 10)
const TZ = process.env.AGENT_TIMEZONE ?? 'Europe/Amsterdam'

async function markWorker(name: string, status: 'idle' | 'running' | 'error', lastError?: string) {
  await supabase
    .from('media_holding_workers')
    .update({ status, last_error: lastError ?? null, last_seen: new Date().toISOString() })
    .eq('name', name)
}

async function withWorkerStatus<T>(workerName: string, fn: () => Promise<T>): Promise<T> {
  await markWorker(workerName, 'running')
  try {
    const result = await fn()
    await markWorker(workerName, 'idle')
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await markWorker(workerName, 'error', message)
    throw err
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'executive-engine', time: new Date().toISOString(), tz: TZ })
})

app.post('/agents/atlas/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('atlas-ceo', () => runAtlasBriefing())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

app.post('/agents/viral-analyst/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('viral-analyst', () => runViralAnalystSweep())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

app.post('/agents/channel-managers/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('channel-managers', () => runChannelManagersSweep())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

app.post('/agents/algorithm-strategist/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('algorithm-strategist', () => runAlgorithmStrategist())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

app.post('/agents/retention-scientist/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('retention-scientist', () => runRetentionScientist())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

app.post('/agents/content-fund-manager/run', async (_req: Request, res: Response) => {
  try {
    const result = await withWorkerStatus('content-fund-manager', () => runContentFundManager())
    res.json({ status: 'ok', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ status: 'error', error: message })
  }
})

cron.schedule('0 7 * * *', () => {
  withWorkerStatus('atlas-ceo', () => runAtlasBriefing())
    .catch(err => logger.error('Scheduled ATLAS failed', { err: String(err) }))
}, { timezone: TZ })

cron.schedule('*/15 * * * *', () => {
  withWorkerStatus('viral-analyst', () => runViralAnalystSweep())
    .catch(err => logger.error('Scheduled Viral Analyst failed', { err: String(err) }))
}, { timezone: TZ })

cron.schedule('0 8 * * *', () => {
  withWorkerStatus('channel-managers', () => runChannelManagersSweep())
    .catch(err => logger.error('Scheduled Channel Managers failed', { err: String(err) }))
}, { timezone: TZ })

cron.schedule('0 */6 * * *', () => {
  withWorkerStatus('algorithm-strategist', () => runAlgorithmStrategist())
    .catch(err => logger.error('Scheduled Algorithm Strategist failed', { err: String(err) }))
}, { timezone: TZ })

cron.schedule('30 8 * * *', () => {
  withWorkerStatus('retention-scientist', () => runRetentionScientist())
    .catch(err => logger.error('Scheduled Retention Scientist failed', { err: String(err) }))
}, { timezone: TZ })

cron.schedule('0 9 * * 1', () => {
  withWorkerStatus('content-fund-manager', () => runContentFundManager())
    .catch(err => logger.error('Scheduled Content Fund Manager failed', { err: String(err) }))
}, { timezone: TZ })

app.listen(PORT, () => {
  logger.info(`Executive Engine started on :${PORT} (tz=${TZ})`)
  logger.info('6 cron schedules registered: ATLAS, Viral Analyst, Channel Managers, Algorithm Strategist, Retention Scientist, Content Fund Manager')
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down')
  process.exit(0)
})
