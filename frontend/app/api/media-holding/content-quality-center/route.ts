import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Content Factory 2.0 — Content Quality Center (read-only).
// Reads the video_project_gate_status view: latest score per project + the
// Content Impact Score + upload eligibility + block reason. Single source of
// truth shared with the upload-protection gate in youtube-engine.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const category = sp.get('category')
  const limit    = Math.min(500, parseInt(sp.get('limit') ?? '200', 10))

  let q = supabase
    .from('video_project_gate_status')
    .select('*')
    .order('content_impact_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (category) q = q.eq('content_category', category)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data ?? [] })
}
