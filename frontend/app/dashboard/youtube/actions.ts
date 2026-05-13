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
