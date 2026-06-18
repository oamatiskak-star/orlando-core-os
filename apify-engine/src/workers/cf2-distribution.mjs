/**
 * Cat 5 — CF2 Cross-Platform Distributie
 * Vindt gepubliceerde YouTube-video's zonder cross-platform posts en genereert:
 * - LinkedIn posts (5 varianten)
 * - Twitter/X threads
 * - Multi-platform social copy via Video-to-Social actor (Instagram, newsletter, etc.)
 * Alles wordt als draft opgeslagen in cf2_cross_platform_posts.
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS } from '../config.mjs'

const ENGINE_KEY = 'apify:cf2-distribution'
const MAX_PER_RUN = 5  // max video's per run om Apify-kosten te beheersen

async function getUndistributedVideos() {
  const { data: videos } = await db()
    .from('content_items')
    .select('id, youtube_url, title, transcript')
    .eq('status', 'published')
    .not('youtube_url', 'is', null)
    .not('transcript', 'is', null)
    .limit(MAX_PER_RUN)

  if (!videos?.length) return []

  // Filter op video's zonder bestaande LinkedIn-post
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
    return items
      .map(item => ({ content: item.post || item.content || item.text || '' }))
      .filter(p => p.content)
      .map(p => ({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform: 'linkedin',
        content: p.content,
        actor_run_id: runId,
        status: 'draft',
      }))
  } catch (err) {
    log(`⚠️  LinkedIn posts ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generateTwitterThreads(videoId, youtubeUrl, transcript, log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.TWITTER_THREADS,
      { transcript: transcript.slice(0, 5000), youtubeUrl, threadCount: 2 },
      { timeoutMs: 120_000 },
    )
    return items
      .map(item => ({ content: item.thread || item.content || item.text || '' }))
      .filter(p => p.content)
      .map(p => ({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform: 'twitter',
        content: p.content,
        actor_run_id: runId,
        status: 'draft',
      }))
  } catch (err) {
    log(`⚠️  Twitter threads ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generateMultiPlatformPosts(videoId, youtubeUrl, log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.VIDEO_TO_SOCIAL,
      { videoUrl: youtubeUrl, platforms: ['instagram', 'newsletter'], postCount: 2 },
      { timeoutMs: 180_000 },
    )
    const posts = []
    for (const item of items) {
      const platform = item.platform || 'instagram'
      const content = item.post || item.content || item.caption || item.text || ''
      if (!content || !['instagram', 'newsletter'].includes(platform)) continue
      posts.push({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform,
        content,
        actor_run_id: runId,
        status: 'draft',
      })
    }
    return posts
  } catch (err) {
    log(`⚠️  Multi-platform posts ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generateFacebookAdCopy(videoId, youtubeUrl, transcript, log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.FB_AD_COPY,
      { transcript: transcript.slice(0, 3000), videoUrl: youtubeUrl, adCount: 3 },
      { timeoutMs: 120_000 },
    )
    return items
      .map(item => ({ content: item.adCopy || item.copy || item.content || item.text || '' }))
      .filter(p => p.content)
      .map(p => ({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform: 'facebook_ad',
        content: p.content,
        actor_run_id: runId,
        status: 'draft',
      }))
  } catch (err) {
    log(`⚠️  Facebook Ad Copy ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generatePodcastEpisodes(videoId, youtubeUrl, transcript, log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.PODCAST_IDEAS,
      { transcript: transcript.slice(0, 4000), videoUrl: youtubeUrl, episodeCount: 2 },
      { timeoutMs: 120_000 },
    )
    return items
      .map(item => ({ content: item.episodeOutline || item.episode || item.content || item.text || '' }))
      .filter(p => p.content)
      .map(p => ({
        video_id: videoId,
        youtube_url: youtubeUrl,
        platform: 'podcast',
        content: p.content,
        actor_run_id: runId,
        status: 'draft',
      }))
  } catch (err) {
    log(`⚠️  Podcast Episodes ${youtubeUrl}: ${err.message}`)
    return []
  }
}

async function generateVideoTranscriptIfMissing(videoId, youtubeUrl, log) {
  const { data: video } = await db()
    .from('content_items')
    .select('transcript')
    .eq('id', videoId)
    .maybeSingle()
  if (video?.transcript) return video.transcript

  try {
    const { items } = await runAndCollect(
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

    const [liPosts, twPosts, multiPosts, fbAdPosts, podcastPosts] = await Promise.all([
      generateLinkedInPosts(video.id, video.youtube_url, transcript, log),
      generateTwitterThreads(video.id, video.youtube_url, transcript, log),
      generateMultiPlatformPosts(video.id, video.youtube_url, log),
      generateFacebookAdCopy(video.id, video.youtube_url, transcript, log),
      generatePodcastEpisodes(video.id, video.youtube_url, transcript, log),
    ])

    const allPosts = [...liPosts, ...twPosts, ...multiPosts, ...fbAdPosts, ...podcastPosts]
    if (allPosts.length) {
      const { error } = await db().from('cf2_cross_platform_posts').insert(allPosts)
      if (error) log(`⚠️  Posts opslaan ${video.youtube_url}: ${error.message}`)
      else {
        totalPosts += allPosts.length
        log(`✓ ${allPosts.length} posts draft (LI:${liPosts.length} TW:${twPosts.length} Multi:${multiPosts.length} FB:${fbAdPosts.length} Podcast:${podcastPosts.length}) → ${video.title || video.youtube_url}`)
      }
    }
  }

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { videos: videos.length, posts: totalPosts, ms })
  log(`[cf2-distribution] klaar in ${ms}ms — ${totalPosts} posts aangemaakt`)
  return { videos: videos.length, posts: totalPosts }
}
