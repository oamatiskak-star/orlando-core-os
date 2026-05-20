import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

const ALLOWED_STATUSES = new Set(['proposed', 'active', 'closed', 'overspent'])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as {
    allocated_eur?: number
    status?: string
    rationale?: string
  }
  const update: Record<string, unknown> = {}
  if (typeof body.allocated_eur === 'number' && body.allocated_eur >= 0) update.allocated_eur = body.allocated_eur
  if (body.status && ALLOWED_STATUSES.has(body.status)) update.status = body.status
  if (typeof body.rationale === 'string') update.rationale = body.rationale
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_fund_allocations')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ allocation: data })
}
