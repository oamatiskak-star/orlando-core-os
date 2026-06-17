/**
 * Cat 5 — CF2 Cross-Platform Distributie
 * Vindt gepubliceerde YouTube-video's zonder cross-platform posts,
 * genereert LinkedIn-posts vanuit het transcript, slaat op als draft.
 * "Video 2 Social" Apify-actor genereert ook Instagram + Twitter copy.
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS } from '../config.mjs'

const ENGINE_KEY = 'apify:cf2-distribution'
const MAX_PER_RUN = 5  // max video's per run om Apify-kosten te beheersen

async function getUndistributedVideos() {
  // Haal gepubliceerde video's op die nog geen LinkedIn-post hebben
  const { data: videos } = await db()
    .from('content_items')
    .select('id, youtube_url, title, transcript')
    .eq('status', 'published')
    .not('youtube_url', 'is', null)
    .not('transcript', 'is', null)
    .limit(MAX_PER_RUN)

  if (!videos?.length) return []

  // Filter op video's zonder bestaande distributie-posts
  const { data: existing } = await db()
    .from('cf2_cross_platform_posts')
    .select('video_id')
    .in('video_id', videos.map(v => v.id))
    .eq('platform', 'linkedin')

  const distributed = new Set((existing || []).map(r => r.video_id))
  return videos.filter(v => !distributed.has(v.id))
}

async function generateLinkedInPosts(videoId, youtubeUrl, transcript, log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.TRANSCRIPT_TO_LI,
      { transcript: transcript.slice(0, 5000), youtubeUrl, postCount: 5 },
      { timeoutMs: 120_000 },
    )
    const posts = []
    for (const item of items) {
      const content = item.post || item.content || item.text || ''
      if (!content) continue
      posts.push({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform: 'linkedin',
        content,
        actor_run_id: runId,
        status: 'draft',
      })
    }
    return posts
  } catch (err) {
    log(`⚠️  LinkedIn posts voor ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generateVideoTranscriptIfMissing(videoId, youtubeUrl, log) {
  // Controleer of er al een transcript is
  const { data: video } = await db()
    .from('content_items')
    .select('transcript')
    .eq('id', videoId)
    .maybeSingle()
  if (video?.transcript) return video.transcript

  try {
    const { items, runId } = await runAndCollect(
      ACTORS.VIDEO_TO_TEXT,
      { url: youtubeUrl },
      { timeoutMs: 180_000 },
    )
    const transcript = items[0]?.transcript || items[0]?.text || ''
    if (transcript) {
      await db().from('content_items').update({ transcript }).eq('id', videoId)
      log(`✓ Transcript gegenereerd voor ${youtubeUrl}`)
    }
    return transcript
  } catch (err) {
    log(`⚠️  Transcript ${youtubeUrl}: ${err.message}`)
    return null
  }
}

export async function run(log = console.log) {
  log('[cf2-distribution] start')
  const started = Date.now()

  const videos = await getUndistributedVideos()
  log(`${videos.length} video's te distribueren`)

  let totalPosts = 0
  for (const video of videos) {
    const transcript = video.transcript
      || await generateVideoTranscriptIfMissing(video.id, video.youtube_url, log)
    if (!transcript) continue

    const posts = await generateLinkedInPosts(video.id, video.youtube_url, transcript, log)
    if (posts.length) {
      const { error } = await db().from('cf2_cross_platform_posts').insert(posts)
      if (error) log(`⚠️  Posts opslaan ${video.youtube_url}: ${error.message}`)
      else {
        totalPosts += posts.length
        log(`✓ ${posts.length} LinkedIn-posts draft → ${video.title || video.youtube_url}`)
      }
    }
  }

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { videos: videos.length, posts: totalPosts, ms })
  log(`[cf2-distribution] klaar in ${ms}ms — ${totalPosts} posts aangemaakt`)
  return { videos: videos.length, posts: totalPosts }
}
