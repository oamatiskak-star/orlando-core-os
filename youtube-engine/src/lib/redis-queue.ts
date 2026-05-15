import { Queue, Worker, QueueEvents, Job } from 'bullmq'
import IORedis from 'ioredis'
import { logger } from './logger'

let _redis: IORedis | null = null

export function getRedis(): IORedis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
    _redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    _redis.on('error', (err) => logger.error('Redis error', { error: err.message }))
    _redis.on('connect', () => logger.info('Redis connected'))
  }
  return _redis
}

export const QUEUE_NAMES = {
  UPLOAD:         'youtube_upload',
  VERIFY:         'youtube_verify',
  RECOVER:        'youtube_recover',
  THUMBNAIL:      'youtube_thumbnail',
  ANALYTICS:      'youtube_analytics',
  NORMALIZE:      'youtube_normalize',
  BROWSER_VERIFY: 'youtube_browser_verify',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

const _queues: Map<string, Queue> = new Map()

export function getQueue(name: QueueName): Queue {
  if (!_queues.has(name)) {
    _queues.set(name, new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    }))
  }
  return _queues.get(name)!
}

export interface UploadJobData {
  queueId: string
  videoId: string
  channelId: string
  priority?: number
}

export interface VerifyJobData {
  queueId: string
  videoId: string
  channelId: string
  youtubeVideoId: string
  attemptCount?: number
}

export interface RecoverJobData {
  queueId: string
  videoId: string
  channelId: string
  failureType: string
  failureId: string
}

export interface ThumbnailJobData {
  queueId: string
  videoId: string
  channelId: string
  youtubeVideoId: string
  thumbnailPath: string
}

export interface AnalyticsJobData {
  videoId: string
  channelId: string
  youtubeVideoId: string
}

export interface NormalizeJobData {
  queueId: string
  videoId: string
  channelId: string
  inputPath: string
  outputPath: string
}

export interface BrowserVerifyJobData {
  queueId: string
  videoId: string
  youtubeVideoId: string
  youtubeUrl: string
  channelId: string
}

export async function enqueueUpload(data: UploadJobData): Promise<Job> {
  return getQueue(QUEUE_NAMES.UPLOAD).add('upload', data, {
    priority: data.priority ?? 5,
    jobId: `upload_${data.queueId}`,
  })
}

export async function enqueueVerification(data: VerifyJobData, delayMs = 30_000): Promise<Job> {
  return getQueue(QUEUE_NAMES.VERIFY).add('verify', data, {
    delay: delayMs,
    jobId: `verify_${data.queueId}_${data.attemptCount ?? 0}`,
  })
}

export async function enqueueRecovery(data: RecoverJobData, delayMs = 5_000): Promise<Job> {
  return getQueue(QUEUE_NAMES.RECOVER).add('recover', data, {
    delay: delayMs,
    jobId: `recover_${data.failureId}`,
  })
}

export async function enqueueThumbnail(data: ThumbnailJobData): Promise<Job> {
  return getQueue(QUEUE_NAMES.THUMBNAIL).add('thumbnail', data, {
    jobId: `thumbnail_${data.queueId}`,
  })
}

export async function enqueueAnalytics(data: AnalyticsJobData, delayMs = 0): Promise<Job> {
  return getQueue(QUEUE_NAMES.ANALYTICS).add('analytics', data, {
    delay: delayMs,
    jobId: `analytics_${data.videoId}`,
  })
}

export async function enqueueNormalize(data: NormalizeJobData): Promise<Job> {
  return getQueue(QUEUE_NAMES.NORMALIZE).add('normalize', data, {
    jobId: `normalize_${data.queueId}`,
  })
}

export async function enqueueBrowserVerify(data: BrowserVerifyJobData): Promise<Job> {
  return getQueue(QUEUE_NAMES.BROWSER_VERIFY).add('browser_verify', data, {
    jobId: `browser_verify_${data.queueId}`,
  })
}

export { Worker, QueueEvents }
