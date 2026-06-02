import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'
import { radarWindowOpen } from '@/lib/acq/radar-window'

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
// TenderNed RSS is broken (302→Drupal page); using Google News as alternative
const TENDERNED_RSS = 'https://news.google.com/rss/search?q=site:tenderned.nl+bouw+aanbesteding&hl=nl&gl=NL&ceid=NL:nl'

// CPV codes bouwwerk (prefix match)
const BOUW_CPV_PREFIXES = ['45', '71']

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

// TI values are strings per language key; AU values are arrays per language key
type TedLangString = Record<string, string>
type TedLangArray  = Record<string, string[]>

interface TedNotice {
  ND?: string
  TI?: TedLangString | string
  AU?: TedLangArray  | string
  DD?: string[] | string | null
  PC?: string[]
  RC?: string[]
}

function parseTedTitle(field: TedLangString | string | undefined): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  return field.nld ?? field.eng ?? Object.values(field)[0] ?? null
}

function parseTedAuthority(field: TedLangArray | string | undefined): string | null {
  if (!field) return null
  if (typeof field === 'string') return field
  const arr = field.nld ?? field.eng ?? Object.values(field)[0]
  if (!arr) return null
  return Array.isArray(arr) ? arr[0] : String(arr)
}

function parseTedDate(dd: string[] | string | null | undefined): string | null {
  if (!dd) return null
  const raw = Array.isArray(dd) ? dd[0] : dd
  if (!raw) return null
  try { return new Date(raw).toISOString().split('T')[0] } catch { return null }
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
      query: 'PC=45* AND RC=NLD',
      fields: ['ND', 'TI', 'AU', 'DD', 'PR', 'PC', 'RC'],
      limit: 50,
      page: 1,
    }

    const res = await fetch(TED_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`TED API ${res.status}: ${await res.text()}`)
    const data = await res.json() as { notices?: TedNotice[]; results?: TedNotice[] }

    for (const notice of (data.notices ?? data.results ?? [])) {
      const title    = parseTedTitle(notice.TI) ?? 'NL Bouw Aanbesteding'
      const cpv      = (notice.PC ?? [])[0] ?? '45000000'
      const deadline = parseTedDate(notice.DD)
      const province = (notice.RC ?? [])[0] ?? null

      results.push({
        title:           title.slice(0, 300),
        municipality:    null,
        province,
        opp_type:        mapOppType(cpv, title),
        client:          parseTedAuthority(notice.AU)?.slice(0, 200) ?? null,
        estimated_value: null,  // TED v3 doesn't expose estimated value in basic fields
        deadline,
        source:          'ted_europa',
        source_url:      notice.ND ? `https://ted.europa.eu/udl?uri=TED:NOTICE:${notice.ND}:TEXT:NL:HTML` : null,
        pipeline_stage:  'signalering',
        notes:           cpv ? `CPV: ${cpv}` : null,
      })
    }
  } catch (err) {
    console.error('TED scan failed:', (err as Error).message)
  }

  return results
}

// ── Scanner 2: TenderNed via Google News RSS ─────────────────────────────────
async function scanTenderNed(): Promise<BuildOppInsert[]> {
  const results: BuildOppInsert[] = []

  // TenderNed's native RSS is broken; Google News RSS surfaces TenderNed publications
  const sources = [
    TENDERNED_RSS,
    'https://news.google.com/rss/search?q=tenderned+bouw+aanbesteding&hl=nl&gl=NL&ceid=NL:nl',
    'https://news.google.com/rss/search?q=aanbesteding+bouwproject+nederland+2025+OR+2026&hl=nl&gl=NL&ceid=NL:nl',
  ]

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/rss+xml, text/xml, */*', 'User-Agent': 'Mozilla/5.0 (compatible; OrlandoBot/1.0)' },
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) { console.error(`TenderNed RSS ${res.status} from ${url}`); continue }
      const xml = await res.text()

      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []

      for (const item of items.slice(0, 30)) {
        const title   = decodeXML(extractTag(item, 'title'))
        const link    = extractTag(item, 'link')
        const desc    = decodeXML(extractTag(item, 'description'))
        const pubDate = extractTag(item, 'pubDate')

        // Filter: alleen bouw-gerelateerde items
        const combined = `${title} ${desc}`.toLowerCase()
        const isBouw = /bouw|verbouw|renovati|transform|sloop|aannemer|woningbouw|nieuwbouw|utiliteit|constructie|woning/.test(combined)
        if (!isBouw) continue

        // Extraheer bedrag (bijv "€ 1.250.000" of "1,2 mln")
        const valueMatch = desc.match(/[€£$]\s*([\d.,]+(?:\s*(?:mln|miljoen))?)/i)
        let estimatedValue: number | null = null
        if (valueMatch) {
          const isMln = /mln|miljoen/i.test(valueMatch[0])
          const raw = valueMatch[1].replace(/[.,\s]/g, '')
          const parsed = parseInt(raw)
          if (!isNaN(parsed)) {
            estimatedValue = isMln && parsed < 10_000 ? parsed * 1_000_000 : parsed
          }
        }

        const deadline = pubDate ? new Date(pubDate).toISOString().split('T')[0] : null
        const clientMatch = desc.match(/(?:aanbestedende dienst|opdrachtgever)[:\s]+([^\n<]{5,80})/i)
        const client = clientMatch ? clientMatch[1].trim() : null

        // Skip duplicates within this run
        if (results.some(r => r.title === title.slice(0, 300))) continue

        results.push({
          title:           title.slice(0, 300) || 'Bouw aanbesteding',
          municipality:    null,
          province:        null,
          opp_type:        mapOppType('45', title),
          client,
          estimated_value: estimatedValue,
          deadline,
          source:          'tenderned_news',
          source_url:      link || null,
          pipeline_stage:  estimatedValue && estimatedValue > 500_000 ? 'analyse' : 'signalering',
          notes:           desc.slice(0, 200) || null,
        })
      }
    } catch (err) {
      console.error(`TenderNed/News RSS scan failed (${url}):`, (err as Error).message)
    }
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

  // Heartbeat-on-fire: bewijs dat de cron draaide, óók als hij hierna correct skipt.
  await reportHeartbeat('cron.vercel.acquisition.bouw-scan').catch(() => {})

  if (!(await radarWindowOpen('bouw-scan'))) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'buiten_planner_venster' })
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

  await reportHeartbeat('cron.vercel.acquisition.bouw-scan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok:          true,
    inserted:    (inserted ?? []).length,
    ted_found:   tedOpps.length,
    tenderned_found: tenderNedOpps.length,
    duplicates_skipped: allOpps.length - toInsert.length,
    duration_ms: Date.now() - startedAt,
  })
}
