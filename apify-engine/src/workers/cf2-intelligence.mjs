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
import { ACTORS, CF2_NEWS_FEEDS, CF2_COMPETITOR_CHANNELS, CF2_TIKTOK_QUERIES, CF2_GOOGLE_TRENDS_KEYWORDS } from '../config.mjs'

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

async function fetchHackerNews(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.HACKER_NEWS,
      { maxItems: 30, type: 'top' },
      { timeoutMs: 120_000 },
    )
    log(`Hacker News → ${items.length} items`)
    return items.map(item => ({
      source: 'hacker_news',
      actor_run_id: runId,
      title: item.title || item.name || '',
      url: item.url || item.link || null,
      description: item.text?.slice(0, 500) || item.description || null,
      published_at: item.time ? new Date(item.time * 1000).toISOString() : null,
      relevance_score: Math.min((item.score || 0) / 1000, 1),
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Hacker News: ${err.message}`)
    return []
  }
}

async function fetchVCStartupIntel(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.VC_STARTUP_INTEL,
      { maxItems: 20, stage: 'seed,series-a' },
      { timeoutMs: 120_000 },
    )
    log(`VC Startup Intel → ${items.length} deals`)
    return items.map(item => ({
      source: 'vc_startup_intel',
      actor_run_id: runId,
      title: item.startup || item.company || item.title || '',
      url: item.url || item.sourceUrl || null,
      description: item.summary || item.description || item.round || null,
      published_at: item.date ? new Date(item.date).toISOString() : null,
      relevance_score: 0.8,
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  VC Startup Intel: ${err.message}`)
    return []
  }
}

async function fetchProductHunt(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.PRODUCT_HUNT,
      { maxItems: 20, period: 'today' },
      { timeoutMs: 120_000 },
    )
    log(`Product Hunt → ${items.length} producten`)
    return items.map(item => ({
      source: 'product_hunt',
      actor_run_id: runId,
      title: item.name || item.title || '',
      url: item.url || item.productUrl || null,
      description: item.tagline || item.description || null,
      published_at: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      relevance_score: Math.min((item.votesCount || item.upvotes || 0) / 1000, 1),
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Product Hunt: ${err.message}`)
    return []
  }
}

async function fetchGoogleTrends(log) {
  const keywords = CF2_GOOGLE_TRENDS_KEYWORDS.length
    ? CF2_GOOGLE_TRENDS_KEYWORDS
    : ['investing', 'stock market', 'AI tools', 'crypto']
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.GOOGLE_TRENDS,
      { keywords: keywords.slice(0, 5), geo: 'US', timeRange: 'now 7-d' },
      { timeoutMs: 120_000 },
    )
    log(`Google Trends → ${items.length} trends`)
    return items.map(item => ({
      source: 'google_trends',
      actor_run_id: runId,
      title: item.query || item.keyword || item.title || '',
      url: null,
      description: `Trend index: ${item.value || item.interest || 0}`,
      published_at: item.date ? new Date(item.date).toISOString() : null,
      relevance_score: Math.min((item.value || item.interest || 0) / 100, 1),
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Google Trends: ${err.message}`)
    return []
  }
}

async function fetchYouTubeTrendingPPR(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.YT_TRENDING_PPR,
      { country: 'US', category: 'Finance', maxResults: 20 },
      { timeoutMs: 120_000 },
    )
    log(`YouTube Trending PPR → ${items.length} video's`)
    return items.map(v => ({
      source: 'youtube_trending_ppr',
      actor_run_id: runId,
      title: v.title || v.name || '',
      url: v.url || (v.id ? `https://youtube.com/watch?v=${v.id}` : null),
      description: v.description || null,
      published_at: v.uploadDate ? new Date(v.uploadDate).toISOString() : null,
      relevance_score: Math.min((v.viewCount || 0) / 1_000_000, 1),
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  YouTube Trending PPR: ${err.message}`)
    return []
  }
}

async function fetchInstagramReels(log) {
  const queries = ['finance tips', 'investing advice', 'stock market']
  const items = []
  for (const query of queries.slice(0, 2)) {
    try {
      const { items: reels, runId } = await runAndCollect(
        ACTORS.IG_REELS,
        { search: query, maxResults: 15 },
        { timeoutMs: 120_000 },
      )
      for (const reel of reels) {
        if (!reel.caption && !reel.text) continue
        items.push({
          source: 'instagram_reels',
          actor_run_id: runId,
          title: (reel.caption || reel.text || '').slice(0, 200),
          url: reel.url || (reel.id ? `https://www.instagram.com/reel/${reel.id}/` : null),
          description: `Views: ${reel.videoViewCount || reel.playCount || 0} | Likes: ${reel.likesCount || 0}`,
          published_at: reel.timestamp ? new Date(reel.timestamp).toISOString() : null,
          relevance_score: Math.min((reel.videoViewCount || reel.playCount || 0) / 1_000_000, 1),
        })
      }
      log(`Instagram Reels "${query}" → ${reels.length} reels`)
    } catch (err) {
      log(`⚠️  Instagram Reels "${query}": ${err.message}`)
    }
  }
  return items
}

async function fetchGoogleSERP(log) {
  const queries = ['best investment strategies 2025', 'AI finance tools', 'passive income ideas']
  const items = []
  for (const query of queries.slice(0, 2)) {
    try {
      const { items: results, runId } = await runAndCollect(
        ACTORS.GOOGLE_SERP,
        { queries: [query], maxPagesPerQuery: 1, resultsPerPage: 10 },
        { timeoutMs: 120_000 },
      )
      for (const r of results) {
        if (!r.title) continue
        items.push({
          source: 'google_serp',
          actor_run_id: runId,
          title: r.title,
          url: r.url || r.link || null,
          description: r.description || r.snippet || null,
          published_at: null,
          relevance_score: r.position ? Math.max(1 - r.position / 10, 0.1) : 0.5,
        })
      }
      log(`Google SERP "${query}" → ${results.length} resultaten`)
    } catch (err) {
      log(`⚠️  Google SERP "${query}": ${err.message}`)
    }
  }
  return items
}

async function fetchGoogleNews(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.GOOGLE_NEWS,
      { query: 'finance investing stock market', maxItems: 30, language: 'en' },
      { timeoutMs: 120_000 },
    )
    log(`Google News → ${items.length} artikelen`)
    return items.map(item => ({
      source: 'google_news',
      actor_run_id: runId,
      title: item.title || item.headline || '',
      url: item.url || item.link || null,
      description: item.description || item.snippet || null,
      published_at: item.publishedAt || item.pubDate ? new Date(item.publishedAt || item.pubDate).toISOString() : null,
      relevance_score: 0.7,
    })).filter(t => t.title)
  } catch (err) {
    log(`⚠️  Google News: ${err.message}`)
    return []
  }
}

export async function run(log = console.log) {
  log('[cf2-intelligence] start')
  const started = Date.now()

  const [
    rssTopics, ytTopics, redditTopics, aiHypeTopics, marketTopics,
    tiktokTopics, cryptoTopics, socialTrends,
    hnTopics, vcTopics, phTopics, gtTopics, ytPprTopics, igTopics, serpTopics, gnTopics,
  ] = await Promise.all([
    fetchRssTopics(log),
    fetchYouTubeTrending(log),
    fetchRedditTopics(log),
    fetchAIHypeTopics(log),
    fetchMarketIntelligence(log),
    fetchTikTokTrends(log),
    fetchCryptoNews(log),
    fetchSocialTrends(log),
    fetchHackerNews(log),
    fetchVCStartupIntel(log),
    fetchProductHunt(log),
    fetchGoogleTrends(log),
    fetchYouTubeTrendingPPR(log),
    fetchInstagramReels(log),
    fetchGoogleSERP(log),
    fetchGoogleNews(log),
  ])

  const allTopics = [
    ...rssTopics, ...ytTopics, ...redditTopics, ...aiHypeTopics, ...marketTopics,
    ...tiktokTopics, ...cryptoTopics, ...socialTrends,
    ...hnTopics, ...vcTopics, ...phTopics, ...gtTopics, ...ytPprTopics, ...igTopics, ...serpTopics, ...gnTopics,
  ].filter(t => t.title)

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
    hacker_news: hnTopics.length,
    vc_intel: vcTopics.length,
    product_hunt: phTopics.length,
    google_trends: gtTopics.length,
    yt_ppr: ytPprTopics.length,
    ig_reels: igTopics.length,
    google_serp: serpTopics.length,
    google_news: gnTopics.length,
    ms,
  })
  log(`[cf2-intelligence] klaar in ${ms}ms — ${allTopics.length} topics (RSS:${rssTopics.length} YT:${ytTopics.length} Reddit:${redditTopics.length} AI:${aiHypeTopics.length} Market:${marketTopics.length} TikTok:${tiktokTopics.length} Crypto:${cryptoTopics.length} Social:${socialTrends.length} HN:${hnTopics.length} VC:${vcTopics.length} PH:${phTopics.length} GT:${gtTopics.length} YT-PPR:${ytPprTopics.length} IG:${igTopics.length} SERP:${serpTopics.length} GNews:${gnTopics.length})`)
  return { topics: allTopics.length }
}
