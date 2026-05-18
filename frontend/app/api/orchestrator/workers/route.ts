import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { listWorkers } from '@/lib/orchestrator/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workers = await listWorkers(supabase)
    const now = Date.now()
    const enriched = workers.map((w) => {
      const ageSec = (now - new Date(w.last_seen).getTime()) / 1000
      const health =
        ageSec <= 30 ? 'green' :
        ageSec <= 90 ? 'amber' :
                       'red'
      return { ...w, age_seconds: Math.round(ageSec), health }
    })
    return NextResponse.json({ workers: enriched })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
