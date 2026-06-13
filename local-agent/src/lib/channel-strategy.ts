import { createClient } from '@supabase/supabase-js'

/**
 * CHANNEL-STRATEGY LOADER (CF2 content-engine repair).
 *
 * De producer kreeg geen kanaalcontext: channel_strategy is gekoppeld aan
 * media_holding_channels.id, maar video_projects.channel_id = youtube_channels.id (ID-mismatch).
 * Deze loader resolvet het juiste pad zodat niche/topics/own_cta de generatie sturen:
 *   youtube_channels.id → media_holding_channels.youtube_channel_id → channel_strategy.channel_id
 *
 * Fail-open: geen mapping/strategy → null (dan GEEN gate/injectie, niets breekt).
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

export interface ChannelStrategy {
  niche: string | null
  topics: string[]
  own_cta: string[]
}

export async function loadChannelStrategy(youtubeChannelId?: string | null): Promise<ChannelStrategy | null> {
  if (!youtubeChannelId) return null
  const { data: mhc } = await db
    .from('media_holding_channels')
    .select('id, niche')
    .eq('youtube_channel_id', youtubeChannelId)
    .maybeSingle()
  if (!mhc?.id) return null

  const { data: cs } = await db
    .from('channel_strategy')
    .select('niche, topics, own_cta')
    .eq('channel_id', mhc.id)
    .maybeSingle()

  return {
    niche:   (cs?.niche ?? (mhc.niche as string | null) ?? null),
    topics:  Array.isArray(cs?.topics)  ? (cs!.topics  as string[]) : [],
    own_cta: Array.isArray(cs?.own_cta) ? (cs!.own_cta as string[]) : [],
  }
}

/**
 * Harde niche-gate. True = topic past bij de kanaal-niche (of geen topics gedefinieerd → fail-open).
 * Matcht op trefwoord-bevatting (topic bevat een van de kanaal-topic-keywords).
 */
export function topicMatchesNiche(topic: string, topics: string[]): boolean {
  if (!topics || topics.length === 0) return true
  const t = (topic ?? '').toLowerCase()
  return topics.some(k => k && t.includes(k.toLowerCase()))
}
