import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/bouw-scan
// Schedule: 0 6 * * * (dagelijks 06:00)
//
// Combineert 2 publieke bronnen:
//   1. TED Europa API (eu-aanbestedingen NL bouw, CPV 45*)
//   2. TenderNed open data RSS feed (NL aanbestedingen, bouw filter)
//
// Deduplicatie via source_url. Inserts → acq_build_opps.
// Hoge-budget items (>€500k) krijgen pipeline_stage='analyse'.

const TED_API = 'https://api.ted.europa.eu/v3/notices/search'
const TENDERNED_RSS = 'https://www.tenderned.nl/tenders.rss'

// CPV codes bouwwerk (prefix match)
const BOUW_CPV_PREFIXES = ['45', '71', '72251']

// Werk-typen mapping
function mapOppType(cpv: string, title: string): string {
  const t = title.toLowerCase()
  if (t.includes('renovati') || t.includes('verbouw')) return 'renovatie'
  if (t.includes('sloop')) return 'sloop-nieuwbouw'
  if (t.includes('transformati') || t.includes('herbestemm')) return 'transformatie'
  if (t.includes('uitbouw') || t.includes('aanbouw')) return 'uitbouw'
  if (cpv.startsWith('71')) return 'nieuwbouw'  // architect/engineering
  return 'nieuwbouw'
}

interface TedNotice {
  ND?: string
  TI?: string
  MA?: string
  AU?: string
  DD?: string
  PR?: { Value?: string; Currency?: string }[]
  PC?: string[]
  CY?: string
  RC?: string[]
  AA?: string
  DI?: string
}

interface BuildOppInsert {
  title: string
  municipality: string | null
  province: string | null
  opp_type: string
  client: string | null
  estimated_value: number | null
  deadline: string | null
  source: string
  source_url: string | null
  pipeline_stage: string
  notes: string | null
}

// ── Scanner 1: TED Europa API ────────────────────────────────────────────────
async function scanTED(): Promise<BuildOppInsert[]> {
  const results: BuildOppInsert[] = []

  try {
    const body = {
      query: 'ND=NL AND CY=NL',
      fields: ['ND', 'TI', 'MA', 'AU', 'DD', 'PR', 'PC', 'CY', 'RC', 'AA', 'DI'],
      filters: [
        { field: 'CY', values: ['NL'] },
        { field: 'PC', values: BOUW_CPV_PREFIXES.map(p => `${p}*`) },
      ],
      sort: { field: 'DD', order: 'desc' },
      limit: 50,
      page: 1,
    }

    const res = await fetch(TED_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`TED API ${res.status}`)
    const data = await res.json() as { results?: TedNotice[] }

    for (const notice of data.results ?? []) {
      const title = notice.TI ?? notice.MA ?? 'Onbekende aanbesteding'
      const cpv   = (notice.PC ?? [])[0] ?? '45000000'
      const value = (notice.PR ?? [])[0]?.Value ? parseFloat(String((notice.PR ?? [])[0].Value!)) : null
      const deadline = notice.DD ? new Date(notice.DD).toISOString().split('T')[0] : null
      const province = (notice.RC ?? [])[0] ?? null

      results.push({
        title:           String(title).slice(0, 300),
        municipality:    null,
        province,
        opp_type:        mapOppType(cpv, String(title)),
        client:          notice.AU ? String(notice.AU).slice(0, 200) : null,
        estimated_value: value,
        deadline,
        source:          'ted_europa',
        source_url:      notice.ND ? `https://ted.europa.eu/udl?uri=TED:NOTICE:${notice.ND}:TEXT:NL:HTML` : null,
        pipeline_stage:  value && value > 500_000 ? 'analyse' : 'signalering',
        notes:           cpv ? `CPV: ${cpv}` : null,
      })
    }
  } catch (err) {
    console.error('TED scan failed:', (err as Error).message)
  }

  return results
}

// ── Scanner 2: TenderNed RSS ─────────────────────────────────────────────────
async function scanTenderNed(): Promise<BuildOppInsert[]> {
  const results: BuildOppInsert[] = []

  try {
    const res = await fetch(TENDERNED_RSS, {
      headers: { 'Accept': 'application/rss+xml, text/xml, */*', 'User-Agent': 'Mozilla/5.0 (compatible; OrlandoBot/1.0)' },
    })

    if (!res.ok) throw new Error(`TenderNed RSS ${res.status}`)
    const xml = await res.text()

    // Eenvoudige XML parser (geen externe lib nodig voor RSS)
    const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []

    for (const item of items.slice(0, 50)) {
      const title      = decodeXML(extractTag(item, 'title'))
      const link       = extractTag(item, 'link')
      const desc       = decodeXML(extractTag(item, 'description'))
      const pubDate    = extractTag(item, 'pubDate')

      // Filter: alleen bouw-gerelateerde items
      const isBouw = BOUW_CPV_PREFIXES.some(p =>
        desc.includes(`CPV: ${p}`) || desc.includes(`cpv ${p}`) ||
        title.toLowerCase().match(/bouw|verbouw|renovati|transform|sloop|aannemer|woningbouw|nieuwbouw|utiliteit/)
      )
      if (!isBouw) continue

      // Extraheer bedrag als aanwezig (bijv "€ 1.250.000")
      const valueMatch = desc.match(/[€£$]\s*([\d.,]+(?:\s*mln)?)/i)
      let estimatedValue: number | null = null
      if (valueMatch) {
        const raw = valueMatch[1].replace(/[.,\s]/g, '')
        estimatedValue = isNaN(parseInt(raw)) ? null : parseInt(raw)
        if (desc.toLowerCase().includes('mln') && estimatedValue && estimatedValue < 10_000) {
          estimatedValue *= 1_000_000
        }
      }

      const deadline = pubDate ? new Date(pubDate).toISOString().split('T')[0] : null

      // Opdrachtgever uit description of title
      const clientMatch = desc.match(/(?:aanbestedende dienst|opdrachtgever)[:\s]+([^\n<]{5,80})/i)
      const client = clientMatch ? clientMatch[1].trim() : null

      results.push({
        title:           title.slice(0, 300) || 'TenderNed aanbesteding',
        municipality:    null,
        province:        null,
        opp_type:        mapOppType('45', title),
        client,
        estimated_value: estimatedValue,
        deadline,
        source:          'tenderned',
        source_url:      link || null,
        pipeline_stage:  estimatedValue && estimatedValue > 500_000 ? 'analyse' : 'signalering',
        notes:           desc.slice(0, 200) || null,
      })
    }
  } catch (err) {
    console.error('TenderNed RSS scan failed:', (err as Error).message)
  }

  return results
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function decodeXML(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .trim()
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Haal bestaande source_urls op om te dedupliceren
  const { data: existing } = await admin
    .from('acq_build_opps')
    .select('source_url')
    .not('source_url', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString())

  const existingUrls = new Set((existing ?? []).map(r => r.source_url as string))

  // Scan alle bronnen parallel
  const [tedOpps, tenderNedOpps] = await Promise.all([
    scanTED(),
    scanTenderNed(),
  ])

  const allOpps = [...tedOpps, ...tenderNedOpps]

  // Filter duplicaten
  const toInsert = allOpps.filter(o => !o.source_url || !existingUrls.has(o.source_url))

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_new_opps', ted: tedOpps.length, tenderned: tenderNedOpps.length, duration_ms: Date.now() - startedAt })
  }

  const { data: inserted, error } = await admin
    .from('acq_build_opps')
    .insert(toInsert)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok:          true,
    inserted:    (inserted ?? []).length,
    ted_found:   tedOpps.length,
    tenderned_found: tenderNedOpps.length,
    duplicates_skipped: allOpps.length - toInsert.length,
    duration_ms: Date.now() - startedAt,
  })
}
