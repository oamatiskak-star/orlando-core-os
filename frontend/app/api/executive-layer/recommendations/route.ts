import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 200)

  const { data, error } = await admin
    .from('executive_recommendations')
    .select('id,report_id,action_kind,target_kind,target_id,priority,rationale,payload,status,executed_at,created_at')
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recommendations: data ?? [] })
}
