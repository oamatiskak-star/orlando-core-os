import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { scanAndPersist } from '@/lib/flow-intelligence'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const report = await scanAndPersist(supabase)
    return NextResponse.json({ report })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET met dezelfde semantics als POST — handig voor manuele triggers
// vanaf de browser (geen CSRF want auth-gated). RSC blijft geweigerd.
export async function GET(request: NextRequest) {
  return POST(request)
}
