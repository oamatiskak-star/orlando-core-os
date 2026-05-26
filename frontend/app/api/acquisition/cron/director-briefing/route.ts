import { NextRequest, NextResponse } from 'next/server'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 120

// Vercel cron — /api/acquisition/cron/director-briefing
// Schedule: 30 7 * * * (dagelijks 07:30)
// Triggert AcquisitionDirectorAI dagelijkse briefing via Render engine.
// Als ACQUISITION_ENGINE_URL niet gezet is: no-op.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const engineUrl = process.env.ACQUISITION_ENGINE_URL
  if (!engineUrl) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'ACQUISITION_ENGINE_URL not set' })
  }

  const res = await fetch(`${engineUrl}/agents/director/run`, { method: 'POST' })
    .catch(err => ({ ok: false, status: 0, json: async () => ({ error: (err as Error).message }) }))

  const body = await res.json().catch(() => ({}))

  await reportHeartbeat('cron.vercel.acquisition.director-briefing').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: res.ok, engine_response: body })
}
