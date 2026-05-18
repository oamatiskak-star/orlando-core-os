import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { listUnresolvedEvents, recentErrors, systemState } from '@/lib/orchestrator/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = request.nextUrl.searchParams.get('company_id') ?? undefined

  try {
    const [counters, failures, events] = await Promise.all([
      systemState(supabase, company),
      recentErrors(supabase, 10),
      listUnresolvedEvents(supabase, 10),
    ])
    return NextResponse.json({ counters, failures, events })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
