import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { hasStripeKey } from '../lib/secrets'

const router = Router()

router.get('/health', async (_req, res) => {
  let dbOk = false
  try {
    const { error } = await supabase.from('aquier_audit_runs').select('id').limit(1)
    dbOk = !error
  } catch { /* dbOk stays false */ }

  res.json({
    ok: dbOk,
    service: 'checkout-auditor',
    version: '1.0.0',
    db: dbOk,
    stripe_configured: hasStripeKey(),
    now: new Date().toISOString(),
  })
})

export default router
