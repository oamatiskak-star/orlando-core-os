import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'
import { radarWindowOpen } from '@/lib/acq/radar-window'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/permit-source
// Schedule: 10 4 * * * (dagelijks 04:10, binnen acq_radar-venster, vóór permit-scan 04:40)
//
// BRON: vult acq_permits met NL omgevingsvergunning-bekendmakingen. Vult het gat:
// permit-scan/PermitAI SCOORT alleen — er was geen bron die vergunningen inserteerde,
// waardoor acq_permits leeg bleef en permit-scan altijd op 'no_unscored_permits' skipte.
//
// Bron = Google News RSS (zelfde pragmatische patroon als bouw-scan/distress-scan).
// relevance_score blijft null → permit-scan pakt ze op.

const PERMIT_FEEDS = [
  'https://news.google.com/rss/search?q=omgevingsvergunning+verleend+nieuwbouw+nederland&hl=nl&gl=NL&ceid=NL:nl',
  'https://news.google.com/rss/search?q=omgevingsvergunning+aangevraagd+appartementen+OR+transformatie&hl=nl&gl=NL&ceid=NL:nl',
  'https://news.google.com/rss/search?q=bouwvergunning+OR+sloopvergunning+verleend+nederland&hl=nl&gl=NL&ceid=NL:nl',
]

const PROVINCES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant', 'Gelderland', 'Overijssel', 'Friesland', 'Groningen', 'Drenthe', 'Zeeland', 'Limburg', 'Flevoland']
const CITIES = ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Leiden', 'Haarlem', 'Maastricht', 'Zaandam', 'Arnhem', 'Amersfoort', 'Apeldoorn', 'Enschede', 'Delft', 'Dordrecht', 'Zwolle', 'Alkmaar', 'Hilversum', 'Deventer', 'Venlo']

interface PermitRow {
  municipality: string
  address: string | null
  permit_type: string | null
  object_type: string | null
  submitted_at: string | null
  source_url: string | null
  notes: string | null
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function decodeXML(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []
  return items.map((item) => ({
    title:       decodeXML(extractTag(item, 'title')),
    link:        extractTag(item, 'link') || extractTag(item, 'guid'),
    description: decodeXML(extractTag(item, 'description')),
    pubDate:     extractTag(item, 'pubDate'),
  }))
}

function findMunicipality(text: string): string | null {
  for (const c of CITIES) if (text.includes(c)) return c
  for (const p of PROVINCES) if (text.includes(p)) return p
  return null
}

function permitType(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('sloop')) return 'sloopvergunning'
  if (t.includes('transformati') || t.includes('herbestemm')) return 'transformatie'
  if (t.includes('nieuwbouw')) return 'nieuwbouw'
  if (t.includes('verbouw') || t.includes('renovati')) return 'verbouwing'
  if (t.includes('omgevingsvergunning')) return 'omgevingsvergunning'
  if (t.includes('bouwvergunning')) return 'bouwvergunning'
  return null
}

function objectType(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('appartement') || t.includes('woning')) return 'woningbouw'
  if (t.includes('kantoor')) return 'kantoor'
  if (t.includes('bedrijf') || t.includes('loods') || t.includes('hal')) return 'bedrijfsruimte'
  return null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Heartbeat-on-fire: bewijs dat de cron draaide, óók als hij hierna correct skipt.
  await reportHeartbeat('cron.vercel.acquisition.permit-source').catch(() => {})

  if (!(await radarWindowOpen('permit-source'))) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'buiten_planner_venster' })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Scrape bronnen
  const found: PermitRow[] = []
  for (const url of PERMIT_FEEDS) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/rss+xml, text/xml, */*', 'User-Agent': 'Mozilla/5.0 (compatible; OrlandoAcqBot/1.0)' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) { console.error(`Permit RSS ${res.status} from ${url}`); continue }
      const xml = await res.text()

      for (const item of extractItems(xml).slice(0, 25)) {
        const fullText = `${item.title} ${item.description}`
        if (!/vergunning|bouw|nieuwbouw|sloop|transformati|verbouw/i.test(fullText)) continue
        const municipality = findMunicipality(fullText)
        if (!municipality) continue // municipality is NOT NULL — sla over zonder gemeente

        found.push({
          municipality,
          address:      item.title.slice(0, 200),
          permit_type:  permitType(fullText),
          object_type:  objectType(fullText),
          submitted_at: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : null,
          source_url:   item.link || null,
          notes:        item.title.slice(0, 200),
        })
      }
    } catch (err) {
      console.error(`Permit feed ${url} failed:`, (err as Error).message)
    }
  }

  if (found.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_permits_found', duration_ms: Date.now() - startedAt })
  }

  // Dedup op source_url tegen bestaande acq_permits
  const { data: existing } = await admin
    .from('acq_permits')
    .select('source_url')
    .not('source_url', 'is', null)
  const seen = new Set((existing ?? []).map((r) => r.source_url as string))

  // Dedup binnen deze run + tegen bestaande
  const byUrl = new Map<string, PermitRow>()
  for (const p of found) {
    const key = p.source_url ?? `${p.municipality}|${p.address}`
    if (seen.has(key)) continue
    if (!byUrl.has(key)) byUrl.set(key, p)
  }
  const toInsert = [...byUrl.values()]

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'all_duplicates', found: found.length, duration_ms: Date.now() - startedAt })
  }

  const { data: inserted, error } = await admin
    .from('acq_permits')
    .insert(toInsert.map((p) => ({
      municipality: p.municipality,
      address:      p.address,
      permit_type:  p.permit_type,
      object_type:  p.object_type,
      submitted_at: p.submitted_at,
      source_url:   p.source_url,
      notes:        p.notes,
      status:       'aangevraagd',
    })))
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok:          true,
    inserted:    (inserted ?? []).length,
    found:       found.length,
    duration_ms: Date.now() - startedAt,
  })
}
