/**
 * Cat 1 — CF2 Intelligence
 * - RSS + YouTube Trending (US finance)
 * - Reddit trending finance discussions
 * - AI Hype Tracker (GitHub trending + AI nieuws)
 * - Global Markets Intelligence (sentiment-scored nieuwsanalyse)
 * - Competitor YouTube transcripts
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS, CF2_NEWS_FEEDS, CF2_COMPETITOR_CHANNELS, CF2_TIKTOK_QUERIES } from '../config.mjs'

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

async function fetchRedditTopics(log) {
  const subreddits = ['investing', 'stocks', 'personalfinance', 'financialindependence', 'SecurityAnalysis']
  const items = []
  for (const sub of subreddits) {
    try {
      const { items: posts, runId } = await runAndCollect(
        ACTORS.REDDIT_SEARCHER,
        { subreddit: sub, type: 'hot', maxItems: 20 },
        { timeoutMs: 120_000 },
      )
      for (const post of posts) {
        if (!post.title) continue
        items.push({
          source: 'reddit',
          actor_run_id: runId,
          title: post.title,
          url: post.url || post.permalink || null,
          description: post.selftext?.slice(0, 500) || null,
          published_at: post.created ? new Date(post.created * 1000).toISOString() : null,
          relevance_score: Math.min((post.score || 0) / 10_000, 1),
        })
      }
      log(`Reddit r/${sub} → ${posts.length} posts`)
    } catch (err) {
      log(`⚠️  Reddit r/${sub}: ${err.message}`)
    }
  }
  return items
}

async function fetchAIHypeTopics(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.AI_HYPE_TRACKER,
      { maxItems: 30 },
      { timeoutMs: 120_000 },
    )
    log(`AI Hype Tracker → ${items.length} items`)
    return items.map(item => ({
      source: 'ai_hype',
      actor_run_id: runId,
      title: item.title || item.name || '',
      url: item.url || item.link || null,
      description: item.description || item.summary || null,
      published_at: item.date ? new Date(item.date).toISOString() : null,
      relevance_score: Math.min((item.stars || item.score || 0) / 10_000, 1),
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  AI Hype Tracker: ${err.message}`)
    return []
  }
}

async function fetchTikTokTrends(log) {
  const queries = CF2_TIKTOK_QUERIES.length ? CF2_TIKTOK_QUERIES : ['finance investing', 'stock market tips', 'crypto market']
  const items = []
  for (const query of queries.slice(0, 3)) {
    try {
      const { items: posts, runId } = await runAndCollect(
        ACTORS.TIKTOK_SCRAPER,
        { searchQuery: query, maxItems: 20, type: 'search' },
        { timeoutMs: 120_000 },
      )
      for (const post of posts) {
        if (!post.text && !post.desc && !post.description) continue
        items.push({
          source: 'tiktok',
          actor_run_id: runId,
          title: post.text || post.desc || post.description || '',
          url: post.webVideoUrl || post.url || (post.id ? `https://tiktok.com/@${post.authorMeta?.name}/video/${post.id}` : null),
          description: `Views: ${post.playCount || 0} | Likes: ${post.diggCount || 0}`,
          published_at: post.createTime ? new Date(post.createTime * 1000).toISOString() : null,
          relevance_score: Math.min((post.playCount || 0) / 5_000_000, 1),
        })
      }
      log(`TikTok "${query}" → ${posts.length} posts`)
    } catch (err) {
      log(`⚠️  TikTok "${query}": ${err.message}`)
    }
  }
  return items
}

async function fetchCryptoNews(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.CRYPTO_NEWS,
      { searchQuery: 'Bitcoin Ethereum crypto market', maxItems: 20 },
      { timeoutMs: 120_000 },
    )
    log(`Crypto News → ${items.length} articles`)
    return items.map(item => ({
      source: 'crypto_news',
      actor_run_id: runId,
      title: item.title || item.headline || '',
      url: item.url || item.link || null,
      description: item.body?.slice(0, 500) || item.description || item.summary || null,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      relevance_score: 0.7,
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Crypto News: ${err.message}`)
    return []
  }
}

async function fetchSocialTrends(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.SOCIAL_TRENDS,
      { topic: 'finance investing wealth', platforms: ['youtube', 'tiktok', 'twitter'], maxItems: 20 },
      { timeoutMs: 180_000 },
    )
    log(`Social Trends 6-in-1 → ${items.length} trends`)
    return items.map(item => ({
      source: 'social_trends',
      actor_run_id: runId,
      title: item.title || item.hashtag || item.trend || '',
      url: item.url || null,
      description: item.summary || item.analysis || item.description || null,
      published_at: item.date ? new Date(item.date).toISOString() : null,
      relevance_score: item.engagementScore ? Math.min(item.engagementScore / 100, 1) : 0.6,
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Social Trends: ${err.message}`)
    return []
  }
}

async function fetchMarketIntelligence(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.MARKET_INTEL,
      { topics: ['S&P 500', 'Federal Reserve', 'interest rates', 'inflation', 'earnings'], maxItems: 20 },
      { timeoutMs: 120_000 },
    )
    log(`Market Intelligence → ${items.length} analyses`)
    return items.map(item => ({
      source: 'market_intel',
      actor_run_id: runId,
      title: item.title || item.headline || '',
      url: item.url || null,
      description: item.summary || item.analysis || null,
      published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      relevance_score: item.sentimentScore ? Math.abs(item.sentimentScore) : 0.7,
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Market Intelligence: ${err.message}`)
    return []
  }
}

export async function run(log = console.log) {
  log('[cf2-intelligence] start')
  const started = Date.now()

  const [rssTopics, ytTopics, redditTopics, aiHypeTopics, marketTopics, tiktokTopics, cryptoTopics, socialTrends] = await Promise.all([
    fetchRssTopics(log),
    fetchYouTubeTrending(log),
    fetchRedditTopics(log),
    fetchAIHypeTopics(log),
    fetchMarketIntelligence(log),
    fetchTikTokTrends(log),
    fetchCryptoNews(log),
    fetchSocialTrends(log),
  ])

  const allTopics = [...rssTopics, ...ytTopics, ...redditTopics, ...aiHypeTopics, ...marketTopics, ...tiktokTopics, ...cryptoTopics, ...socialTrends]
    .filter(t => t.title)

  if (allTopics.length) {
    const { error } = await db().from('cf2_topic_feed').insert(allTopics)
    if (error) log(`⚠️  Topic feed insert: ${error.message}`)
    else log(`✓ ${allTopics.length} topics opgeslagen in cf2_topic_feed`)
  }

  await scrapeCompetitorTranscripts(log)

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, {
    topics: allTopics.length,
    rss: rssTopics.length,
    youtube: ytTopics.length,
    reddit: redditTopics.length,
    ai_hype: aiHypeTopics.length,
    market: marketTopics.length,
    tiktok: tiktokTopics.length,
    crypto: cryptoTopics.length,
    social_trends: socialTrends.length,
    ms,
  })
  log(`[cf2-intelligence] klaar in ${ms}ms — ${allTopics.length} topics (RSS:${rssTopics.length} YT:${ytTopics.length} Reddit:${redditTopics.length} AI:${aiHypeTopics.length} Market:${marketTopics.length} TikTok:${tiktokTopics.length} Crypto:${cryptoTopics.length} Social:${socialTrends.length})`)
  return { topics: allTopics.length }
}
