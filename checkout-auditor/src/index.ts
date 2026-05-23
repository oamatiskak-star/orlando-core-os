import 'dotenv/config'
import express from 'express'
import cron from 'node-cron'

import { env } from './lib/secrets'
import { logger } from './lib/logger'
import healthRouter from './routes/health'
import runRouter from './routes/run'
import discoverRouter from './routes/discover'
import cleanupRouter from './routes/cleanup'
import { runAudit } from './runner/audit-runner'
import { runDiscovery } from './discovery'
import { supabase } from './lib/supabase'
import { deleteArtifact } from './lib/storage'

const app = express()
app.use(express.json({ limit: '4mb' }))

app.use(healthRouter)
app.use(runRouter)
app.use(discoverRouter)
app.use(cleanupRouter)

app.get('/', (_req, res) => {
  res.json({ service: 'checkout-auditor', endpoints: ['GET /health', 'POST /run', 'POST /discover', 'POST /cleanup'] })
})

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'checkout-auditor listening')
})

// ── Crons (Render-side) ──────────────────────────────────────────────────
// 03:00 NL — discovery refresh
cron.schedule('0 3 * * *', () => {
  logger.info('cron: discovery start')
  // Discovery run uses its own runs table row via the same flow as the HTTP route
  void (async () => {
    const { data, error } = await supabase
      .from('aquier_audit_runs')
      .insert({ status: 'running', triggered_by: 'cron_discovery', scope_filter: { discovery_only: true } })
      .select('id')
      .single()
    if (error || !data) {
      logger.error({ err: error?.message }, 'discovery cron run insert failed')
      return
    }
    try {
      const snaps = await runDiscovery(data.id as string)
      await supabase
        .from('aquier_audit_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), totals: { discovery_snapshots: snaps.length } })
        .eq('id', data.id as string)
    } catch (err) {
      await supabase
        .from('aquier_audit_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: String(err) })
        .eq('id', data.id as string)
    }
  })()
}, { timezone: env.AGENT_TIMEZONE })

// 04:00 NL — daily audit
cron.schedule('0 4 * * *', () => {
  logger.info('cron: audit start')
  runAudit({}, 'cron').catch(err => logger.error({ err: String(err) }, 'daily audit failed'))
}, { timezone: env.AGENT_TIMEZONE })

// Sunday 02:00 NL — artifact cleanup
cron.schedule('0 2 * * 0', () => {
  logger.info('cron: weekly cleanup start')
  void (async () => {
    const cutoff = new Date(Date.now() - env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('aquier_audit_artifacts')
      .select('id, storage_path')
      .lt('captured_at', cutoff)
      .limit(5000)
    for (const row of data ?? []) {
      await deleteArtifact(row.storage_path).catch(() => {})
      await supabase.from('aquier_audit_artifacts').delete().eq('id', row.id)
    }
    logger.info({ deleted: data?.length ?? 0 }, 'cron: cleanup done')
  })()
}, { timezone: env.AGENT_TIMEZONE })

// ── Graceful shutdown ────────────────────────────────────────────────────
function shutdown(): void {
  logger.info('shutdown signal received')
  server.close(() => {
    logger.info('server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
