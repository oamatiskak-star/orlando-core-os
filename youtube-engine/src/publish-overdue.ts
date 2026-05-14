/**
 * One-shot: publish all uploaded videos whose scheduled_publish_at has passed but are still private.
 * Run: npx ts-node --transpile-only src/publish-overdue.ts
 */
import 'dotenv/config'
import { getSupabase } from './lib/supabase'
import { buildOAuthClient, setVideoPublic } from './lib/youtube-api'

async function main() {
  const db = getSupabase()

  const { data: overdue, error } = await db
    .from('youtube_upload_queue')
    .select('id, video_id, channel_id, youtube_video_id')
    .in('status', ['uploaded_pending_processing', 'verified_live', 'verifying', 'manual_review_required'])
    .not('youtube_video_id', 'is', null)
    .lte('scheduled_publish_at', new Date().toISOString())

  if (error) { console.error('Supabase error:', error.message); process.exit(1) }
  if (!overdue || overdue.length === 0) { console.log('No overdue items.'); process.exit(0) }

  const videoIds = overdue.map(i => i.video_id)
  const { data: privateVideos } = await db
    .from('youtube_videos')
    .select('id')
    .in('id', videoIds)
    .eq('privacy_status', 'private')

  const privateSet = new Set((privateVideos ?? []).map(v => v.id))
  const toPublish = overdue.filter(i => privateSet.has(i.video_id))

  if (toPublish.length === 0) { console.log('All overdue videos already public.'); process.exit(0) }

  console.log(`Publishing ${toPublish.length} overdue private videos...`)

  for (const item of toPublish) {
    try {
      const { data: channel } = await db
        .from('youtube_channels')
        .select('*')
        .eq('id', item.channel_id)
        .single()

      if (!channel?.refresh_token) {
        console.warn(`  ✗ No OAuth token for channel ${item.channel_id}`)
        continue
      }

      const auth = buildOAuthClient(channel)
      await setVideoPublic(auth, item.youtube_video_id)

      await db.from('youtube_videos').update({
        privacy_status: 'public',
        status: 'live',
        updated_at: new Date().toISOString(),
      }).eq('id', item.video_id)

      await db.from('youtube_upload_queue').update({
        status: 'verified_live',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)

      console.log(`  ✓ ${item.youtube_video_id} — publiek`)
    } catch (err) {
      console.error(`  ✗ ${item.youtube_video_id}: ${(err as Error).message}`)
    }
  }

  console.log('Done.')
  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
