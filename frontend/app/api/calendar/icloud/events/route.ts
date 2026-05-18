import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function parseICS(icsText: string): Array<{
  id: string; title: string; start: string; end: string; allDay: boolean; location?: string
}> {
  const events: ReturnType<typeof parseICS> = []
  const blocks = icsText.split('BEGIN:VEVENT')

  for (const block of blocks.slice(1)) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}[^:]*:(.*)$`, 'm'))
      return match?.[1]?.replace(/\r/g, '').trim() ?? ''
    }

    const uid      = get('UID')
    const summary  = get('SUMMARY')
    const dtstart  = get('DTSTART')
    const dtend    = get('DTEND')
    const location = get('LOCATION')

    if (!uid || !summary) continue

    const parseDate = (d: string) => {
      if (!d) return new Date().toISOString()
      if (d.includes('T')) {
        // Handle timezone suffix Z or floating
        const clean = d.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7')
        return new Date(clean).toISOString()
      }
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00.000Z`
    }

    const allDay = !dtstart.includes('T')

    events.push({
      id:       uid,
      title:    summary,
      start:    parseDate(dtstart),
      end:      dtend ? parseDate(dtend) : parseDate(dtstart),
      allDay,
      location: location || undefined,
    })
  }

  return events
}

// CalDAV helpers
async function caldavRequest(url: string, method: string, headers: Record<string, string>, body?: string) {
  return fetch(url, { method, headers: { 'Content-Type': 'application/xml; charset=utf-8', ...headers }, body })
}

function extractHref(xml: string, after?: string): string | null {
  // Find href after a specific tag, or just the first href
  const pattern = after
    ? new RegExp(`<[^>]*${after}[^>]*>[^<]*<[^>]*href[^>]*>([^<]+)<`, 'i')
    : /<[^>]*href[^>]*>([^<]+)</i
  return xml.match(pattern)?.[1]?.trim() ?? null
}

function extractAllHrefs(xml: string): string[] {
  const matches = [...xml.matchAll(/<[Dd]:[Hh][Rr][Ee][Ff]>([^<]+)<\/[Dd]:[Hh][Rr][Ee][Ff]>/g)]
  return matches.map(m => m[1].trim())
}

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()

  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('email, access_token')
    .eq('provider', 'icloud')
    .eq('status', 'connected')
    .single()

  if (!conn) return NextResponse.json({ events: [], connected: false })

  const appleId     = conn.email
  const appPassword = conn.access_token
  const authHeader  = `Basic ${Buffer.from(`${appleId}:${appPassword}`).toString('base64')}`
  const baseHeaders = { 'Authorization': authHeader }

  // Date range
  const { searchParams } = req.nextUrl
  const now  = new Date()
  const from = searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to   = searchParams.get('end')   ? new Date(searchParams.get('end')!)   : new Date(now.getFullYear(), now.getMonth() + 2, 0)
  const toICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

  const reportXml = (calUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${toICSDate(from)}" end="${toICSDate(to)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`

  try {
    // Step 1: discover current-user-principal
    const step1 = await caldavRequest('https://caldav.icloud.com/', 'PROPFIND',
      { ...baseHeaders, 'Depth': '0' },
      `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`)

    if (!step1.ok) {
      return NextResponse.json({ events: [], connected: true, error: `Auth failed: ${step1.status}` })
    }

    const step1Xml = await step1.text()
    const principalPath = step1Xml.match(/<d:current-user-principal[^>]*>\s*<d:href>([^<]+)<\/d:href>/i)?.[1]?.trim()
      ?? step1Xml.match(/<[^>]*current-user-principal[^>]*>[^<]*<[^>]*href[^>]*>([^<]+)</i)?.[1]?.trim()

    if (!principalPath) {
      return NextResponse.json({ events: [], connected: true, error: 'No principal found', debug: step1Xml.slice(0, 500) })
    }

    const principalUrl = principalPath.startsWith('http') ? principalPath : `https://caldav.icloud.com${principalPath}`

    // Step 2: get calendar-home-set from principal
    const step2 = await caldavRequest(principalUrl, 'PROPFIND',
      { ...baseHeaders, 'Depth': '0' },
      `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`)

    const step2Xml = await step2.text()
    const homePath = step2Xml.match(/<[^>]*calendar-home-set[^>]*>[^<]*<[^>]*href[^>]*>([^<]+)</i)?.[1]?.trim()

    if (!homePath) {
      return NextResponse.json({ events: [], connected: true, error: 'No calendar-home-set', debug: step2Xml.slice(0, 500) })
    }

    const homeUrl = homePath.startsWith('http') ? homePath : `https://caldav.icloud.com${homePath}`

    // Step 3: list calendars in home
    const step3 = await caldavRequest(homeUrl, 'PROPFIND',
      { ...baseHeaders, 'Depth': '1' },
      `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>`)

    const step3Xml = await step3.text()

    // Extract calendar URLs (those that have calendar resourcetype)
    const calendarUrls: string[] = []
    const responseBlocks = step3Xml.split(/<d:response\b/i).slice(1)
    for (const block of responseBlocks) {
      if (/<c:calendar\b/i.test(block) || /urn:ietf:params:xml:ns:caldav.*calendar/i.test(block)) {
        const href = block.match(/<d:href>([^<]+)<\/d:href>/i)?.[1]?.trim()
        if (href) {
          calendarUrls.push(href.startsWith('http') ? href : `https://caldav.icloud.com${href}`)
        }
      }
    }

    if (calendarUrls.length === 0) {
      // Fallback: try REPORT directly on home
      calendarUrls.push(homeUrl)
    }

    // Step 4: REPORT each calendar for events
    const allEvents: ReturnType<typeof parseICS> = []
    await Promise.allSettled(
      calendarUrls.map(async calUrl => {
        const res = await caldavRequest(calUrl, 'REPORT',
          { ...baseHeaders, 'Depth': '1' },
          reportXml(calUrl))
        if (!res.ok) return
        const xml      = await res.text()
        const icsBlocks = xml.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g) ?? []
        allEvents.push(...icsBlocks.flatMap(ics => parseICS(ics)))
      })
    )

    return NextResponse.json({ events: allEvents, connected: true })
  } catch (err) {
    return NextResponse.json({ events: [], connected: true, error: String(err) })
  }
}
