import { Worker, Job } from 'bullmq'
import { chromium, Browser, Page } from 'playwright'
import { getRedis, QUEUE_NAMES, BrowserVerifyJobData, enqueueRecovery } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog, recordFailure } from '../lib/supabase'
import { notifyUploadSuccess, notifyManualReview } from '../lib/notifications'
import { workerLogger } from '../lib/logger'

const log = workerLogger('browser-verify')

const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false'
const TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT_MS ?? '30000')

interface BrowserCheckResult {
  videoPlays: boolean
  thumbnailVisible: boolean
  noProcessingWarning: boolean
  noCopyrightBlock: boolean
  noAgeRestriction: boolean
  noUploadFailureBanner: boolean
  durationVisible: boolean
  studioCheck: {
    videoListed: boolean
    noErrors: boolean
  }
}

async function checkPublicPage(page: Page, youtubeUrl: string): Promise<Partial<BrowserCheckResult>> {
  await page.goto(youtubeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  await page.waitForTimeout(3000)

  const videoPlayer = await page.$('video.html5-main-video, video[src]')
  const videoPlays = !!videoPlayer

  const thumbnail = await page.$('img.video-thumbnail-img, ytd-thumbnail img[src]')
  const thumbnailVisible = !!thumbnail

  // Read #reason once — check specific text to avoid false positives
  const reasonEl = await page.$('#reason')
  const reasonText = (await reasonEl?.textContent() ?? '').toLowerCase().trim()

  // Processing warning: check text + aria-label (no XPath — use :has-text() or textContent)
  const ariaProcessing = await page.$('[aria-label*="processing"]')
  const noProcessingWarning = !ariaProcessing && !reasonText.includes('processing')

  // Copyright block: only flag when text specifically mentions copyright/blocked/unavailable
  const copyrightEl = await page.$('[class*="copyright-notice"]')
  const noCopyrightBlock = !copyrightEl &&
    !reasonText.includes('copyright') &&
    !reasonText.includes('blocked') &&
    !reasonText.includes('removed')

  // Age restriction: dedicated gate elements only
  const ageGate = await page.$('#age-gate, ytd-age-gate-renderer, [data-ytid="confirm-button"]')
  const noAgeRestriction = !ageGate && !reasonText.includes('age-restricted')

  // Upload failure: only specific playability error container, not generic id*="error"
  const errorBanner = await page.$('.yt-playability-error-supported-renderers, ytd-player-error-message-renderer')
  const noUploadFailureBanner = !errorBanner

  const durationEl = await page.$('.ytp-time-duration, span.ytp-time-duration')
  const durationVisible = !!durationEl

  return { videoPlays, thumbnailVisible, noProcessingWarning, noCopyrightBlock, noAgeRestriction, noUploadFailureBanner, durationVisible }
}

async function checkStudioPage(page: Page, youtubeVideoId: string): Promise<BrowserCheckResult['studioCheck']> {
  try {
    const studioUrl = `https://studio.youtube.com/video/${youtubeVideoId}/edit`
    await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
    await page.waitForTimeout(3000)

    const errorEl = await page.$('[class*="error-icon"], [aria-label*="error"]')
    const videoListed = !!(await page.$('[class*="video-title"], #video-title'))

    return { videoListed, noErrors: !errorEl }
  } catch {
    return { videoListed: false, noErrors: false }
  }
}

export function startBrowserVerificationWorker(): Worker {
  let browser: Browser | null = null

  const worker = new Worker<BrowserVerifyJobData>(
    QUEUE_NAMES.BROWSER_VERIFY,
    async (job: Job<BrowserVerifyJobData>) => {
      const { queueId, videoId, youtubeVideoId, youtubeUrl, channelId } = job.data
      const db = getSupabase()

      log.info('Browser verification started', { queueId, youtubeUrl })
      await addLog(queueId, videoId, 'info', 'Browser verification started', { youtubeUrl })

      if (!browser || !browser.isConnected()) {
        browser = await chromium.launch({ headless: HEADLESS })
      }

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        locale: 'nl-NL',
      })
      const page = await context.newPage()

      try {
        const publicChecks = await checkPublicPage(page, youtubeUrl)
        const studioChecks = await checkStudioPage(page, youtubeVideoId)

        const result: BrowserCheckResult = {
          videoPlays: publicChecks.videoPlays ?? false,
          thumbnailVisible: publicChecks.thumbnailVisible ?? false,
          noProcessingWarning: publicChecks.noProcessingWarning ?? true,
          noCopyrightBlock: publicChecks.noCopyrightBlock ?? true,
          noAgeRestriction: publicChecks.noAgeRestriction ?? true,
          noUploadFailureBanner: publicChecks.noUploadFailureBanner ?? true,
          durationVisible: publicChecks.durationVisible ?? false,
          studioCheck: studioChecks,
        }

        await addLog(queueId, videoId, 'info', 'Browser check results', result as unknown as Record<string, unknown>)

        const criticalChecksPassed =
          result.noCopyrightBlock &&
          result.noAgeRestriction &&
          result.noUploadFailureBanner &&
          result.noProcessingWarning

        const allChecksPassed =
          criticalChecksPassed &&
          result.videoPlays &&
          result.thumbnailVisible &&
          result.durationVisible

        if (!criticalChecksPassed) {
          const issues = []
          if (!result.noCopyrightBlock) issues.push('copyright_block')
          if (!result.noAgeRestriction) issues.push('age_restriction')
          if (!result.noUploadFailureBanner) issues.push('upload_failure_banner')
          if (!result.noProcessingWarning) issues.push('processing_warning')

          const failureId = await recordFailure(
            queueId, videoId, 'browser_check_failed',
            `Browser check failed: ${issues.join(', ')}`
          )
          await updateQueueStatus(queueId, 'manual_review_required', {
            last_error: `Browser check: ${issues.join(', ')}`,
          })
          await addLog(queueId, videoId, 'error', 'Browser check failed — critical issues detected', { issues })

          const { data: video } = await db.from('youtube_videos').select('title').eq('id', videoId).single()
          const { data: channel } = await db.from('youtube_channels').select('naam').eq('id', channelId).single()
          await notifyManualReview(video?.title ?? videoId, channel?.naam ?? channelId, issues.join(', '))

          await enqueueRecovery({ queueId, videoId, channelId, failureType: 'browser_check_failed', failureId }, 0)
          return { success: false, issues }
        }

        if (!result.thumbnailVisible) {
          await addLog(queueId, videoId, 'warn', 'Thumbnail not visible in browser — may still be propagating')
        }

        await updateQueueStatus(queueId, 'verified_live', {
          verification_finished_at: new Date().toISOString(),
        })

        await db.from('youtube_videos').update({
          status: 'live',
          updated_at: new Date().toISOString(),
        }).eq('id', videoId)

        await addLog(queueId, videoId, 'success', 'VIDEO VERIFIED LIVE — all checks passed', result as unknown as Record<string, unknown>)

        const { data: video } = await db.from('youtube_videos').select('title').eq('id', videoId).single()
        const { data: channel } = await db.from('youtube_channels').select('naam').eq('id', channelId).single()
        await notifyUploadSuccess(
          video?.title ?? videoId,
          channel?.naam ?? channelId,
          youtubeUrl
        )

        log.info('Video verified live', { queueId, youtubeUrl })
        return { success: true, allChecksPassed, result }

      } finally {
        await context.close()
      }
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId } = job.data
    log.error('Browser verification failed', { queueId, error: err.message })
    await addLog(queueId, videoId, 'error', `Browser verification error: ${err.message}`)
    await updateQueueStatus(queueId, 'verifying', { last_error: err.message })
  })

  process.on('SIGTERM', async () => {
    if (browser) await browser.close()
  })

  log.info('Browser verification worker started', { headless: HEADLESS })
  return worker
}
