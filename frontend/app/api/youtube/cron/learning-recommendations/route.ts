import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// S2 — Learning loop. Genereert content_strategy_recommendations uit de live
// pattern-views (v_hook_patterns → winner/loser-winrate per niche×categorie).
// Draait autonoom op Vercel-cron; geen local-agent nodig. Schedule via vercel.json.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('generate_content_strategy_recommendations')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await reportHeartbeat('cron.vercel.learning-recommendations').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: true, recommendations_generated: data ?? 0 })
}
