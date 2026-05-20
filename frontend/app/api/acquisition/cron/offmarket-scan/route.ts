import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/offmarket-scan
// Schedule: 0 8 * * * (dagelijks 08:00)
// Nieuwe off-market leads zonder dev_scenario doorsturen naar OffMarketAI.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const { count: newLeads } = await admin
    .from('acq_offmarket_leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'nieuw')
    .is('dev_scenario', null)

  if (!newLeads || newLeads === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_new_leads', duration_ms: Date.now() - startedAt })
  }

  const { data: job, error } = await admin
    .from('acq_scan_jobs')
    .insert({
      agent_name: 'OffMarketAI',
      job_type:   'offmarket_scan',
      status:     'queued',
      payload:    { trigger: 'vercel-cron', new_leads: newLeads },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const engineUrl = process.env.ACQUISITION_ENGINE_URL
  if (engineUrl) {
    fetch(`${engineUrl}/agents/offmarket-ai/run`, { method: 'POST' })
      .catch(() => { /* fire-and-forget */ })
  }

  return NextResponse.json({ ok: true, job_id: job.id, new_leads: newLeads, duration_ms: Date.now() - startedAt })
}
