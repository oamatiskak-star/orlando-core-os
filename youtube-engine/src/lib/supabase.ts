import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _client
}

export type QueueStatus =
  | 'queued' | 'preparing' | 'normalizing' | 'uploading'
  | 'uploaded_pending_processing' | 'processing' | 'verifying'
  | 'verified_live' | 'failed' | 'retrying' | 'manual_review_required'

export interface QueueEntry {
  id: string
  video_id: string
  channel_id: string
  status: QueueStatus
  scheduled_publish_at: string | null
  upload_started_at: string | null
  upload_finished_at: string | null
  verification_started_at: string | null
  verification_finished_at: string | null
  retry_count: number
  max_retries: number
  last_error: string | null
  youtube_video_id: string | null
  youtube_url: string | null
  worker_id: string | null
  priority: number
  created_at: string
  updated_at: string
}

export interface VideoRecord {
  id: string
  channel_id: string
  youtube_video_id: string | null
  title: string
  description: string | null
  tags: string[] | null
  category_id: string
  privacy_status: 'private' | 'unlisted' | 'public'
  scheduled_publish_at: string | null
  made_for_kids: boolean
  thumbnail_path: string | null
  file_path: string | null
  file_size_bytes: number | null
  duration_seconds: number | null
  normalized_path: string | null
  status: string
}

export interface ChannelRecord {
  id: string
  naam: string
  channel_id: string
  handle: string | null
  oauth_client_id: string | null
  oauth_client_secret: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires: string | null
  oauth_status: string | null
  upload_quota_used: number
  status: string
}

export async function updateQueueStatus(
  queueId: string,
  status: QueueStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const db = getSupabase()
  await db.from('youtube_upload_queue').update({
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  }).eq('id', queueId)
}

export async function addLog(
  queueId: string,
  videoId: string,
  level: 'info' | 'warn' | 'error' | 'success' | 'debug',
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const db = getSupabase()
  await db.from('youtube_upload_logs').insert({
    queue_id: queueId,
    video_id: videoId,
    level,
    message,
    metadata,
  })
}

export async function recordFailure(
  queueId: string,
  videoId: string,
  failureType: string,
  detail: string,
  copyrightStatus?: string
): Promise<string> {
  const db = getSupabase()
  const { data } = await db.from('youtube_upload_failures').insert({
    queue_id: queueId,
    video_id: videoId,
    failure_type: failureType,
    failure_detail: detail,
    copyright_status: copyrightStatus ?? null,
  }).select('id').single()
  return data?.id ?? ''
}

export async function recordProcessingEvent(
  queueId: string,
  youtubeVideoId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  const db = getSupabase()
  await db.from('youtube_processing_events').insert({
    queue_id: queueId,
    youtube_video_id: youtubeVideoId,
    event_type: eventType,
    event_data: eventData,
    upload_status: (eventData.uploadStatus as string) ?? null,
    processing_status: (eventData.processingStatus as string) ?? null,
    privacy_status: (eventData.privacyStatus as string) ?? null,
    embeddable: (eventData.embeddable as boolean) ?? null,
    thumbnail_exists: (eventData.thumbnailExists as boolean) ?? null,
  })
}
