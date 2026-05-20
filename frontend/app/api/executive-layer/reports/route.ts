import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const kind = req.nextUrl.searchParams.get('kind')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100)

  let query = admin
    .from('executive_reports')
    .select('id,report_kind,period_start,period_end,title,summary_md,generated_by_agent,generated_at,scope')
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (kind) query = query.eq('report_kind', kind)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
