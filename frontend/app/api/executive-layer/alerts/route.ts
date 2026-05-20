import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const onlyUnack = req.nextUrl.searchParams.get('unacked') === 'true'
  const severity = req.nextUrl.searchParams.get('severity')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 200)

  let query = admin
    .from('executive_alerts')
    .select('id,alert_kind,severity,target_kind,target_id,title,message,payload,detected_at,acknowledged_at')
    .order('detected_at', { ascending: false })
    .limit(limit)
  if (onlyUnack) query = query.is('acknowledged_at', null)
  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: data ?? [] })
}
