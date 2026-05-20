import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const admin = createAdminClient()

  const { data: report, error } = await admin
    .from('executive_reports')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: recs } = await admin
    .from('executive_recommendations')
    .select('*')
    .eq('report_id', id)
    .order('priority', { ascending: false })

  return NextResponse.json({ report, recommendations: recs ?? [] })
}
