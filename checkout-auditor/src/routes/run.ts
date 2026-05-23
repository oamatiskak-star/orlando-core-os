import { Router } from 'express'
import { runAudit } from '../runner/audit-runner'
import { requireTriggerSecret } from './auth'
import { logger } from '../lib/logger'
import type { ScopeFilter } from '../types'

const router = Router()

router.post('/run', requireTriggerSecret, async (req, res) => {
  const scope: Partial<ScopeFilter> = (req.body && typeof req.body === 'object') ? req.body : {}

  // Fire-and-forget so HTTP returns immediately; long-running audit continues
  runAudit(scope, 'http').catch(err => {
    logger.error({ err: String(err) }, 'background audit failed')
  })

  res.status(202).json({ accepted: true, scope, started_at: new Date().toISOString() })
})

export default router
