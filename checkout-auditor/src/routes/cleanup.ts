import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { deleteArtifact } from '../lib/storage'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'
import { requireTriggerSecret } from './auth'

const router = Router()

router.post('/cleanup', requireTriggerSecret, async (_req, res) => {
  const cutoff = new Date(Date.now() - env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('aquier_audit_artifacts')
    .select('id, storage_path')
    .lt('captured_at', cutoff)
    .limit(1000)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  let deleted = 0
  for (const row of data ?? []) {
    await deleteArtifact(row.storage_path).catch(err => logger.warn({ err: String(err) }, 'artifact delete error'))
    await supabase.from('aquier_audit_artifacts').delete().eq('id', row.id)
    deleted++
  }

  res.json({ ok: true, deleted, cutoff })
})

export default router
