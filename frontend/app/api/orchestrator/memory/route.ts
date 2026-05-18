import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { listMemory, upsertMemory } from '@/lib/orchestrator/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = request.nextUrl.searchParams.get('scope') ?? undefined

  try {
    const entries = await listMemory(supabase, scope)
    return NextResponse.json({ entries })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { scope?: string; key?: string; value?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body moet geldige JSON zijn' }, { status: 400 })
  }

  if (!body.key)              return NextResponse.json({ error: 'key is verplicht' }, { status: 400 })
  if (body.value === undefined) return NextResponse.json({ error: 'value is verplicht' }, { status: 400 })

  try {
    const entry = await upsertMemory(
      supabase,
      body.scope ?? 'global',
      body.key,
      body.value,
      user.email ?? user.id,
    )
    return NextResponse.json({ entry })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
