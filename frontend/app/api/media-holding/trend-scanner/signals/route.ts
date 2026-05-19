import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const source = sp.get('source')
  const region = sp.get('region')
  const minMomentum = parseInt(sp.get('min_momentum') ?? '0', 10)
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('trend_scanner_signals')
    .select('*')
    .order('captured_at', { ascending: false })
    .order('momentum', { ascending: false })
    .limit(limit)

  if (source) q = q.eq('source', source)
  if (region) q = q.eq('region', region)
  if (minMomentum > 0) q = q.gte('momentum', minMomentum)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ signals: data ?? [] })
}
