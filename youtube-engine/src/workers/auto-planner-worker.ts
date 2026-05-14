import cron from 'node-cron'
import { getSupabase } from '../lib/supabase'
import { workerLogger } from '../lib/logger'

const log = workerLogger('auto-planner')

// 6 uploads per dag per kanaal — spread over the day to avoid overlap
const CHANNEL_SCHEDULE: Record<string, { hours: number[]; horizonDays: number }> = {
  VermogenTv:         { hours: [6, 9, 12, 15, 18, 21],  horizonDays: 30 },
  PropertyInvestorTv: { hours: [7, 10, 13, 16, 19, 22], horizonDays: 30 },
  VastgoedTv:         { hours: [6, 9, 12, 15, 18, 21],  horizonDays: 30 },
  SpaarTv:            { hours: [7, 10, 13, 16, 19, 22], horizonDays: 30 },
  CryptoVermogen:     { hours: [8, 11, 14, 17, 20, 23], horizonDays: 30 },
  BeleggingsTv:       { hours: [8, 11, 14, 17, 20, 23], horizonDays: 30 },
}

// Generate new slots when fewer than this many days of buffer remain
const MIN_BUFFER_DAYS = 7

async function runAutoPlanner(): Promise<void> {
  const db = getSupabase()

  const { data: channels } = await db
    .from('youtube_channels')
    .select('id, naam')
    .order('naam')

  if (!channels?.length) return

  const now = new Date()
  let totalCreated = 0

  for (const ch of channels) {
    const schedule = CHANNEL_SCHEDULE[ch.naam]
    if (!schedule) {
      log.debug(`Geen schema voor kanaal ${ch.naam}, overgeslagen`)
      continue
    }

    const slotsPerDay = schedule.hours.length
    const minBuffer   = MIN_BUFFER_DAYS * slotsPerDay

    // Count existing future slots (planned + queued, both count as buffered)
    const { count: futureCount } = await db
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .in('status', ['planned', 'queued'])
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', now.toISOString())

    if ((futureCount ?? 0) >= minBuffer) continue

    // Load all existing future timestamps to avoid duplicates
    const horizonEnd = new Date(now.getTime() + schedule.horizonDays * 86_400_000)

    const { data: existing } = await db
      .from('youtube_upload_queue')
      .select('scheduled_publish_at')
      .eq('channel_id', ch.id)
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', now.toISOString())
      .lte('scheduled_publish_at', horizonEnd.toISOString())

    // Index by "YYYY-MM-DDTHH" to deduplicate per hour
    const existingKeys = new Set(
      (existing ?? []).map(e => new Date(e.scheduled_publish_at!).toISOString().slice(0, 13))
    )

    const newSlots: Array<{
      channel_id:           string
      title:                string
      scheduled_publish_at: string
      status:               string
      priority:             number
    }> = []

    for (let day = 0; day < schedule.horizonDays; day++) {
      for (const hour of schedule.hours) {
        const slot = new Date(now)
        slot.setDate(slot.getDate() + day)
        slot.setHours(hour, 0, 0, 0)

        if (slot <= now) continue
        if (slot > horizonEnd) continue

        const key = slot.toISOString().slice(0, 13)
        if (existingKeys.has(key)) continue

        const label = slot.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
        newSlots.push({
          channel_id:           ch.id,
          title:                `${ch.naam} — ${label} ${String(hour).padStart(2, '0')}:00`,
          scheduled_publish_at: slot.toISOString(),
          status:               'planned',
          priority:             5,
        })
      }
    }

    if (newSlots.length === 0) continue

    // Insert in batches of 200
    for (let i = 0; i < newSlots.length; i += 200) {
      const { error } = await db
        .from('youtube_upload_queue')
        .insert(newSlots.slice(i, i + 200))

      if (error) {
        log.error(`Slot insert mislukt voor ${ch.naam}`, { error: error.message })
        break
      }
    }

    log.info(`${ch.naam}: ${newSlots.length} nieuwe slots aangemaakt (buffer was ${futureCount ?? 0})`)
    totalCreated += newSlots.length
  }

  if (totalCreated > 0) {
    log.info(`Auto-planner klaar: ${totalCreated} slots aangemaakt over alle kanalen`)
  }
}

export function startAutoPlanner(): void {
  log.info('Auto-planner worker gestart — 6 slots/dag per kanaal, 30d horizon, 7d buffer')

  // Run immediately on startup
  runAutoPlanner().catch(err => log.error('Startup run mislukt', { error: (err as Error).message }))

  // Then every 15 minutes
  cron.schedule('*/15 * * * *', () =>
    runAutoPlanner().catch(err => log.error('Scheduled run mislukt', { error: (err as Error).message }))
  )
}
