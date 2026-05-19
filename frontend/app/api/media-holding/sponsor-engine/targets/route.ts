import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const channelId = sp.get('channel_id')
  const status = sp.get('status')
  const minFit = parseInt(sp.get('min_fit') ?? '0', 10)
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('sponsor_engine_targets')
    .select('*, channel:media_holding_channels(id, name)')
    .order('fit_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (channelId) q = q.eq('channel_id', channelId)
  if (status)    q = q.eq('status', status)
  if (minFit > 0) q = q.gte('fit_score', minFit)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data ?? [] })
}
