import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (typeof body.success_score === 'number') {
    update.success_score = Math.max(0, Math.min(100, Math.round(body.success_score)))
  }
  if (typeof body.replay_friendly === 'boolean') update.replay_friendly = body.replay_friendly
  if (typeof body.pacing === 'string') update.pacing = body.pacing
  if (typeof body.hook_text === 'string') update.hook_text = body.hook_text

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'geen velden om te updaten' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hook_library')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ hook: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await supabase.from('hook_library').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
