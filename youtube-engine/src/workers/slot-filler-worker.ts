import cron from 'node-cron'
import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'

const log = workerLogger('slot-filler')

/**
 * Koppelt klaarstaande videos (status='queued', file_path aanwezig)
 * aan de eerstvolgende lege geplande slot per kanaal.
 * Zet slot status → 'queued' zodat de orchestrator hem oppikt.
 */
async function fillSlots(): Promise<void> {
  const db = getSupabase()

  // Alle videos klaar voor upload (file_path of storage_path aanwezig)
  const { data: readyVideos } = await db
    .from('youtube_videos')
    .select('id, channel_id, title, privacy_status, scheduled_publish_at, file_path, storage_path')
    .eq('status', 'queued')
    .or('file_path.not.is.null,storage_path.not.is.null')
    .order('created_at', { ascending: true })
    .limit(50)

  if (!readyVideos?.length) return

  log.debug(`Slot filler: ${readyVideos.length} videos klaar voor koppeling`)

  // Groepeer per kanaal
  const byChannel = new Map<string, typeof readyVideos>()
  for (const v of readyVideos) {
    const list = byChannel.get(v.channel_id) ?? []
    list.push(v)
    byChannel.set(v.channel_id, list)
  }

  let filled = 0

  for (const [channelId, videos] of byChannel.entries()) {
    // Haal de eerst beschikbare lege geplande slots op voor dit kanaal
    const { data: slots } = await db
      .from('youtube_upload_queue')
      .select('id, scheduled_publish_at')
      .eq('channel_id', channelId)
      .eq('status', 'planned')
      .is('video_id', null)
      .gt('scheduled_publish_at', new Date().toISOString())
      .order('scheduled_publish_at', { ascending: true })
      .limit(videos.length)

    if (!slots?.length) continue

    const pairs = Math.min(videos.length, slots.length)

    for (let i = 0; i < pairs; i++) {
      const video = videos[i]
      const slot  = slots[i]

      // Koppel video aan slot
      const { error } = await db
        .from('youtube_upload_queue')
        .update({
          video_id:             video.id,
          title:                video.title,
          status:               'queued',
          privacy_status:       video.privacy_status ?? 'private',
          scheduled_publish_at: slot.scheduled_publish_at,
          updated_at:           new Date().toISOString(),
        })
        .eq('id', slot.id)

      if (error) {
        log.error('Slot koppeling mislukt', { slotId: slot.id, videoId: video.id, error: error.message })
        continue
      }

      // Markeer video als 'scheduled' zodat hij niet nogmaals wordt gekoppeld
      await db
        .from('youtube_videos')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('id', video.id)

      log.info(`Slot gevuld: ${video.title} → ${slot.scheduled_publish_at}`, {
        channelId,
        videoId: video.id,
        slotId:  slot.id,
      })

      filled++
    }
  }

  if (filled > 0) {
    log.info(`Slot filler klaar: ${filled} slots gevuld`)
  }
}

export function startSlotFillerWorker(): void {
  log.info('Slot filler worker gestart')

  // Elke 2 minuten checken
  cron.schedule('*/2 * * * *', async () => {
    try {
      await fillSlots()
    } catch (err) {
      log.error('Slot filler error', { error: (err as Error).message })
    }
  })
}
