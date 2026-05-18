import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardRscFetch } from '@/lib/orchestrator/rsc-guard'
import { submitEscalationResponse } from '@/lib/orchestrator/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardRscFetch(request)
  if (blocked) return blocked

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  let body: { response?: Record<string, unknown>; answer?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body moet geldige JSON zijn' }, { status: 400 })
  }

  const response = body.response ?? (body.answer ? { answer: body.answer } : null)
  if (!response) {
    return NextResponse.json({ error: 'response of answer is verplicht' }, { status: 400 })
  }

  try {
    const task = await submitEscalationResponse(supabase, id, {
      ...response,
      _responded_by: user.id,
      _responded_at: new Date().toISOString(),
    })
    return NextResponse.json({ task })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
