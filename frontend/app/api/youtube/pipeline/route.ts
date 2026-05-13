import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()

  const [
    { data: channels },
    { data: queueStats },
    { data: recentActivity },
  ] = await Promise.all([
    admin.from('youtube_channels')
      .select('id, naam, oauth_status, token_expires, status, upload_quota_used'),

    admin.from('youtube_upload_queue')
      .select('channel_id, status')
      .in('status', ['queued', 'retrying', 'preparing', 'normalizing', 'uploading',
                     'uploaded_pending_processing', 'processing', 'verifying',
                     'verified_live', 'failed', 'manual_review_required', 'planned']),

    admin.from('youtube_upload_queue')
      .select('id, status, title, updated_at, youtube_video_id, last_error, youtube_channels(naam)')
      .not('status', 'eq', 'planned')
      .order('updated_at', { ascending: false })
      .limit(20),
  ])

  // Per-channel stats
  const perChannel = (channels ?? []).map(ch => {
    const chQ = (queueStats ?? []).filter(q => q.channel_id === ch.id)
    return {
      ...ch,
      queue: {
        planned:    chQ.filter(q => q.status === 'planned').length,
        queued:     chQ.filter(q => ['queued','retrying','preparing','normalizing'].includes(q.status)).length,
        uploading:  chQ.filter(q => ['uploading','uploaded_pending_processing','processing','verifying'].includes(q.status)).length,
        live:       chQ.filter(q => q.status === 'verified_live').length,
        failed:     chQ.filter(q => ['failed','manual_review_required'].includes(q.status)).length,
      },
    }
  })

  // Global pipeline stats
  const all = queueStats ?? []
  const pipeline = {
    planned:   all.filter(q => q.status === 'planned').length,
    queued:    all.filter(q => ['queued','retrying','preparing','normalizing'].includes(q.status)).length,
    uploading: all.filter(q => ['uploading','uploaded_pending_processing','processing','verifying'].includes(q.status)).length,
    live:      all.filter(q => q.status === 'verified_live').length,
    failed:    all.filter(q => ['failed','manual_review_required'].includes(q.status)).length,
  }

  return NextResponse.json({ channels: perChannel, pipeline, recentActivity })
}
