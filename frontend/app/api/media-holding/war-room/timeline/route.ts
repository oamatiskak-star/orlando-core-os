import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Read-only Upload Timeline: geplande content (vandaag/morgen/...). Bron:
// yt_content_calendar (richt-planning + thumbnail-concept) + youtube_upload_queue
// (concrete scheduled uploads). Groeperen per dag gebeurt client-side.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = Math.min(14, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '5', 10)))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + days)
  const todayISO = today.toISOString().slice(0, 10)

  const [calRes, queueRes] = await Promise.all([
    supabase
      .from('yt_content_calendar')
      .select('id, channel_id, publish_date, title, thumbnail_concept, video_type, status, hook_script')
      .gte('publish_date', todayISO)
      .lt('publish_date', horizon.toISOString().slice(0, 10))
      .order('publish_date', { ascending: true })
      .limit(200),
    supabase
      .from('youtube_upload_queue')
      .select('id, channel_id, channel_name, title, status, scheduled_publish_at, viral_score')
      .gte('scheduled_publish_at', today.toISOString())
      .lt('scheduled_publish_at', horizon.toISOString())
      .order('scheduled_publish_at', { ascending: true })
      .limit(200),
  ])

  if (calRes.error) return NextResponse.json({ error: calRes.error.message }, { status: 500 })
  if (queueRes.error) return NextResponse.json({ error: queueRes.error.message }, { status: 500 })

  const calendar = (calRes.data ?? []).map((r) => ({
    id: `cal:${r.id}`,
    source: 'calendar' as const,
    date: r.publish_date,
    channel: r.channel_id,
    title: r.title,
    thumbnail_concept: r.thumbnail_concept,
    video_type: r.video_type,
    status: r.status,
    hook: r.hook_script,
  }))
  const queue = (queueRes.data ?? []).map((r) => ({
    id: `q:${r.id}`,
    source: 'queue' as const,
    date: r.scheduled_publish_at ? String(r.scheduled_publish_at).slice(0, 10) : null,
    channel: r.channel_name ?? r.channel_id,
    title: r.title,
    thumbnail_concept: null,
    video_type: null,
    status: r.status,
    hook: null,
    viral_score: r.viral_score,
  }))

  return NextResponse.json({ items: [...calendar, ...queue] })
}
