import { google, youtube_v3 } from 'googleapis'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Public YouTube Data API v3 client — gebruikt API key (geen OAuth).
// Read-only: channels.list, playlistItems.list, videos.list.
// Quota: standaard 10.000 units/dag; channels.list=1, playlistItems.list=1,
// videos.list=1, per request.
// ─────────────────────────────────────────────────────────────────────────────

let _client: youtube_v3.Youtube | null = null

function getClient(): youtube_v3.Youtube {
  if (!_client) {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_DATA_API_KEY is required for public YouTube Data API')
    _client = google.youtube({ version: 'v3', auth: apiKey })
  }
  return _client
}

export interface PublicChannelInfo {
  id: string
  title: string
  customUrl: string | null
  thumbnailUrl: string | null
  subscriberCount: number
  videoCount: number
  viewCount: number
  uploadsPlaylistId: string | null
  country: string | null
  defaultLanguage: string | null
}

export async function fetchChannelInfo(channelId: string): Promise<PublicChannelInfo | null> {
  const yt = getClient()
  const res = await yt.channels.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    id: [channelId],
  })
  const item = res.data.items?.[0]
  if (!item) return null

  return {
    id:                item.id ?? channelId,
    title:             item.snippet?.title ?? '',
    customUrl:         item.snippet?.customUrl ?? null,
    thumbnailUrl:      item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    subscriberCount:   Number(item.statistics?.subscriberCount ?? 0),
    videoCount:        Number(item.statistics?.videoCount ?? 0),
    viewCount:         Number(item.statistics?.viewCount ?? 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    country:           item.snippet?.country ?? null,
    defaultLanguage:   item.snippet?.defaultLanguage ?? null,
  }
}

// channels.list accepts forHandle (replaces forUsername which is deprecated).
// Voor @handle of UC... → resolve naar canonical channel ID.
export async function resolveChannelHandle(input: string): Promise<string | null> {
  const yt = getClient()
  const trimmed = input.trim()

  if (trimmed.startsWith('UC') && trimmed.length === 24) return trimmed

  const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  try {
    const res = await yt.channels.list({ part: ['id'], forHandle: handle })
    return res.data.items?.[0]?.id ?? null
  } catch (err) {
    logger.warn('Channel handle resolve failed', { handle, error: (err as Error).message })
    return null
  }
}

export interface YouTubeSearchHit {
  kind:         'video' | 'channel'
  videoId:      string | null
  channelId:    string | null
  title:        string
  channelTitle: string
  publishedAt:  string | null
}

// search.list — KOST 100 quota-units per call. Spaarzaam gebruiken (discovery 1x/dag).
export async function searchYouTube(query: string, opts: {
  type?:              'video' | 'channel'
  maxResults?:        number
  order?:             'date' | 'viewCount' | 'relevance' | 'rating'
  regionCode?:        string
  relevanceLanguage?: string
  publishedAfter?:    string
} = {}): Promise<YouTubeSearchHit[]> {
  const yt = getClient()
  const res = await yt.search.list({
    part:              ['snippet'],
    q:                 query,
    type:              [opts.type ?? 'video'],
    maxResults:        opts.maxResults ?? 15,
    order:             opts.order ?? 'viewCount',
    regionCode:        opts.regionCode,
    relevanceLanguage: opts.relevanceLanguage,
    publishedAfter:    opts.publishedAfter,
  })
  const hits: YouTubeSearchHit[] = []
  for (const item of res.data.items ?? []) {
    hits.push({
      kind:         item.id?.kind?.includes('channel') ? 'channel' : 'video',
      videoId:      item.id?.videoId ?? null,
      channelId:    item.id?.channelId ?? null,
      title:        item.snippet?.title ?? '',
      channelTitle: item.snippet?.channelTitle ?? '',
      publishedAt:  item.snippet?.publishedAt ?? null,
    })
  }
  return hits
}

export interface PublicPlaylistVideo {
  videoId: string
  publishedAt: string | null
  title: string
}

// Haalt N meest recente video IDs uit een uploads playlist (paginated tot maxResults).
export async function fetchRecentUploads(
  uploadsPlaylistId: string,
  maxResults = 25,
): Promise<PublicPlaylistVideo[]> {
  const yt = getClient()
  const results: PublicPlaylistVideo[] = []
  let pageToken: string | undefined

  while (results.length < maxResults) {
    const remaining = maxResults - results.length
    const res: { data: youtube_v3.Schema$PlaylistItemListResponse } = await yt.playlistItems.list({
      part: ['contentDetails', 'snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(50, remaining),
      pageToken,
    })
    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId
      if (!vid) continue
      results.push({
        videoId:     vid,
        publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? null,
        title:       item.snippet?.title ?? '',
      })
    }
    pageToken = res.data.nextPageToken ?? undefined
    if (!pageToken) break
  }

  return results
}

export interface PublicVideoInfo {
  id: string
  title: string
  description: string
  publishedAt: string | null
  thumbnailUrl: string | null
  durationSeconds: number
  views: number
  likes: number
  comments: number
  defaultAudioLanguage: string | null
  isShort: boolean
}

const CHUNK = 50
export async function fetchVideoStats(videoIds: string[]): Promise<PublicVideoInfo[]> {
  if (videoIds.length === 0) return []
  const yt = getClient()
  const out: PublicVideoInfo[] = []

  for (let i = 0; i < videoIds.length; i += CHUNK) {
    const slice = videoIds.slice(i, i + CHUNK)
    const res = await yt.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: slice,
      maxResults: CHUNK,
    })
    for (const item of res.data.items ?? []) {
      const id = item.id
      if (!id) continue
      const duration = parseDuration(item.contentDetails?.duration ?? '')
      const description = item.snippet?.description ?? ''
      out.push({
        id,
        title:               item.snippet?.title ?? '',
        description,
        publishedAt:         item.snippet?.publishedAt ?? null,
        thumbnailUrl:        item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
        durationSeconds:     duration,
        views:               Number(item.statistics?.viewCount ?? 0),
        likes:               Number(item.statistics?.likeCount ?? 0),
        comments:            Number(item.statistics?.commentCount ?? 0),
        defaultAudioLanguage: item.snippet?.defaultAudioLanguage ?? item.snippet?.defaultLanguage ?? null,
        isShort:             duration > 0 && duration <= 60,
      })
    }
  }
  return out
}

// PT#H#M#S → seconds
function parseDuration(iso: string): number {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const h = Number(m[1] ?? 0), mi = Number(m[2] ?? 0), s = Number(m[3] ?? 0)
  return h * 3600 + mi * 60 + s
}
