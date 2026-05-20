import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/trend-scan
// Schedule: zie vercel.json.
// Beveiligd via Bearer CRON_SECRET.
//
// Extract trending keywords (1-3 word phrases) uit titels van recente
// viral_opportunities (laatste 24u). Aggregeert per region en bouwt
// trend_scanner_signals records met source='youtube_trending' en
// momentum = sum(view_velocity) van bron-videos.
//
// Geen externe API call — zuiver afgeleid van viral_opportunities data.
// Vereist dat viral-scan recent gedraaid heeft.

const STOPWORDS = new Set([
  // English
  'the','a','an','and','or','but','if','then','that','this','these','those','of','for','to','in','on','at',
  'by','with','from','as','is','are','was','were','be','been','being','it','its','your','our','my','his','her',
  'they','them','i','you','we','he','she','do','did','does','have','has','had','will','would','can','could',
  'should','may','might','not','no','yes','so','too','very','official','full','episode','part','live','new',
  'video','vlog','watch','today','vs','ft','feat','featuring',
  // Dutch
  'de','het','een','en','of','maar','als','dan','dat','dit','deze','die','van','voor','in','op','aan',
  'met','door','is','zijn','was','waren','wordt','worden','het','hij','zij','ze','wij','jij','jullie',
  'ik','niet','wel','geen','ja','nee','zo','heel','officieel','aflevering','seizoen','nieuw','video',
  // generic noise
  'episode','season','trailer','teaser','reaction','remix','live','full','official','original',
])

function extractNGrams(text: string, n = 2): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9À-ſ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '))
  }
  if (n === 1) return tokens
  return ngrams
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Laatste 24u aan viral_opportunities
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { data: opps, error: oppErr } = await admin
    .from('viral_opportunities')
    .select('title, raw_payload, view_velocity, language')
    .gte('captured_at', since)
    .eq('source_platform', 'youtube')

  if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 })
  if (!opps || opps.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'no_viral_opportunities_in_last_24h',
    })
  }

  // Aggregeer keywords per region
  type Acc = { keyword: string; momentum: number; region: string; count: number; titles: string[] }
  const buckets = new Map<string, Acc>()

  for (const o of opps) {
    const region = ((o.raw_payload as { region?: string } | null)?.region ?? 'global').toString()
    const text = (o.title as string) ?? ''
    const velocity = Number(o.view_velocity ?? 0)
    if (!text || velocity <= 0) continue

    const bigrams = extractNGrams(text, 2)
    const unigrams = extractNGrams(text, 1)
    const phrases = [...new Set([...bigrams, ...unigrams])]

    for (const kw of phrases) {
      const key = `${region}|${kw}`
      const acc = buckets.get(key) ?? { keyword: kw, momentum: 0, region, count: 0, titles: [] }
      acc.momentum += velocity
      acc.count += 1
      if (acc.titles.length < 3) acc.titles.push(text.slice(0, 100))
      buckets.set(key, acc)
    }
  }

  // Filter: minstens 2 hits en sorteer top-200 op momentum
  const ranked = [...buckets.values()]
    .filter((a) => a.count >= 2)
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 200)

  if (ranked.length === 0) {
    return NextResponse.json({ ok: true, signals: 0, reason: 'no_repeating_phrases' })
  }

  const now = new Date().toISOString()
  const rows = ranked.map((a) => ({
    source:      'youtube_trending',
    keyword:     a.keyword,
    momentum:    Number(a.momentum.toFixed(2)),
    region:      a.region,
    raw_payload: { count: a.count, sample_titles: a.titles },
    captured_at: now,
  }))

  let inserted = 0
  const chunkSize = 100
  const errors: Record<string, string> = {}
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await admin.from('trend_scanner_signals').insert(chunk)
    if (error) errors[`chunk_${i}`] = error.message
    else inserted += chunk.length
  }

  return NextResponse.json({
    ok: Object.keys(errors).length === 0,
    source_opportunities: opps.length,
    signals: inserted,
    top: ranked.slice(0, 10).map((a) => ({ keyword: a.keyword, region: a.region, momentum: Math.round(a.momentum), count: a.count })),
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    duration_ms: Date.now() - startedAt,
  })
}
