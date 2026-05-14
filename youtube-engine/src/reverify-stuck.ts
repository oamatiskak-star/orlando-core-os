/**
 * One-shot: enqueue verification jobs for all uploaded_pending_processing items.
 * Run once: npx ts-node --transpile-only src/reverify-stuck.ts
 */
import 'dotenv/config'
import { getRedis, enqueueVerification } from './lib/redis-queue'
import { getSupabase } from './lib/supabase'

async function main() {
  const redis = getRedis()
  await redis.connect()

  const db = getSupabase()

  const { data: items, error } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id')
    .eq('status', 'uploaded_pending_processing')
    .not('youtube_video_id', 'is', null)

  if (error) { console.error('Supabase error:', error.message); process.exit(1) }
  if (!items || items.length === 0) { console.log('Nothing to reverify.'); process.exit(0) }

  console.log(`Enqueuing verification for ${items.length} items...`)

  for (const item of items) {
    await enqueueVerification({
      queueId:        item.id,
      videoId:        item.video_id,
      channelId:      item.channel_id,
      youtubeVideoId: item.youtube_video_id,
      attemptCount:   0,
    }, 2_000)
    console.log(`  ✓ ${item.youtube_video_id} (${item.id.slice(0, 8)})`)
  }

  console.log('Done — all items queued for verification.')
  await redis.quit()
  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
