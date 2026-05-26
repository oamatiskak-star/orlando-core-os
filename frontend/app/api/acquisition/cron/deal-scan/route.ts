import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/deal-scan
// Schedule: 0 */6 * * * (elke 6 uur)
// Beveiligd via Bearer CRON_SECRET.
//
// Maakt scan_jobs aan voor DealHunter (scoren unscored radar-deals).
// Triggert ook de Render acquisition-engine via webhook als ACQUISITION_ENGINE_URL is gezet.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Tel ongescoorde deals
  const { count: unscoredCount } = await admin
    .from('acq_deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'actief')
    .eq('pipeline_stage', 'radar')
    .is('ai_score', null)

  if (!unscoredCount || unscoredCount === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_unscored_deals', duration_ms: Date.now() - startedAt })
  }

  // Maak scan job aan
  const { data: job, error } = await admin
    .from('acq_scan_jobs')
    .insert({
      agent_name: 'DealHunter',
      job_type:   'deal_scan',
      status:     'queued',
      payload:    { trigger: 'vercel-cron', unscored_count: unscoredCount },
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Optioneel: trigger Render engine direct
  const engineUrl = process.env.ACQUISITION_ENGINE_URL
  if (engineUrl) {
    fetch(`${engineUrl}/agents/deal-hunter/run`, { method: 'POST' })
      .catch(() => { /* fire-and-forget */ })
  }

  await reportHeartbeat('cron.vercel.acquisition.deal-scan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok:           true,
    job_id:       job.id,
    unscored:     unscoredCount,
    duration_ms:  Date.now() - startedAt,
  })
}
