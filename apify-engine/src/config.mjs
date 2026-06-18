import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(p) {
  if (!p || !existsSync(p)) return false
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (val && process.env[m[1]] === undefined) process.env[m[1]] = val
  }
  return true
}

loadEnvFile(process.env.DOTENV_PATH)
loadEnvFile(join(__dirname, '..', '.env'))
loadEnvFile(join(__dirname, '..', '..', '.env.gh-secrets'))

export const SUPABASE_URL  = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
export const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
export const APIFY_TOKEN   = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || ''
export const PORT          = parseInt(process.env.PORT || '3012', 10)
export const REPO_ROOT     = join(__dirname, '..', '..')

export const ACTORS = {
  // Cat 1 — CF2 Intelligence
  YT_TRANSCRIPT:   process.env.ACTOR_YT_TRANSCRIPT  || 'dz_omar/youtube-transcript-metadata-extractor',
  YT_COMMENTS:     process.env.ACTOR_YT_COMMENTS    || 'dz_omar/youtube-comments-scraper',
  YT_TRENDING:     process.env.ACTOR_YT_TRENDING    || 'starvibe/youtube-scraper',
  YT_HEATMAP:      process.env.ACTOR_YT_HEATMAP     || 'epctex/youtube-video-heatmap-scraper',
  SOCIALBLADE:     process.env.ACTOR_SOCIALBLADE    || 'curious_coder/socialblade-youtube-api',
  RSS_NEWS:        process.env.ACTOR_RSS_NEWS       || 'aktech/rss-news-scraper',
  REDDIT_SEARCHER: process.env.ACTOR_REDDIT         || 'agentx/reddit-searcher',
  AI_HYPE_TRACKER: process.env.ACTOR_AI_HYPE        || 'wheat_tourist/ai-hype-tracker',
  MARKET_INTEL:    process.env.ACTOR_MARKET_INTEL   || 'visita/global-markets-intelligence',

  // Cat 2 — Vastgoed
  IMMOSCOUT24:     process.env.ACTOR_IMMOSCOUT24    || 'epctex/immobilienscout24-scraper',
  BAYUT:           process.env.ACTOR_BAYUT          || 'epctex/bayut-scraper',
  PROPERTYFINDER:  process.env.ACTOR_PROPERTYFINDER || 'epctex/propertyfinder-scraper',
  ZILLOW:          process.env.ACTOR_ZILLOW         || 'maxcopell/zillow-zip-code-search',
  NINETYNINECO:    process.env.ACTOR_99CO           || 'epctex/99co-scraper',
  ZONAPROP:        process.env.ACTOR_ZONAPROP       || 'epctex/zonaprop-scraper',
  AIRBNB:          process.env.ACTOR_AIRBNB         || 'tri_angle/airbnb-scraper',

  // Cat 4 — Aquier Leads
  B2B_LEADS:       process.env.ACTOR_B2B_LEADS      || 'dz_omar/ai-lead-extractor',
  YC_SCRAPER:      process.env.ACTOR_YC_SCRAPER     || 'epctex/y-combinator-scraper',
  GMAPS_LEADS:     process.env.ACTOR_GMAPS_LEADS    || 'easyapi/google-maps-email-extractor',
  APOLLO_LEADS:    process.env.ACTOR_APOLLO_LEADS   || 'pipelinelabs/lead-scraper-apollo-zoominfo',

  // Cat 1 — CF2 Intelligence (extra)
  TIKTOK_SCRAPER:  process.env.ACTOR_TIKTOK          || 'apidojo/tiktok-scraper',
  CRYPTO_NEWS:     process.env.ACTOR_CRYPTO_NEWS      || 'sync-network/awesome-crypto-news-scraper',
  SOCIAL_TRENDS:   process.env.ACTOR_SOCIAL_TRENDS    || 'manju4k/social-media-trend-scraper-6-in-1-ai-analysis',

  // Cat 2 — Vastgoed (extra)
  CREXI:           process.env.ACTOR_CREXI            || 'jupri/crexi',
  IMMOWELT:        process.env.ACTOR_IMMOWELT         || 'azzouzana/immowelt-de-search-results-scraper-by-search-url',
  ZUMPER:          process.env.ACTOR_ZUMPER           || 'scrapemind/zumpercom-scraper',
  NINETYNINACRES:  process.env.ACTOR_99ACRES          || 'fatihtahta/99acres-scraper',

  // Cat 4 — Aquier Leads (extra)
  LI_POSTS:        process.env.ACTOR_LI_POSTS         || 'scary_good_apis/linkedin-search-posts',
  LI_PROFILES:     process.env.ACTOR_LI_PROFILES      || 'dataweave/linkedin-profile-scraper',
  JOBS_SCRAPER:    process.env.ACTOR_JOBS_SCRAPER      || 'agentx/all-jobs-scraper',

  // Cat 5 — CF2 Distributie
  TRANSCRIPT_TO_LI: process.env.ACTOR_TRANSCRIPT_TO_LI || 'powerai/transcript-to-linkedin-posts-converter',
  VIDEO_TO_TEXT:   process.env.ACTOR_VIDEO_TO_TEXT  || 'nextapi/video-to-text',
  VIDEO_TO_SOCIAL: process.env.ACTOR_VIDEO_TO_SOCIAL || 'agentx/video-to-social-post',
  TWITTER_THREADS: process.env.ACTOR_TWITTER_THREADS || 'easyapi/twitter-thread-generator',
  FB_AD_COPY:      process.env.ACTOR_FB_AD_COPY       || 'powerai/facebook-ad-copywriter-creator',
  PODCAST_IDEAS:   process.env.ACTOR_PODCAST_IDEAS    || 'powerai/podcast-episode-ideas-creator',
}

export const CF2_NEWS_FEEDS = (process.env.CF2_NEWS_FEEDS || [
  'https://feeds.finance.yahoo.com/rss/2.0/headline',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'https://feeds.marketwatch.com/marketwatch/topstories/',
].join(',')).split(',').filter(Boolean)

export const CF2_COMPETITOR_CHANNELS = (process.env.CF2_COMPETITOR_CHANNELS || '').split(',').filter(Boolean)
export const CF2_TIKTOK_QUERIES = (process.env.CF2_TIKTOK_QUERIES || 'finance investing,stock market tips,crypto market').split(',').filter(Boolean)

export const AQUIER_LEAD_QUERIES = (process.env.AQUIER_LEAD_QUERIES || 'founder AI startup,developer SaaS tools').split(',').filter(Boolean)

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
export const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID || ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist')
}
