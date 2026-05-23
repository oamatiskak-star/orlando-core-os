import type { Request, Response, NextFunction } from 'express'
import { env } from '../lib/secrets'

export function requireTriggerSecret(req: Request, res: Response, next: NextFunction): void {
  if (!env.RUN_TRIGGER_SECRET) {
    // Permissive in dev when no secret configured
    if (env.NODE_ENV !== 'production') {
      next()
      return
    }
    res.status(500).json({ error: 'RUN_TRIGGER_SECRET not configured' })
    return
  }
  const provided = req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '')
    ?? req.headers['x-cron-secret']?.toString()
  if (provided !== env.RUN_TRIGGER_SECRET) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}
