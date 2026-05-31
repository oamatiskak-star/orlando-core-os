import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Notificatie-feed voor de Topbar-bel.
// Bron 1: public.notifications (persistente feed met read-status + priority + telegram_sent).
// Bron 2: live Hermes-alarmen (v_ctl_hermes_alerts) — altijd zichtbaar zolang ze actief zijn.
export const revalidate = 0

type Item = {
  id: string
  source: 'notification' | 'hermes'
  type: string
  title: string
  message: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
  at: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: notifs }, { data: alerts }] = await Promise.all([
    admin
      .from('notifications')
      .select('id, type, title, message, priority, read, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('v_ctl_hermes_alerts')
      .select('dedup_key, severity, alert_type, titel, detail, last_seen_at'),
  ])

  const items: Item[] = []

  // Live Hermes-alarmen bovenaan (altijd "ongelezen" zolang actief)
  for (const a of (alerts ?? []) as Record<string, unknown>[]) {
    items.push({
      id: `hermes:${a.dedup_key as string}`,
      source: 'hermes',
      type: (a.alert_type as string) ?? 'hermes',
      title: (a.titel as string) ?? 'Hermes-alarm',
      message: (a.detail as string) ?? null,
      priority: a.severity === 'critical' ? 'critical' : 'high',
      read: false,
      at: a.last_seen_at as string,
    })
  }

  for (const n of (notifs ?? []) as Record<string, unknown>[]) {
    items.push({
      id: `notif:${n.id as string}`,
      source: 'notification',
      type: (n.type as string) ?? 'systeem',
      title: (n.title as string) ?? 'Notificatie',
      message: (n.message as string) ?? null,
      priority: ((n.priority as string) ?? 'medium') as Item['priority'],
      read: Boolean(n.read),
      at: n.created_at as string,
    })
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1))
  const unread = items.filter(i => !i.read).length
  return NextResponse.json({ items: items.slice(0, 40), unread })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, title, message, priority, metadata } = body
  if (!message) return NextResponse.json({ error: 'message vereist' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .insert({
      type: type ?? 'systeem',
      title: title ?? null,
      message,
      priority: priority ?? 'medium',
      metadata: metadata ?? {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notification: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action } = body
  const admin = createAdminClient()

  if (action === 'mark_all_read') {
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
