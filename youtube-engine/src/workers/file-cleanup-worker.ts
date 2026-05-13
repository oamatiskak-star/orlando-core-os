import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { workerLogger } from '../lib/logger'

const log = workerLogger('file-cleanup')

const BUCKET = 'yt-videos'

function getStorageClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Wist video bestanden nadat upload succesvol is geverifieerd:
 * 1. Verwijdert uit Supabase Storage (als storage_path aanwezig)
 * 2. Verwijdert lokaal bestand (als file_path een lokaal pad is)
 * 3. Markeert youtube_videos.file_deleted_at = now()
 */
async function cleanupVerifiedVideos(): Promise<void> {
  const db = getStorageClient()

  // Videos die verified_live zijn maar nog niet opgeruimd
  const { data: queueItems } = await db
    .from('youtube_upload_queue')
    .select('video_id, youtube_video_id')
    .eq('status', 'verified_live')
    .limit(20)

  if (!queueItems?.length) return

  const videoIds = queueItems.map(q => q.video_id).filter(Boolean)
  if (!videoIds.length) return

  const { data: videos } = await db
    .from('youtube_videos')
    .select('id, file_path, storage_bucket, storage_path, file_deleted_at')
    .in('id', videoIds)
    .is('file_deleted_at', null)

  if (!videos?.length) return

  log.info(`Cleanup: ${videos.length} bestanden verwijderen`)

  for (const video of videos) {
    let deleted = false

    try {
      // 1. Verwijder uit Supabase Storage
      if (video.storage_path) {
        const { error } = await db.storage
          .from(video.storage_bucket ?? BUCKET)
          .remove([video.storage_path])

        if (error) {
          log.warn(`Storage delete mislukt voor ${video.storage_path}:`, error.message)
        } else {
          log.info(`Storage bestand verwijderd: ${video.storage_path}`)
          deleted = true
        }
      }

      // 2. Verwijder lokaal bestand (als pad met / begint en bestaat)
      if (video.file_path && video.file_path.startsWith('/') && fs.existsSync(video.file_path)) {
        fs.unlinkSync(video.file_path)
        log.info(`Lokaal bestand verwijderd: ${video.file_path}`)
        deleted = true
      }

      // 3. Markeer als verwijderd in DB
      await db.from('youtube_videos').update({
        file_deleted_at: new Date().toISOString(),
        file_path:       null,
        storage_path:    null,
        updated_at:      new Date().toISOString(),
      }).eq('id', video.id)

      if (deleted) {
        log.info(`✓ Bestand opgeruimd voor video ${video.id}`)
      }
    } catch (err: any) {
      log.error(`Cleanup fout voor video ${video.id}:`, err.message)
    }
  }
}

export function startFileCleanupWorker(): void {
  log.info('File cleanup worker gestart')

  // Elke 10 minuten checken op te verwijderen bestanden
  cron.schedule('*/10 * * * *', async () => {
    try {
      await cleanupVerifiedVideos()
    } catch (err: any) {
      log.error('Cleanup worker error:', err.message)
    }
  })
}
