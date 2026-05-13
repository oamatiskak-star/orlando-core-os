import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .limit(1)
    .single()

  if (!conn?.access_token) {
    return NextResponse.json({ connected: false, calendars: [] })
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${conn.access_token}` },
  })
  const data = await res.json()

  return NextResponse.json({
    connected: true,
    email:     conn.email,
    calendars: (data.items ?? []).map((c: Record<string, unknown>) => ({
      id:       c.id,
      name:     c.summary,
      color:    c.backgroundColor ?? '#4285f4',
      primary:  c.primary ?? false,
      selected: (conn.selected_calendar_ids as string[] ?? []).includes(c.id as string)
                || (!(conn.selected_calendar_ids as string[])?.length && c.primary),
    })),
  })
}

export async function POST(request: NextRequest) {
  const { calendarIds } = await request.json() as { calendarIds: string[] }
  const supabase = createAdminClient()
  await supabase
    .from('google_calendar_connections')
    .update({ selected_calendar_ids: calendarIds, updated_at: new Date().toISOString() })
    .eq('status', 'connected')
  return NextResponse.json({ ok: true })
}
