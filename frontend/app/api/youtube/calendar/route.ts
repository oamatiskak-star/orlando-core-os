import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  let query = admin
    .from('yt_content_calendar')
    .select('id, channel_id, week_start, publish_date, day_index, video_type, video_type_detail, title, seo_title, hook_script, thumbnail_concept, cta, status, error_message, youtube_video_id, storage_path, created_at, updated_at, youtube_channels(naam)')
    .order('publish_date', { ascending: true })
    .limit(limit)

  if (channelId) {
    query = query.eq('channel_id', channelId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [], total: data?.length ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const admin = createAdminClient()
  const { id, status } = await req.json()

  if (!id || !status) {
    return NextResponse.json({ error: 'id en status vereist' }, { status: 400 })
  }

  const allowed = ['planned', 'scripting', 'recorded', 'editing', 'scheduled', 'published', 'failed', 'skipped']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: `Ongeldig status: ${status}` }, { status: 400 })
  }

  const { error } = await admin
    .from('yt_content_calendar')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
