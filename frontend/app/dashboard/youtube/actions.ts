'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function queueVideoUpload(formData: FormData) {
  const supabase = await createClient()

  const channelId = formData.get('channel_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const filePath = formData.get('file_path') as string
  const thumbnailPath = (formData.get('thumbnail_path') as string) || null
  const privacyStatus = (formData.get('privacy_status') as string) || 'private'
  const scheduledAt = (formData.get('scheduled_publish_at') as string) || null
  const tagsRaw = (formData.get('tags') as string) || ''
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
  const categoryId = (formData.get('category_id') as string) || '22'

  const { data: video, error: videoErr } = await supabase
    .from('youtube_videos')
    .insert({
      channel_id: channelId,
      video_id: `pending_${crypto.randomUUID()}`,
      title,
      description,
      tags,
      category_id: categoryId,
      privacy_status: privacyStatus,
      scheduled_publish_at: scheduledAt || null,
      thumbnail_path: thumbnailPath,
      file_path: filePath,
      status: 'queued',
    })
    .select('id')
    .single()

  if (videoErr || !video) throw new Error(videoErr?.message ?? 'Video insert failed')

  const { error: queueErr } = await supabase.from('youtube_upload_queue').insert({
    video_id: video.id,
    channel_id: channelId,
    status: 'queued',
    scheduled_publish_at: scheduledAt || null,
    max_retries: 5,
  })

  if (queueErr) throw new Error(queueErr.message)

  revalidatePath('/dashboard/youtube')
}

export async function retryQueueItem(queueId: string) {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').update({
    status: 'queued',
    retry_count: 0,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)
  revalidatePath('/dashboard/youtube')
}

export async function retryAllFailed() {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').update({
    status: 'queued',
    retry_count: 0,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).in('status', ['failed', 'manual_review_required'])
  revalidatePath('/dashboard/youtube')
}

export async function cancelQueueItem(queueId: string) {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').update({
    status: 'failed',
    last_error: 'Handmatig geannuleerd',
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)
  revalidatePath('/dashboard/youtube')
}

export async function deleteQueueItem(queueId: string) {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').delete().eq('id', queueId)
  revalidatePath('/dashboard/youtube')
}

// ── Mission Control actions ───────────────────────────────────────────────────

export async function forcePublishQueue(queueId: string, videoId?: string) {
  const supabase = await createClient()
  if (videoId) {
    await supabase.from('youtube_videos').update({
      privacy_status: 'public',
      upload_status:  'uploaded',
      updated_at:     new Date().toISOString(),
    }).eq('id', videoId)
  }
  await supabase.from('youtube_upload_queue').update({
    status:     'verified_live',
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)
  await supabase.from('media_audit_log').insert({
    queue_id: queueId,
    video_id: videoId ?? null,
    action:   'force_publish',
    status:   'info',
    message:  'Force publish via server action',
  })
  revalidatePath('/dashboard/youtube/mission-control')
}

export async function pauseChannel(channelId: string) {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').update({
    status:     'paused',
    updated_at: new Date().toISOString(),
  }).eq('channel_id', channelId).in('status', ['queued', 'preparing'])
  await supabase.from('media_audit_log').insert({
    channel_id: channelId,
    action:     'pause_channel',
    status:     'warning',
    message:    'Channel paused via server action',
  })
  revalidatePath('/dashboard/youtube/mission-control')
}

export async function reverifyQueueItem(queueId: string) {
  const supabase = await createClient()
  await supabase.from('youtube_upload_queue').update({
    status:     'verifying',
    updated_at: new Date().toISOString(),
  }).eq('id', queueId)
  await supabase.from('media_audit_log').insert({
    queue_id: queueId,
    action:   'reverify',
    status:   'info',
    message:  'Manual reverify triggered',
  })
  revalidatePath('/dashboard/youtube/mission-control')
}

export async function registerMediaAsset(data: {
  channel_id:    string
  channel_name:  string
  title:         string
  topic?:        string
  video_type:    string
  video_path?:   string
  audio_path?:   string
  storage_url?:  string
  storage_path?: string
  local_worker?: string
  agent_task_id?: string
  calendar_id?:   string
  publish_date?:  string
}) {
  const supabase = await createClient()
  const { data: media } = await supabase.from('generated_media').insert({
    ...data,
    render_status: 'pending',
    upload_status: 'pending',
    verification_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select('id').single()
  return media?.id
}
