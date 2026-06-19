import { google, youtube_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import fs from 'fs'
import path from 'path'
import { getSupabase, ChannelRecord } from './supabase'
import { logger } from './logger'

export function buildOAuthClient(channel: ChannelRecord): OAuth2Client {
  // Env-naam-harmonisatie: connect-route + refresh-cron gebruiken YOUTUBE_CLIENT_ID/SECRET,
  // de worker gebruikte YOUTUBE_OAUTH_CLIENT_ID/SECRET. Verschil → unauthorized_client op
  // fallback-kanalen. Accepteer beide zodat de worker dezelfde globale client pakt als de connect.
  const clientId = channel.oauth_client_id
    ?? process.env.YOUTUBE_OAUTH_CLIENT_ID ?? process.env.YOUTUBE_CLIENT_ID!
  const clientSecret = channel.oauth_client_secret
    ?? process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? process.env.YOUTUBE_CLIENT_SECRET!
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? process.env.YOUTUBE_REDIRECT_URI!

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  if (channel.refresh_token) {
    oauth2.setCredentials({
      access_token:  channel.access_token ?? undefined,
      refresh_token: channel.refresh_token,
      expiry_date:   channel.token_expires
        ? new Date(channel.token_expires).getTime()
        : undefined,
    })

    oauth2.on('tokens', async (tokens) => {
      const db = getSupabase()
      const updates: Record<string, unknown> = {}
      if (tokens.access_token) updates.access_token = tokens.access_token
      if (tokens.expiry_date)  updates.token_expires = new Date(tokens.expiry_date).toISOString()
      if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token
      if (Object.keys(updates).length) {
        updates.oauth_status = 'connected'
        await db.from('youtube_channels').update(updates).eq('id', channel.id)
        logger.info(`Token auto-refreshed for channel ${channel.naam}`)
      }
    })
  }

  return oauth2
}

export function buildYouTubeClient(auth: OAuth2Client): youtube_v3.Youtube {
  return google.youtube({ version: 'v3', auth })
}

/**
 * Voegt (idempotent) een regel toe aan de KANAALBESCHRIJVING (brandingSettings).
 * Veilig: haalt eerst de volledige brandingSettings op en stuurt die compleet
 * terug — alleen de description wordt aangevuld (geen banner/keywords/trailer
 * overschreven). Slaat over als de URL al in de beschrijving staat.
 * Vereist scope youtube.force-ssl (aanwezig). Returnt de uitkomst-status.
 */
export async function appendChannelDescriptionLink(
  auth: OAuth2Client,
  line: string,
  opts: { apply: boolean } = { apply: false },
): Promise<'skipped_present' | 'no_branding' | 'would_update' | 'updated'> {
  const yt = buildYouTubeClient(auth)
  const cur = await yt.channels.list({ part: ['brandingSettings'], mine: true })
  const ch = cur.data.items?.[0]
  if (!ch?.id || !ch.brandingSettings) return 'no_branding'

  const desc = ch.brandingSettings.channel?.description ?? ''
  if (desc.includes('aquier.com')) return 'skipped_present'

  const newDesc = desc.trim() ? `${desc.trim()}\n\n${line}` : line
  if (!opts.apply) return 'would_update'

  await yt.channels.update({
    part: ['brandingSettings'],
    requestBody: {
      id: ch.id,
      brandingSettings: {
        ...ch.brandingSettings,
        channel: { ...ch.brandingSettings.channel, description: newDesc },
      },
    },
  })
  return 'updated'
}

export interface UploadParams {
  filePath: string
  title: string
  description: string
  tags: string[]
  categoryId: string
  privacyStatus: 'private' | 'unlisted' | 'public'
  scheduledPublishAt?: string
  madeForKids: boolean
  thumbnailPath?: string
  onProgress?: (bytesUploaded: number, totalBytes: number) => void
}

export interface UploadResult {
  youtubeVideoId: string
  youtubeUrl: string
}

export async function uploadVideo(
  auth: OAuth2Client,
  params: UploadParams
): Promise<UploadResult> {
  const yt = buildYouTubeClient(auth)
  const fileSize = fs.statSync(params.filePath).size

  const snippet: youtube_v3.Schema$VideoSnippet = {
    title: params.title,
    description: params.description,
    tags: params.tags,
    categoryId: params.categoryId,
  }

  const status: youtube_v3.Schema$VideoStatus = {
    privacyStatus: params.privacyStatus,
    madeForKids: params.madeForKids,
    selfDeclaredMadeForKids: params.madeForKids,
  }

  if (params.privacyStatus === 'private' && params.scheduledPublishAt) {
    status.privacyStatus = 'private'
    status.publishAt = params.scheduledPublishAt
  }

  const response = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: { snippet, status },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(params.filePath),
    },
  }, {
    onUploadProgress: (evt) => {
      if (params.onProgress && evt.bytesRead) {
        params.onProgress(evt.bytesRead, fileSize)
      }
    },
  })

  const videoId = response.data.id!
  return {
    youtubeVideoId: videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}

export interface VideoProcessingStatus {
  uploadStatus: string | null
  processingStatus: string | null
  privacyStatus: string | null
  embeddable: boolean
  publicStatsViewable: boolean
  thumbnailExists: boolean
  duration: string | null
  publishAt: string | null
  madeForKids: boolean
  blockedRegions: string[]
  copyrightStatus: string | null
}

export async function getVideoStatus(
  auth: OAuth2Client,
  youtubeVideoId: string
): Promise<VideoProcessingStatus> {
  const yt = buildYouTubeClient(auth)

  const response = await yt.videos.list({
    part: ['status', 'processingDetails', 'snippet', 'contentDetails'],
    id: [youtubeVideoId],
  })

  const video = response.data.items?.[0]
  if (!video) throw new Error(`Video ${youtubeVideoId} not found in YouTube API`)

  const processingDetails = video.processingDetails
  const status = video.status
  const snippet = video.snippet

  const thumbnailExists = !!(
    snippet?.thumbnails?.default?.url ||
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.high?.url
  )

  let copyrightStatus: string | null = null
  if (status?.uploadStatus === 'rejected') {
    copyrightStatus = 'blocked'
  }

  const blockedRegions: string[] = []
  if (video.contentDetails?.regionRestriction?.blocked) {
    blockedRegions.push(...(video.contentDetails.regionRestriction.blocked as string[]))
  }

  return {
    uploadStatus: status?.uploadStatus ?? null,
    processingStatus: processingDetails?.processingStatus ?? null,
    privacyStatus: status?.privacyStatus ?? null,
    embeddable: status?.embeddable ?? false,
    publicStatsViewable: status?.publicStatsViewable ?? false,
    thumbnailExists,
    duration: video.contentDetails?.duration ?? null,
    publishAt: status?.publishAt ?? null,
    madeForKids: status?.madeForKids ?? false,
    blockedRegions,
    copyrightStatus,
  }
}

export async function uploadThumbnail(
  auth: OAuth2Client,
  youtubeVideoId: string,
  thumbnailPath: string
): Promise<void> {
  const yt = buildYouTubeClient(auth)
  const ext = path.extname(thumbnailPath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

  await yt.thumbnails.set({
    videoId: youtubeVideoId,
    media: {
      mimeType,
      body: fs.createReadStream(thumbnailPath),
    },
  })
}

export async function setVideoPublic(
  auth: OAuth2Client,
  youtubeVideoId: string
): Promise<void> {
  const yt = buildYouTubeClient(auth)
  await yt.videos.update({
    part: ['status'],
    requestBody: {
      id: youtubeVideoId,
      status: { privacyStatus: 'public' },
    },
  })
}

export async function getVideoAnalytics(
  auth: OAuth2Client,
  youtubeVideoId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const analyticsClient = google.youtubeAnalytics({ version: 'v2', auth })

  try {
    const response = await analyticsClient.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,likes,dislikes,comments,shares,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,impressions,impressionClickThroughRate',
      filters: `video==${youtubeVideoId}`,
      dimensions: 'video',
    })

    const rows = response.data.rows ?? []
    const row = rows[0] ?? []
    const headers = response.data.columnHeaders?.map(h => h.name) ?? []

    const result: Record<string, number> = {}
    headers.forEach((header, i) => {
      if (header && row[i] != null) {
        result[header] = Number(row[i])
      }
    })
    return result
  } catch {
    return {}
  }
}
