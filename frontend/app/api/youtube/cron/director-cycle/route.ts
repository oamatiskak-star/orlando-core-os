import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// S5 — Director (data-driven, credit-vrij). Genereert kanaal-beslissingen
// (scale_up/maintain/reduce/stop) uit de kanaal-ranking en schrijft een
// director_cycles plan-rij (zonder de kapotte LLM-plan-call). ?period=weekly|monthly.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const period = req.nextUrl.searchParams.get('period') ?? 'weekly'
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('generate_director_decisions', { p_period: period })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await reportHeartbeat('cron.vercel.director-cycle').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: true, period, result: data ?? null })
}
