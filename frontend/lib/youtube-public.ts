// ─────────────────────────────────────────────────────────────────────────────
// Shared YouTube Data API v3 helper voor Vercel cron routes.
// Read-only via API key, native fetch (geen googleapis dep).
// Quota: chart=mostPopular = 1 unit per request.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/youtube/v3'

function apiKey(): string {
  const key = process.env.YOUTUBE_DATA_API_KEY
  if (!key) throw new Error('YOUTUBE_DATA_API_KEY is required')
  return key
}

interface YtThumbnail { url?: string }
interface YtSnippet {
  title?: string
  description?: string
  channelId?: string
  channelTitle?: string
  categoryId?: string
  publishedAt?: string
  defaultLanguage?: string
  defaultAudioLanguage?: string
  thumbnails?: { default?: YtThumbnail; medium?: YtThumbnail; high?: YtThumbnail; standard?: YtThumbnail }
}
interface YtStatistics { viewCount?: string; likeCount?: string; commentCount?: string }
interface YtContentDetails { duration?: string }
interface YtVideoItem {
  id?: string
  snippet?: YtSnippet
  statistics?: YtStatistics
  contentDetails?: YtContentDetails
}
interface YtVideoListResponse {
  items?: YtVideoItem[]
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
}

export interface PopularVideo {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  categoryId: string | null
  publishedAt: string | null
  thumbnailUrl: string | null
  defaultLanguage: string | null
  defaultAudioLanguage: string | null
  durationSeconds: number
  views: number
  likes: number
  comments: number
  regionCode: string
}

// PT#H#M#S → seconds
function parseDuration(iso: string): number {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

export async function fetchMostPopular(
  regionCode: string,
  maxResults = 50,
  videoCategoryId?: string,
): Promise<PopularVideo[]> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    chart: 'mostPopular',
    regionCode,
    maxResults: String(maxResults),
    key: apiKey(),
  })
  if (videoCategoryId) params.set('videoCategoryId', videoCategoryId)

  const url = `${API_BASE}/videos?${params.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`YouTube API ${res.status} for region ${regionCode}${videoCategoryId ? ` cat ${videoCategoryId}` : ''}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as YtVideoListResponse

  return (data.items ?? []).map((item): PopularVideo => ({
    id:                   item.id ?? '',
    title:                item.snippet?.title ?? '',
    description:          item.snippet?.description ?? '',
    channelId:            item.snippet?.channelId ?? '',
    channelTitle:         item.snippet?.channelTitle ?? '',
    categoryId:           item.snippet?.categoryId ?? null,
    publishedAt:          item.snippet?.publishedAt ?? null,
    thumbnailUrl:         item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    defaultLanguage:      item.snippet?.defaultLanguage ?? null,
    defaultAudioLanguage: item.snippet?.defaultAudioLanguage ?? null,
    durationSeconds:      parseDuration(item.contentDetails?.duration ?? ''),
    views:                Number(item.statistics?.viewCount ?? 0),
    likes:                Number(item.statistics?.likeCount ?? 0),
    comments:             Number(item.statistics?.commentCount ?? 0),
    regionCode,
  })).filter((v) => v.id)
}

// view_velocity = views per uur sinds publish
export function viewVelocity(video: { views: number; publishedAt: string | null }): number {
  if (!video.publishedAt) return 0
  const hours = Math.max(1, (Date.now() - new Date(video.publishedAt).getTime()) / 3_600_000)
  return Number((video.views / hours).toFixed(2))
}

// Scoring — log-curve gekalibreerd op observed scores (Drake 14k v/u → 79,
// Lanterns 56k → 94, Peddi 1.16M → 100). Clamp 0-100.
export function virailityScore(velocity: number): number {
  if (velocity <= 0) return 0
  const raw = 50 + 25 * (Math.log10(velocity + 1) - 3)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

// Automation score: heuristic op duration + niche.
export function automationScore(durationSeconds: number, categoryId: string | null): number {
  let s = 50
  if (durationSeconds <= 60) s += 20
  else if (durationSeconds <= 180) s += 10
  else if (durationSeconds >= 600) s -= 10
  if (categoryId === '10' || categoryId === '17') s -= 10
  if (categoryId === '27' || categoryId === '28') s += 10
  return Math.max(0, Math.min(100, s))
}
