import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// S7 — Affiliate orchestration. Genereert per-kanaal affiliate-aanbevelingen
// (mapping × registry) en detecteert ontbrekende externe activatiestappen → setup-agent
// queue. Credit-vrij; geen LLM. Schedule via vercel.json.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const recs = await admin.rpc('generate_affiliate_recommendations', { p_top: 3 })
  if (recs.error) return NextResponse.json({ error: `recommendations: ${recs.error.message}` }, { status: 500 })

  const setup = await admin.rpc('affiliate_setup_readiness')
  if (setup.error) return NextResponse.json({ error: `setup_readiness: ${setup.error.message}` }, { status: 500 })

  await reportHeartbeat('cron.vercel.affiliate-orchestration').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({ ok: true, recommendations: recs.data ?? 0, setup_actions: setup.data ?? 0 })
}
