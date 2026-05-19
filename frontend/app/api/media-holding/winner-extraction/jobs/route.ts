import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const sourceContentId = sp.get('source_content_id')
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '200', 10))

  let q = supabase
    .from('winner_extraction_jobs')
    .select('*, source_content:media_holding_content_items!source_content_id(id, title, kind, output_url), output_content:media_holding_content_items!output_content_id(id, title, status, output_url)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sourceContentId) q = q.eq('source_content_id', sourceContentId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}
