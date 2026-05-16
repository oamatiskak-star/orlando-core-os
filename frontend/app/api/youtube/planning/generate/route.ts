import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Slot = { hour: number; type: 'longform' | 'short' }

type ChannelPlan = {
  slots: Slot[]
  horizonDays: number
  priority: 'high' | 'normal'
}

// 6 uploads per dag per kanaal — gespreide uren, 30 dagen horizon
const CHANNEL_PLANS: Record<string, ChannelPlan> = {
  VermogenTv:         { horizonDays: 30, priority: 'normal', slots: [
    { hour: 6, type: 'longform' }, { hour: 9,  type: 'longform' },
    { hour: 12, type: 'longform' }, { hour: 15, type: 'longform' },
    { hour: 18, type: 'longform' }, { hour: 21, type: 'longform' },
  ]},
  PropertyInvestorTv: { horizonDays: 30, priority: 'normal', slots: [
    { hour: 7, type: 'longform' }, { hour: 10, type: 'longform' },
    { hour: 13, type: 'longform' }, { hour: 16, type: 'longform' },
    { hour: 19, type: 'longform' }, { hour: 22, type: 'longform' },
  ]},
  VastgoedTv:         { horizonDays: 30, priority: 'normal', slots: [
    { hour: 6, type: 'longform' }, { hour: 9,  type: 'longform' },
    { hour: 12, type: 'longform' }, { hour: 15, type: 'longform' },
    { hour: 18, type: 'longform' }, { hour: 21, type: 'longform' },
  ]},
  SpaarTv:            { horizonDays: 30, priority: 'normal', slots: [
    { hour: 7, type: 'longform' }, { hour: 10, type: 'longform' },
    { hour: 13, type: 'longform' }, { hour: 16, type: 'longform' },
    { hour: 19, type: 'longform' }, { hour: 22, type: 'longform' },
  ]},
  CryptoVermogen:     { horizonDays: 30, priority: 'normal', slots: [
    { hour: 8, type: 'longform' }, { hour: 11, type: 'longform' },
    { hour: 14, type: 'longform' }, { hour: 17, type: 'longform' },
    { hour: 20, type: 'longform' }, { hour: 23, type: 'longform' },
  ]},
  BeleggingsTv:       { horizonDays: 30, priority: 'normal', slots: [
    { hour: 8, type: 'longform' }, { hour: 11, type: 'longform' },
    { hour: 14, type: 'longform' }, { hour: 17, type: 'longform' },
    { hour: 20, type: 'longform' }, { hour: 23, type: 'longform' },
  ]},
  AquierTv:           { horizonDays: 30, priority: 'normal', slots: [
    { hour: 9, type: 'longform' }, { hour: 13, type: 'longform' },
    { hour: 17, type: 'short'   },
  ]},
}

export async function POST() {
  const supabase = createAdminClient()

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, naam')

  if (!channels?.length) {
    return NextResponse.json({ error: 'Geen kanalen gevonden' }, { status: 400 })
  }

  const now = new Date()
  const allSlots: Array<{
    channel_id: string
    title: string
    scheduled_publish_at: string
    status: string
    privacy_status: string
  }> = []

  const summary: Array<{
    naam: string
    priority: string
    created: number
    shorts: number
    longform: number
    horizonDays: number
    perDay: number
  }> = []

  for (const ch of channels) {
    const plan = CHANNEL_PLANS[ch.naam]
    if (!plan) continue

    const horizonEnd = new Date(now.getTime() + plan.horizonDays * 24 * 60 * 60 * 1000)

    const { data: existing } = await supabase
      .from('youtube_upload_queue')
      .select('scheduled_publish_at')
      .eq('channel_id', ch.id)
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', now.toISOString())
      .lte('scheduled_publish_at', horizonEnd.toISOString())

    const existingKeys = new Set(
      (existing ?? []).map(e => new Date(e.scheduled_publish_at).toISOString().slice(0, 13))
    )

    let created = 0
    let shorts = 0
    let longform = 0

    for (let day = 0; day < plan.horizonDays; day++) {
      for (const slotDef of plan.slots) {
        const slot = new Date(now)
        slot.setDate(slot.getDate() + day)
        slot.setHours(slotDef.hour, 0, 0, 0)

        if (slot <= now) continue
        const key = slot.toISOString().slice(0, 13)
        if (existingKeys.has(key)) continue

        const label = slot.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
        const prefix = slotDef.type === 'short' ? '[Short] ' : ''
        allSlots.push({
          channel_id: ch.id,
          title: `${prefix}${ch.naam} — ${label} ${String(slotDef.hour).padStart(2, '0')}:00`,
          scheduled_publish_at: slot.toISOString(),
          status: 'planned',
          privacy_status: 'public',
        })
        created++
        if (slotDef.type === 'short') shorts++
        else longform++
      }
    }

    summary.push({
      naam: ch.naam,
      priority: plan.priority,
      created,
      shorts,
      longform,
      horizonDays: plan.horizonDays,
      perDay: plan.slots.length,
    })
  }

  if (allSlots.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'Alle slots al ingepland', summary })
  }

  for (let i = 0; i < allSlots.length; i += 200) {
    const { error } = await supabase
      .from('youtube_upload_queue')
      .insert(allSlots.slice(i, i + 200))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created: allSlots.length, summary })
}
