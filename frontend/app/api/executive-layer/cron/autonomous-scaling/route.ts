import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAllAutopilotLinks } from '@/lib/executive-layer/autopilot-links'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const results = await runAllAutopilotLinks(admin)
  const total = results.reduce((s, r) => s + r.triggered, 0)
  await reportHeartbeat('cron.vercel.executive.scaling').catch(() => {}) /* watchdog-heartbeat */
  return NextResponse.json({ links: results, total_triggered: total, ms: Date.now() - startedAt })
}
