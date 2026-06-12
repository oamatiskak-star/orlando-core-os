import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// S3 — Winner Replication. Autonoom & credit-vrij: (1) bestaande 'selected' winner-
// variants naar de horizon draineren, (2) bewezen winners direct repliceren naar
// content_horizon + cf2_jobs (met cooldown-dedupe). De CF2-producer maakt de creatie.
// Schedule via vercel.json. Plant alleen jobs — geen upload/spend.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1) bestaande winner-variants (DNA, LLM-gegenereerd) → horizon
  const drained = await admin.rpc('cf2_seed_variants_to_horizon', { p_limit: 10 })
  if (drained.error) {
    return NextResponse.json({ error: `seed_variants: ${drained.error.message}` }, { status: 500 })
  }

  // 2) bewezen winners → horizon + cf2_jobs (seedt ook de zojuist gedrainde variants)
  const rep = await admin.rpc('replicate_winners', { p_max: 5, p_cooldown_days: 14 })
  if (rep.error) {
    return NextResponse.json({ error: `replicate_winners: ${rep.error.message}` }, { status: 500 })
  }

  await reportHeartbeat('cron.vercel.winner-replication').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok: true,
    variants_to_horizon: drained.data ?? 0,
    replication: rep.data ?? null,
  })
}
