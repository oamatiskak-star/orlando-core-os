import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      if (d.includes('T')) return new Date(d.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toISOString()
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

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Haal iCloud verbinding op
  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('email, access_token')
    .eq('provider', 'icloud')
    .eq('status', 'connected')
    .single()

  if (!conn) return NextResponse.json({ events: [], connected: false })

  const appleId     = conn.email
  const appPassword = conn.access_token
  const credentials = Buffer.from(`${appleId}:${appPassword}`).toString('base64')

  // Bepaal datumbereik (huidige maand ± 2 maanden)
  const now   = new Date()
  const from  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to    = new Date(now.getFullYear(), now.getMonth() + 3, 0)

  const toICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

  // REPORT request voor events
  const calendarReportXml = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${toICSDate(from)}" end="${toICSDate(to)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`

  try {
    // iCloud CalDAV home URL
    const calUrl = `https://caldav.icloud.com/${appleId.split('@')[0]}/calendars/home/`

    const res = await fetch(calUrl, {
      method: 'REPORT',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1',
      },
      body: calendarReportXml,
    })

    if (!res.ok) {
      return NextResponse.json({ events: [], connected: true, error: `CalDAV ${res.status}` })
    }

    const xml  = await res.text()
    // Extract VCALENDAR blocks from XML response
    const icsBlocks = xml.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g) ?? []
    const events    = icsBlocks.flatMap(ics => parseICS(ics))

    return NextResponse.json({ events, connected: true })
  } catch (err) {
    return NextResponse.json({ events: [], connected: true, error: String(err) })
  }
}
