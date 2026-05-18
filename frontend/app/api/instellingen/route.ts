import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const DEFAULT_PREFS = [
  { channel: 'email',    event_type: 'all',          label: 'E-mail alerts',       desc: 'Ontvang kritieke meldingen per e-mail' },
  { channel: 'telegram', event_type: 'all',          label: 'Telegram alerts',     desc: 'Stuur meldingen naar Telegram bot' },
  { channel: 'system',   event_type: 'agent_error',  label: 'Agent fouten',        desc: 'Meld fouten van alle AI-agents' },
  { channel: 'system',   event_type: 'system',       label: 'Systeem meldingen',   desc: 'Deploy events, sync status en health alerts' },
]

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)

  const result = DEFAULT_PREFS.map(def => {
    const existing = prefs?.find(p => p.channel === def.channel && p.event_type === def.event_type)
    return {
      id:         existing?.id ?? null,
      channel:    def.channel,
      event_type: def.event_type,
      label:      def.label,
      desc:       def.desc,
      enabled:    existing?.enabled ?? (def.channel === 'email' || def.event_type === 'agent_error' || def.event_type === 'system'),
    }
  })

  return NextResponse.json({ prefs: result })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { channel, event_type, enabled } = body

  if (!channel || !event_type) return NextResponse.json({ error: 'channel en event_type vereist' }, { status: 400 })

  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('user_id', user.id)
    .eq('channel', channel)
    .eq('event_type', event_type)
    .maybeSingle()

  let error
  if (existing) {
    ({ error } = await supabase
      .from('notification_preferences')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', existing.id))
  } else {
    ({ error } = await supabase
      .from('notification_preferences')
      .insert({ user_id: user.id, channel, event_type, enabled }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
