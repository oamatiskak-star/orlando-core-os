import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contentItemId } = await ctx.params

  const [item, samples] = await Promise.all([
    supabase
      .from('media_holding_content_items')
      .select('id, title, hook, duration_seconds, retention_analysis, retention_fetched_at, output_url')
      .eq('id', contentItemId)
      .single(),
    supabase
      .from('retention_lab_samples')
      .select('second_index, retention_pct, drop_off_marker')
      .eq('content_item_id', contentItemId)
      .order('second_index', { ascending: true }),
  ])

  if (item.error) return NextResponse.json({ error: item.error.message }, { status: 404 })

  return NextResponse.json({
    item: item.data,
    samples: samples.data ?? [],
  })
}
