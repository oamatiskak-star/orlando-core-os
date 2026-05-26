import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/distress-scan
// Schedule: 0 7 * * * (dagelijks 07:00)
//
// Detecteert bouw-distress signalen via 3 bronnen:
//   1. FaillissementsDossier.nl RSS — failliet gegane bouwbedrijven
//   2. Rechtspraak.nl RSS — insolventieverklaringen bouw
//   3. Google RSS Alerts — "bouwproject stilgelegd" / "aannemer failliet"
//
// Failliet bouwbedrijf → acq_offmarket_leads (status=nieuw, type=faillissement)
//   → Kans: overnemen project / panden / restcontracten
// Stilgelegd bouwproject → acq_offmarket_leads (type=stilstand)
//   → Kans: aannemen als vervanger
//
// Hoge ROI-kansen (>15%) worden ook als acq_deal gezaaid met pipeline_stage=radar.

const FAILLISSEMENTEN_RSS = 'https://www.faillissementsdossier.nl/rss/faillissementen.aspx?branche=Bouwnijverheid'
const RECHTSPRAAK_RSS     = 'https://uitspraken.rechtspraak.nl/rss?subject=bestuursrecht&keyword=bouw+faillissement'
const GOOGLE_ALERT_1      = 'https://www.google.com/alerts/feeds/00000000000000000000/bouwproject+stilgelegd'
const GOOGLE_ALERT_2      = 'https://news.google.com/rss/search?q=bouwproject+faillissement+nederland&hl=nl&gl=NL&ceid=NL:nl'
const GOOGLE_ALERT_3      = 'https://news.google.com/rss/search?q=aannemer+failliet+OR+bouwbedrijf+faillissement&hl=nl&gl=NL&ceid=NL:nl'

interface DistressLead {
  address: string
  city: string | null
  province: string | null
  lead_type: string
  distress_signals: string[]
  notes: string | null
  source_url: string | null
  days_vacant: number | null
  roi_prognose: number | null
  contact_strategy: string | null
}

function extractRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []
  return items.map(item => ({
    title:       decodeXML(extractTag(item, 'title')),
    link:        extractTag(item, 'link') || extractTag(item, 'guid'),
    description: decodeXML(extractTag(item, 'description')),
    pubDate:     extractTag(item, 'pubDate'),
  }))
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function decodeXML(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Extraheer provincie/stad uit text
function extractLocation(text: string): { city: string | null; province: string | null } {
  const PROVINCES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant', 'Gelderland', 'Overijssel', 'Friesland', 'Groningen', 'Drenthe', 'Zeeland', 'Limburg', 'Flevoland']
  const CITIES    = ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Leiden', 'Haarlem', 'Maastricht', 'Zaandam', 'Arnhem', 'Amersfoort', 'Apeldoorn', 'Enschede', 'Delft', 'Dordrecht']

  let city: string | null = null
  let province: string | null = null

  for (const p of PROVINCES) {
    if (text.includes(p)) { province = p; break }
  }
  for (const c of CITIES) {
    if (text.includes(c)) { city = c; break }
  }

  return { city, province }
}

async function fetchRSS(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrlandoAcqBot/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`RSS ${res.status} from ${url}`)
  return res.text()
}

async function scanFaillissementen(): Promise<DistressLead[]> {
  const leads: DistressLead[] = []

  const sources = [
    { url: FAILLISSEMENTEN_RSS, type: 'faillissement', signals: ['faillissement', 'curator aangesteld', 'rechtbank uitspraak'] },
    { url: GOOGLE_ALERT_2,      type: 'faillissement', signals: ['faillissement bouw', 'curator', 'insolvabel'] },
    { url: GOOGLE_ALERT_3,      type: 'faillissement', signals: ['failliet verklaard', 'surseance van betaling'] },
  ]

  for (const src of sources) {
    try {
      const xml   = await fetchRSS(src.url)
      const items = extractRSSItems(xml)

      for (const item of items.slice(0, 15)) {
        const fullText = `${item.title} ${item.description}`
        const { city, province } = extractLocation(fullText)

        // Filter: alleen bouw-gerelateerd
        const isBouw = /bouw|aannemer|woningbouw|verbouw|renovati|sloper|constructie/i.test(fullText)
        if (!isBouw) continue

        // Companyname als address proxy
        const companyMatch = fullText.match(/(?:B\.?V\.?|N\.?V\.?|VOF|ZZP|Beheer|Groep)[^\n<,]{0,40}/i)
        const address = companyMatch ? companyMatch[0].trim() : item.title.slice(0, 100)

        leads.push({
          address:          address.slice(0, 200),
          city,
          province,
          lead_type:        src.type,
          distress_signals: src.signals,
          notes:            `${item.title.slice(0, 200)} — Bron: ${src.url.includes('faillissements') ? 'FaillissementsDossier' : 'Google News'}`,
          source_url:       item.link || null,
          days_vacant:      null,
          roi_prognose:     src.type === 'faillissement' ? 18.0 : null,
          contact_strategy: src.type === 'faillissement'
            ? 'Contact curator via rechtbank voor overname projecten/activa. Check TenderNed voor herbesteding.'
            : 'Direct contact met projecteigenaar over vervangend aannemerschap.',
        })
      }
    } catch (err) {
      console.error(`Distress RSS ${src.url} failed:`, (err as Error).message)
    }
  }

  return leads
}

async function scanStiligelegdeProjecten(): Promise<DistressLead[]> {
  const leads: DistressLead[] = []

  const sources = [
    { url: 'https://news.google.com/rss/search?q=bouwproject+stilgelegd+OR+stikstof+bouw+vertraging&hl=nl&gl=NL&ceid=NL:nl', type: 'stilstand', signals: ['stikstofprobleem', 'stilgelegd', 'vergunning geweigerd'] },
    { url: 'https://news.google.com/rss/search?q=PFAS+bouw+OR+bouwproject+geblokkeerd+nederland&hl=nl&gl=NL&ceid=NL:nl', type: 'stilstand', signals: ['PFAS-contaminatie', 'grond geblokkeerd', 'bouwstop'] },
  ]

  for (const src of sources) {
    try {
      const xml   = await fetchRSS(src.url)
      const items = extractRSSItems(xml)

      for (const item of items.slice(0, 10)) {
        const fullText = `${item.title} ${item.description}`
        if (!/bouw|project|woningbouw|nieuwbouw|aannemer/i.test(fullText)) continue

        const { city, province } = extractLocation(fullText)

        // Extraheer project naam
        const projectMatch = fullText.match(/(?:project|plan|bouw)[:\s]+["']?([A-Z][a-zA-Z\s]{5,40})["']?/i)
        const address = projectMatch ? projectMatch[1].trim() : item.title.slice(0, 100)

        leads.push({
          address:          address.slice(0, 200),
          city,
          province,
          lead_type:        'stilstand',
          distress_signals: src.signals,
          notes:            item.title.slice(0, 200),
          source_url:       item.link || null,
          days_vacant:      null,
          roi_prognose:     12.0,
          contact_strategy: 'Analyseer vergunningssituatie. Verken of stikstof/PFAS-oplossing mogelijk is via eigen expertise. Bied aan als rescue-aannemer.',
        })
      }
    } catch (err) {
      console.error(`Stilgelegd scan failed:`, (err as Error).message)
    }
  }

  return leads
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Haal bestaande source_urls op
  const { data: existing } = await admin
    .from('acq_offmarket_leads')
    .select('notes')
    .gte('created_at', new Date(Date.now() - 7 * 86400 * 1000).toISOString())

  // Scan parallel
  const [faillissementen, stilgelegd] = await Promise.all([
    scanFaillissementen(),
    scanStiligelegdeProjecten(),
  ])

  const allLeads = [...faillissementen, ...stilgelegd]

  if (allLeads.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_leads_found', duration_ms: Date.now() - startedAt })
  }

  // Dedupliceer op address+notes (rudimentair)
  const existingNotes = new Set((existing ?? []).map(r => (r.notes ?? '').slice(0, 50)))
  const toInsert = allLeads.filter(l => !existingNotes.has((l.notes ?? '').slice(0, 50)))

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'all_duplicates', found: allLeads.length, duration_ms: Date.now() - startedAt })
  }

  const { data: inserted, error } = await admin
    .from('acq_offmarket_leads')
    .insert(toInsert.map(l => ({
      address:          l.address,
      city:             l.city,
      province:         l.province,
      lead_type:        l.lead_type,
      distress_signals: l.distress_signals,
      notes:            l.notes,
      days_vacant:      l.days_vacant,
      roi_prognose:     l.roi_prognose,
      contact_strategy: l.contact_strategy,
      status:           'nieuw',
    })))
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await reportHeartbeat('cron.vercel.acquisition.distress-scan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok:                   true,
    inserted:             (inserted ?? []).length,
    faillissementen_found: faillissementen.length,
    stilgelegd_found:     stilgelegd.length,
    duplicates_skipped:   allLeads.length - toInsert.length,
    duration_ms:          Date.now() - startedAt,
  })
}
