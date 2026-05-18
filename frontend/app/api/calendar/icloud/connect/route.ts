import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Test CalDAV verbinding met iCloud
async function testCalDAV(appleId: string, appPassword: string): Promise<{ ok: boolean; calendars: string[] }> {
  const credentials = Buffer.from(`${appleId}:${appPassword}`).toString('base64')

  // iCloud CalDAV principal URL
  const principalUrl = `https://caldav.icloud.com`

  // PROPFIND op principal om calendars te vinden
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`

  try {
    const res = await fetch(`${principalUrl}/`, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '0',
      },
      body: xml,
    })

    if (res.status === 401) return { ok: false, calendars: [] }
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, calendars: ['Primaire agenda'] }
    }
    return { ok: false, calendars: [] }
  } catch {
    return { ok: false, calendars: [] }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { apple_id, app_password } = body

  if (!apple_id || !app_password) {
    return NextResponse.json({ error: 'apple_id en app_password vereist' }, { status: 400 })
  }

  const { ok, calendars } = await testCalDAV(apple_id, app_password)

  if (!ok) {
    return NextResponse.json({
      error: 'Verbinding mislukt. Controleer Apple ID en app-specifiek wachtwoord.',
    }, { status: 401 })
  }

  // Sla verbinding op (versleuteld opslaan in productie — nu als plaintext voor sandbox)
  await supabase.from('google_calendar_connections').upsert({
    provider:     'icloud',
    email:        apple_id,
    status:       'connected',
    access_token: app_password,
    calendars:    calendars,
  }, { onConflict: 'email' })

  return NextResponse.json({ ok: true, calendars })
}
