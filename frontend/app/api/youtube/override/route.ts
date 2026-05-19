import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

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
      // Set scheduled_publish_at to NOW so orchestrator picks it up in next 30s poll
      const now = new Date().toISOString()
      await supabase.from('youtube_upload_queue').update({
        status:               'queued',
        retry_count:          0,
        last_error:           null,
        priority:             10,
        scheduled_publish_at: now,
        updated_at:           now,
      }).eq('id', queue_id)
      await log('Manual upload_now triggered — rescheduled to now', 'info', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'retry': {
      if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 })
      const now = new Date().toISOString()
      await supabase.from('youtube_upload_queue').update({
        status:               'queued',
        retry_count:          0,
        last_error:           null,
        priority:             8,
        scheduled_publish_at: now,
        updated_at:           now,
      }).eq('id', queue_id)
      await log('Manual retry triggered — rescheduled to now', 'info', { queue_id })
      return NextResponse.json({ ok: true })
    }

    case 'push_all': {
      // Push all queued/failed/paused/planned items to upload now
      const now = new Date().toISOString()
      const statuses = ['queued', 'failed', 'paused', 'manual_review_required']
      if (channel_id) {
        await supabase.from('youtube_upload_queue').update({
          status:               'queued',
          retry_count:          0,
          last_error:           null,
          priority:             9,
          scheduled_publish_at: now,
          updated_at:           now,
        }).eq('channel_id', channel_id).in('status', statuses)
      } else {
        await supabase.from('youtube_upload_queue').update({
          status:               'queued',
          retry_count:          0,
          last_error:           null,
          priority:             9,
          scheduled_publish_at: now,
          updated_at:           now,
        }).in('status', statuses)
      }
      await log('Bulk push_all triggered', 'info', { channel_id: channel_id ?? 'all' })
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

      // Fetch queue entry → youtube_video_id + channel credentials
      const { data: qEntry } = await supabase
        .from('youtube_upload_queue')
        .select('youtube_video_id, channel_id, video_id')
        .eq('id', queue_id).single()

      if (!qEntry?.youtube_video_id) {
        return NextResponse.json({ error: 'No youtube_video_id on queue entry' }, { status: 422 })
      }

      const { data: channel } = await supabase
        .from('youtube_channels')
        .select('refresh_token, access_token, token_expires, oauth_client_id, oauth_client_secret')
        .eq('id', qEntry.channel_id).single()

      if (!channel?.refresh_token) {
        return NextResponse.json({ error: 'Channel has no OAuth credentials' }, { status: 422 })
      }

      // Build OAuth2 client and set video public via YouTube API
      const clientId     = channel.oauth_client_id     ?? process.env.YOUTUBE_OAUTH_CLIENT_ID!
      const clientSecret = channel.oauth_client_secret ?? process.env.YOUTUBE_OAUTH_CLIENT_SECRET!
      const redirectUri  = process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? 'https://dashboard.strkbeheer.nl/api/youtube/oauth/callback'

      const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      oauth2.setCredentials({
        access_token:  channel.access_token ?? undefined,
        refresh_token: channel.refresh_token,
        expiry_date:   channel.token_expires ? new Date(channel.token_expires).getTime() : undefined,
      })

      const yt = google.youtube({ version: 'v3', auth: oauth2 })
      await yt.videos.update({
        part: ['status'],
        requestBody: {
          id:     qEntry.youtube_video_id,
          status: { privacyStatus: 'public' },
        },
      })

      // Update Supabase records
      const resolvedVideoId = qEntry.video_id ?? video_id
      if (resolvedVideoId) {
        await supabase.from('youtube_videos').update({
          privacy_status: 'public',
          status:         'live',
          updated_at:     new Date().toISOString(),
        }).eq('id', resolvedVideoId)
      }
      await supabase.from('youtube_upload_queue').update({
        status:     'verified_live',
        updated_at: new Date().toISOString(),
      }).eq('id', queue_id)

      await log('Force publish — video set public via YouTube API', 'info', {
        queue_id, youtube_video_id: qEntry.youtube_video_id,
      })

      // Direct dedup controle na live-setting
      try {
        const base = process.env.NEXT_PUBLIC_APP_URL
        const dr = await fetch(`${base}/api/youtube/dedup`, { method: 'POST' })
        const dd = await dr.json().catch(() => ({}))
        if (dd.duplicates_found > 0) {
          console.warn(`[DEDUP] ${dd.duplicates_found} duplicaten na force-publish`, dd.results)
        }
      } catch { /* dedup is niet-blokkerend */ }

      return NextResponse.json({ ok: true, youtube_video_id: qEntry.youtube_video_id })
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
