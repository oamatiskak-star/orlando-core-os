/**
 * Cat 1 — CF2 Intelligence
 * - Scrapt transcripts van competitor YouTube-kanalen
 * - Haalt trending US-finance topics op via RSS + YouTube Trending
 * - Slaat alles op als topic-kandidaten in cf2_topic_feed
 * - Vult cf2_competitor_transcripts voor script-analyse
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS, CF2_NEWS_FEEDS, CF2_COMPETITOR_CHANNELS } from '../config.mjs'

const ENGINE_KEY = 'apify:cf2-intelligence'

async function fetchRssTopics(log) {
  const items = []
  for (const feedUrl of CF2_NEWS_FEEDS) {
    try {
      const { items: rssItems, runId } = await runAndCollect(
        ACTORS.RSS_NEWS,
        { url: feedUrl, maxItems: 50 },
        { timeoutMs: 120_000 },
      )
      for (const item of rssItems) {
        items.push({
          source: 'rss_news',
          actor_run_id: runId,
          title: item.title || item.name || '',
          url: item.link || item.url || null,
          description: item.description || item.summary || null,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          relevance_score: 0.5,
        })
      }
      log(`RSS ${feedUrl} → ${rssItems.length} items`)
    } catch (err) {
      log(`⚠️  RSS ${feedUrl} mislukt: ${err.message}`)
    }
  }
  return items
}

async function fetchYouTubeTrending(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.YT_TRENDING,
      { searchQuery: 'US finance investing stock market', maxResults: 30, order: 'viewCount' },
      { timeoutMs: 180_000 },
    )
    log(`YouTube Trending → ${items.length} video's`)
    return items.map(v => ({
      source: 'youtube_trending',
      actor_run_id: runId,
      title: v.title || v.name || '',
      url: v.url || (v.id ? `https://youtube.com/watch?v=${v.id}` : null),
      description: v.description || null,
      published_at: v.uploadDate ? new Date(v.uploadDate).toISOString() : null,
      relevance_score: Math.min((v.viewCount || 0) / 1_000_000, 1),
    }))
  } catch (err) {
    log(`⚠️  YouTube Trending mislukt: ${err.message}`)
    return []
  }
}

async function scrapeCompetitorTranscripts(log) {
  if (!CF2_COMPETITOR_CHANNELS.length) {
    log('Geen competitor-kanalen geconfigureerd (CF2_COMPETITOR_CHANNELS)')
    return
  }
  for (const channelUrl of CF2_COMPETITOR_CHANNELS) {
    try {
      // Haal recente video's op van kanaal
      const { items: videos, runId: trendsRun } = await runAndCollect(
        ACTORS.YT_TRENDING,
        { channelUrl, maxResults: 5 },
        { timeoutMs: 120_000 },
      )
      for (const video of videos.slice(0, 3)) {
        const videoUrl = video.url || (video.id ? `https://youtube.com/watch?v=${video.id}` : null)
        if (!videoUrl) continue

        // Check: al geschraapt?
        const { data: existing } = await db()
          .from('cf2_competitor_transcripts')
          .select('id')
          .eq('video_url', videoUrl)
          .maybeSingle()
        if (existing) continue

        try {
          const { items: transcripts, runId: transRun } = await runAndCollect(
            ACTORS.YT_TRANSCRIPT,
            { startUrls: [{ url: videoUrl }] },
            { timeoutMs: 180_000 },
          )
          const t = transcripts[0]
          if (!t) continue
          const transcript = Array.isArray(t.transcript)
            ? t.transcript.map(s => s.text || s).join(' ')
            : (t.transcript || t.text || '')
          await db().from('cf2_competitor_transcripts').upsert({
            channel_url: channelUrl,
            video_url: videoUrl,
            title: video.title || t.title || '',
            duration_secs: t.duration || video.duration || null,
            transcript,
            word_count: transcript.split(/\s+/).length,
            actor_run_id: transRun,
          }).throwOnError()
          log(`✓ Transcript: ${video.title || videoUrl}`)
        } catch (err) {
          log(`⚠️  Transcript ${videoUrl}: ${err.message}`)
        }
      }
    } catch (err) {
      log(`⚠️  Kanaal ${channelUrl}: ${err.message}`)
    }
  }
}

export async function run(log = console.log) {
  log('[cf2-intelligence] start')
  const started = Date.now()

  const [rssTopics, ytTopics] = await Promise.all([
    fetchRssTopics(log),
    fetchYouTubeTrending(log),
  ])

  const allTopics = [...rssTopics, ...ytTopics].filter(t => t.title)
  if (allTopics.length) {
    const { error } = await db().from('cf2_topic_feed').insert(allTopics)
    if (error) log(`⚠️  Topic feed insert: ${error.message}`)
    else log(`✓ ${allTopics.length} topics opgeslagen in cf2_topic_feed`)
  }

  await scrapeCompetitorTranscripts(log)

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { topics: allTopics.length, ms })
  log(`[cf2-intelligence] klaar in ${ms}ms`)
  return { topics: allTopics.length }
}
