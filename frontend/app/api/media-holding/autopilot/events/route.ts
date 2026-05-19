import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const linkKey = sp.get('link_key')
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('autopilot_events')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(limit)
  if (linkKey) q = q.eq('link_key', linkKey)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const byLink = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.link_key] = (acc[r.link_key] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    events: rows,
    totals: {
      total: rows.length,
      by_link: byLink,
    },
  })
}
