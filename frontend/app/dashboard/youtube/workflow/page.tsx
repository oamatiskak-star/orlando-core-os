import { createAdminClient } from '@/lib/supabase/admin'
import WorkflowClient from './WorkflowClient'

export default async function WorkflowPage() {
  const admin = createAdminClient()

  const [
    { data: channels },
    { data: allQueue },
    { data: allVideos },
    { data: recentQueue },
  ] = await Promise.all([
    admin.from('youtube_channels')
      .select('id, naam, oauth_status, token_expires, status, upload_quota_used, refresh_token, access_token'),

    admin.from('youtube_upload_queue')
      .select('channel_id, status, video_id, scheduled_publish_at'),

    admin.from('youtube_videos')
      .select('channel_id, status, file_path'),

    admin.from('youtube_upload_queue')
      .select('id, status, title, updated_at, youtube_video_id, last_error, channel_id, youtube_channels(naam)')
      .not('status', 'eq', 'planned')
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  // Per-channel breakdown
  const channelData = (channels ?? []).map(ch => {
    const q  = (allQueue  ?? []).filter(x => x.channel_id === ch.id)
    const v  = (allVideos ?? []).filter(x => x.channel_id === ch.id)
    const tokenOk = ch.token_expires ? new Date(ch.token_expires) > new Date(Date.now() + 2 * 60_000) : false
    return {
      id:           ch.id,
      naam:         ch.naam,
      oauthStatus:  ch.oauth_status,
      tokenOk,
      tokenExpires: ch.token_expires,
      quotaUsed:    ch.upload_quota_used ?? 0,
      hasRefreshToken: !!ch.refresh_token,
      queue: {
        planned:   q.filter(x => x.status === 'planned').length,
        queued:    q.filter(x => ['queued','retrying','preparing','normalizing'].includes(x.status)).length,
        uploading: q.filter(x => ['uploading','uploaded_pending_processing','processing','verifying'].includes(x.status)).length,
        live:      q.filter(x => x.status === 'verified_live').length,
        failed:    q.filter(x => ['failed','manual_review_required'].includes(x.status)).length,
      },
      videos: {
        productie: v.filter(x => x.status === 'queued' && x.file_path).length,
        scheduled: v.filter(x => x.status === 'scheduled').length,
        published: v.filter(x => x.status === 'published').length,
        failed:    v.filter(x => x.status === 'failed').length,
      },
    }
  })

  // Global pipeline totals
  const aq = allQueue ?? []
  const av = allVideos ?? []
  const pipeline = {
    productie: av.filter(x => x.status === 'queued' && x.file_path).length,
    planned:   aq.filter(x => x.status === 'planned').length,
    queued:    aq.filter(x => ['queued','retrying','preparing','normalizing'].includes(x.status)).length,
    uploading: aq.filter(x => ['uploading','uploaded_pending_processing','processing','verifying'].includes(x.status)).length,
    live:      aq.filter(x => x.status === 'verified_live').length,
    failed:    aq.filter(x => ['failed','manual_review_required'].includes(x.status)).length,
    published: av.filter(x => x.status === 'published').length,
  }

  return (
    <WorkflowClient
      channelData={channelData}
      pipeline={pipeline}
      recentQueue={(recentQueue ?? []) as any[]}
    />
  )
}
