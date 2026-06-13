import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// S6 — Autonomous Growth Plan. Verdeelt productiecapaciteit over kanalen naar
// groeiscore (kanaal-prioritering) en bepaalt het prioriteitskanaal. Credit-vrij.
// ?capacity=<int> (default 50). Schedule via vercel.json.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const capacity = Number(req.nextUrl.searchParams.get('capacity') ?? '50') || 50
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('generate_growth_plan', { p_total_capacity: capacity, p_period: 'weekly' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

 feat/cf2-stronger-model-track
  await reportHeartbeat('cron.vercel.growth-plan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: true, result: data ?? null })
=======
  // Sprint A — brug Growth Engine -> Producer: zet de capaciteitsallocatie direct om
  // naar cf2_jobs (planned), zodat Hermes' schaalbesluiten autonoom productie triggeren.
  // Credit-vrij + idempotent (top-up tot videos_per_day per kanaal/dag). De CF2-producer
  // (engine: content:cf2-video-projects-runner) maakt vervolgens de creatie.
  const seeded = await admin.rpc('cf2_seed_jobs_from_growth', { p_period: 'weekly' })

  await reportHeartbeat('cron.vercel.growth-plan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok: true,
    result: data ?? null,
    jobs_seeded_from_growth: seeded.error ? `error: ${seeded.error.message}` : (seeded.data ?? 0),
  })
 main
}
