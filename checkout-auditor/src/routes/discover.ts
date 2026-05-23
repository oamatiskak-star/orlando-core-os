import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { runDiscovery } from '../discovery'
import { requireTriggerSecret } from './auth'

const router = Router()

router.post('/discover', requireTriggerSecret, async (req, res) => {
  const countryCodes = Array.isArray(req.body?.countries) ? req.body.countries : undefined

  const { data: runRow, error } = await supabase
    .from('aquier_audit_runs')
    .insert({ status: 'running', triggered_by: 'http_discovery', scope_filter: { country_codes: countryCodes ?? null, discovery_only: true } })
    .select('id')
    .single()
  if (error || !runRow) {
    res.status(500).json({ error: error?.message ?? 'run insert failed' })
    return
  }
  const runId = runRow.id as string

  // Fire and forget
  runDiscovery(runId, countryCodes)
    .then(async snaps => {
      await supabase
        .from('aquier_audit_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), totals: { discovery_snapshots: snaps.length } })
        .eq('id', runId)
    })
    .catch(async err => {
      await supabase
        .from('aquier_audit_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: String(err) })
        .eq('id', runId)
    })

  res.status(202).json({ accepted: true, run_id: runId, started_at: new Date().toISOString() })
})

export default router
