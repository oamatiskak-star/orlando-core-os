import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const minScore = parseInt(sp.get('min_score') ?? '0', 10)
  const pattern  = sp.get('pattern')
  const limit    = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('hook_library')
    .select('*, source_content:media_holding_content_items!source_content_id(id, title, status)')
    .order('success_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (minScore > 0) q = q.gte('success_score', minScore)
  if (pattern)      q = q.eq('pacing', pattern)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ hooks: data ?? [] })
}
