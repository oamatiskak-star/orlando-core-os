import type { SupabaseClient } from '@supabase/supabase-js'

// Pre-publish dedup. De bestaande dedup (frontend/app/api/youtube/dedup) draait pas NA publicatie
// en handmatig — dan staan duplicaten al live en straft het algoritme beide af (spam-signaal).
// Deze helper blokkeert near-duplicate titels VOOR upload op hetzelfde kanaal.

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\[\](){}#@!?.,;:'"\/\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function isSimilar(a: string, b: string, threshold = 0.85): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return false
  const dist = levenshtein(na, nb)
  return (1 - dist / maxLen) >= threshold
}

const LIVE_STATUSES = [
  'preparing', 'uploading', 'uploaded_pending_processing',
  'verifying', 'verified_live', 'retrying',
]

/**
 * Geeft een reden-string terug als `title` een near-duplicate is van een al-lopende/live titel
 * op hetzelfde kanaal binnen het tijdvenster; anders null. Fail-open (null) bij DB-fouten:
 * de live pijplijn mag nooit blokkeren door een DB-hiccup.
 */
export async function duplicateTitleOnChannel(
  db: SupabaseClient,
  channelId: string,
  title: string,
  excludeQueueId: string,
  windowDays = 30,
  threshold = 0.85,
): Promise<string | null> {
  if (!title || normalizeTitle(title).length < 8) return null // te kort om betrouwbaar te matchen
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  try {
    const { data, error } = await db
      .from('youtube_upload_queue')
      .select('id, title')
      .eq('channel_id', channelId)
      .in('status', LIVE_STATUSES)
      .gte('updated_at', since)
      .neq('id', excludeQueueId)
      .limit(500)
    if (error || !data) return null
    for (const row of data) {
      if (row.title && isSimilar(title, row.title, threshold)) {
        return `near-duplicate van reeds gepubliceerde titel "${String(row.title).slice(0, 60)}" (queue ${row.id})`
      }
    }
    return null
  } catch {
    return null
  }
}
