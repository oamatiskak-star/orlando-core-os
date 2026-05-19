import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const sourceId = sp.get('content_item_id')
  const lang = sp.get('lang')
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '200', 10))

  let q = supabase
    .from('language_expansion_targets')
    .select('*, source:media_holding_content_items!content_item_id(id, title, kind, channel_id), output:media_holding_content_items!output_content_id(id, title, status, output_url)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sourceId) q = q.eq('content_item_id', sourceId)
  if (lang)     q = q.eq('target_lang', lang)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const byLang = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.target_lang] = (acc[r.target_lang] ?? 0) + 1
    return acc
  }, {})
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    targets: rows,
    totals: {
      total: rows.length,
      by_lang: byLang,
      by_status: byStatus,
    },
  })
}
