import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { action, queue_id, video_id, channel_id, target_id } = await req.json()

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  const supabase = await createClient()

  async function log(msg: string, status = 'info', meta = {}) {
    await supabase.from('media_audit_log').insert({
      queue_id, video_id, channel_id,
      action, status,
      message: msg,
      metadata: { ...meta, triggered_at: new Date().toISOString() },
    })
  }

  switch (action) {

    case 'upload_now': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      await supabase.from('youtube_upload_queue').update({
        status:      'queued',
        retry_count: 0,
        last_error:  null,
        updated_at:  new Date().toISOString(),
      }).eq('id', queue_id)
      await log('Manual upload_now triggered', 'info', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'retry': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      await supabase.from('youtube_upload_queue').update({
        status:      'queued',
        retry_count: 0,
        last_error:  null,
        updated_at:  new Date().toISOString(),
      }).eq('id', queue_id)
      await log('Manual retry triggered', 'info', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'reverify': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      await supabase.from('youtube_upload_queue').update({
        status:     'verifying',
        updated_at: new Date().toISOString(),
      }).eq('id', queue_id)
      await log('Manual reverify triggered', 'info', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'force_publish': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      if (video_id) {
        await supabase.from('youtube_videos').update({
          privacy_status: 'public',
          upload_status:  'uploaded',
          updated_at:     new Date().toISOString(),
        }).eq('id', video_id)
      }
      await supabase.from('youtube_upload_queue').update({
        status:     'verified_live',
        updated_at: new Date().toISOString(),
      }).eq('id', queue_id)
      await log('Force publish override applied', 'info', { queue_id, video_id })
      return NextResponse.json({ ok: true })
    }

    case 'pause_channel': {
      if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
      await supabase.from('youtube_channels').update({
        status:     'paused',
        updated_at: new Date().toISOString(),
      }).eq('id', channel_id)
      await supabase.from('youtube_upload_queue').update({
        status:     'paused',
        updated_at: new Date().toISOString(),
      }).eq('channel_id', channel_id).in('status', ['queued', 'preparing'])
      await log('Channel paused manually', 'warning', { channel_id })
      return NextResponse.json({ ok: true })
    }

    case 'resume_channel': {
      if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
      await supabase.from('youtube_channels').update({
        status:     'active',
        updated_at: new Date().toISOString(),
      }).eq('id', channel_id)
      await supabase.from('youtube_upload_queue').update({
        status:     'queued',
        updated_at: new Date().toISOString(),
      }).eq('channel_id', channel_id).eq('status', 'paused')
      await log('Channel resumed manually', 'info', { channel_id })
      return NextResponse.json({ ok: true })
    }

    case 'sync_channel': {
      if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
      await supabase.from('youtube_channels').update({
        updated_at: new Date().toISOString(),
      }).eq('id', channel_id)
      await log('Channel sync triggered', 'info', { channel_id })
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      await supabase.from('youtube_upload_queue').update({
        status:     'failed',
        last_error: 'Handmatig geannuleerd',
        updated_at: new Date().toISOString(),
      }).eq('id', queue_id)
      await log('Queue item cancelled manually', 'warning', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'regenerate_thumbnail': {
      if (!video_id) return NextResponse.json({ error: 'video_id required' }, { status: 400 })
      await supabase.from('youtube_videos').update({
        thumbnail_path: null,
        updated_at:     new Date().toISOString(),
      }).eq('id', video_id)
      await log('Thumbnail regeneration queued', 'info', { video_id })
      return NextResponse.json({ ok: true })
    }

    case 'move_queue': {
      if (!queue_id || !target_id) return NextResponse.json({ error: 'queue_id and target_id required' }, { status: 400 })
      await supabase.from('youtube_upload_queue').update({
        priority:   10,
        updated_at: new Date().toISOString(),
      }).eq('id', target_id)
      await log('Queue priority elevated', 'info', { queue_id, target_id })
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  }
}
