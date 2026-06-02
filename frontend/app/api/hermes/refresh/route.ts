import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Volledige Hermes-hercheck vanaf het dashboard:
//  1. hermes_full_recheck() — supervisor + opschoning (stale alarmen/incidenten,
//     stale workers) en retourneert wat is opgeschoond.
//  2. triggert de watchdog-fleetcheck (orlando-watchdog /check-now) zodat ook de
//     Render-services + org-checks vers ge-evalueerd worden (fire-and-forget).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('hermes_full_recheck')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fris ook de watchdog-fleetcheck (best-effort, blokkeert de response niet lang).
  const watchdogUrl = process.env.WATCHDOG_URL ?? 'https://orlando-watchdog.onrender.com'
  try {
    await fetch(`${watchdogUrl}/check-now`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // watchdog draait sowieso elke 60s; niet fataal voor de hercheck
  }

  const r = (data ?? {}) as { alerts_resolved?: number; incidents_resolved?: number; workers_reset?: number }
  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    alerts_resolved: r.alerts_resolved ?? 0,
    incidents_resolved: r.incidents_resolved ?? 0,
    workers_reset: r.workers_reset ?? 0,
  })
}
