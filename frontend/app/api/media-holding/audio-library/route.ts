import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const platform = sp.get('platform')
  const minVelocity = parseInt(sp.get('min_velocity') ?? '0', 10)
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('audio_library')
    .select('*')
    .order('trend_velocity', { ascending: false })
    .order('captured_at', { ascending: false })
    .limit(limit)

  if (platform) q = q.eq('platform', platform)
  if (minVelocity > 0) q = q.gte('trend_velocity', minVelocity)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tracks: data ?? [] })
}
