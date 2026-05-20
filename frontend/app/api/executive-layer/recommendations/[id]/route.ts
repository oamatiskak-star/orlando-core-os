import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'dismissed', 'executed', 'expired'])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { status?: string; executed_by?: string }
  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status: body.status }
  if (body.status === 'executed') {
    update.executed_at = new Date().toISOString()
    update.executed_by = body.executed_by ?? 'manual'
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('executive_recommendations')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recommendation: data })
}
