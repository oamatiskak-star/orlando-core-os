import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/permit-scan
// Schedule: 0 7 * * * (dagelijks 07:00)
// Vergunningaanvragen zonder relevantie-score bijwerken via PermitAI.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const { count: unscoredCount } = await admin
    .from('acq_permits')
    .select('*', { count: 'exact', head: true })
    .is('relevance_score', null)

  if (!unscoredCount || unscoredCount === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_unscored_permits', duration_ms: Date.now() - startedAt })
  }

  const { data: job, error } = await admin
    .from('acq_scan_jobs')
    .insert({
      agent_name: 'PermitAI',
      job_type:   'permit_scan',
      status:     'queued',
      payload:    { trigger: 'vercel-cron', unscored_count: unscoredCount },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const engineUrl = process.env.ACQUISITION_ENGINE_URL
  if (engineUrl) {
    fetch(`${engineUrl}/agents/permit-ai/run`, { method: 'POST' })
      .catch(() => { /* fire-and-forget */ })
  }

  await reportHeartbeat('cron.vercel.acquisition.permit-scan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: true, job_id: job.id, unscored: unscoredCount, duration_ms: Date.now() - startedAt })
}
