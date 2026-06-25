import cron from 'node-cron'
import { getSupabase } from '../lib/supabase'
import { notifyPlannerRun } from '../lib/notifications'
import { workerLogger } from '../lib/logger'

const log = workerLogger('auto-planner')

// Preferred hour distribution per channel — overrides auto-generated hours.
// Channels not listed here get evenly-spaced hours based on daily_upload_target.
// Cap = 1 long + 1 short/dag voor alle overige kanalen (2 slots, prime-time
// gespreid). Loop-kanalen staan NIET in de override → generateHours(daily_upload_target=6).
const CHANNEL_HOURS_OVERRIDE: Record<string, number[]> = {
  VermogenTv:         [9, 18],
  PropertyInvestorTv: [10, 19],
  VastgoedTv:         [9, 18],
  SpaarTv:            [10, 19],
  CryptoVermogen:     [11, 20],
  BeleggingsTv:       [11, 20],
  AquierTv:           [9, 17],
  AquierNL:           [8, 16],
  AquierDE:           [8, 16],
  AquierTvEs:         [10, 18],
}

// Slot-lead-time: plan 72u (3 dagen) vooruit, buffer 3 dagen. Daarna produce 48u
// vooraf (slot-filler) en upload 24u vooraf (upload-worker) → 24u storingsbuffer.
const HORIZON_DAYS  = parseInt(process.env.AUTO_PLANNER_HORIZON_DAYS ?? '3', 10)
const MIN_BUFFER_DAYS = parseInt(process.env.AUTO_PLANNER_MIN_BUFFER_DAYS ?? '3', 10)
const DEFAULT_SLOTS_PER_DAY = 6

// Generate n evenly-spaced hours across 24h starting at 00:00 UTC
function generateHours(n: number): number[] {
  const capped = Math.min(n, 24)
  return Array.from({ length: capped }, (_, i) => Math.floor(i * 24 / capped))
}

async function runAutoPlanner(): Promise<void> {
  const db = getSupabase()

  const { data: channels } = await db
    .from('youtube_channels')
    .select('id, naam, daily_upload_target')
    .order('naam')

  if (!channels?.length) return

  const now = new Date()
  let totalCreated = 0
  const perChannel: Record<string, number> = {}

  for (const ch of channels) {
    const slotsPerDay = ch.daily_upload_target ?? DEFAULT_SLOTS_PER_DAY
    const hours = CHANNEL_HOURS_OVERRIDE[ch.naam] ?? generateHours(slotsPerDay)
    const minBuffer = MIN_BUFFER_DAYS * slotsPerDay

    // Count existing future slots
    const { count: futureCount } = await db
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .in('status', ['planned', 'queued'])
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', now.toISOString())

    if ((futureCount ?? 0) >= minBuffer) continue

    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000)

    const { data: existing } = await db
      .from('youtube_upload_queue')
      .select('scheduled_publish_at')
      .eq('channel_id', ch.id)
      .not('scheduled_publish_at', 'is', null)
      .gt('scheduled_publish_at', now.toISOString())
      .lte('scheduled_publish_at', horizonEnd.toISOString())

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

    for (let day = 0; day < HORIZON_DAYS; day++) {
      for (const hour of hours) {
        const slot = new Date(now)
        slot.setUTCDate(slot.getUTCDate() + day)
        slot.setUTCHours(hour, 0, 0, 0)

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

    for (let i = 0; i < newSlots.length; i += 200) {
      const { error } = await db
        .from('youtube_upload_queue')
        .insert(newSlots.slice(i, i + 200))

      if (error) {
        log.error(`Slot insert mislukt voor ${ch.naam}`, { error: error.message })
        break
      }
    }

    log.info(`${ch.naam}: ${newSlots.length} nieuwe slots aangemaakt (${slotsPerDay}/dag, buffer was ${futureCount ?? 0})`)
    perChannel[ch.naam] = newSlots.length
    totalCreated += newSlots.length
  }

  if (totalCreated > 0) {
    log.info(`Auto-planner klaar: ${totalCreated} slots aangemaakt over alle kanalen`)
    await notifyPlannerRun(totalCreated, perChannel)
  }
}

export function startAutoPlanner(): void {
  log.info(`Auto-planner gestart — cap per kanaal (daily_upload_target), ${HORIZON_DAYS}d horizon = 72u slot-lead, ${MIN_BUFFER_DAYS}d buffer`)

  runAutoPlanner().catch(err => log.error('Startup run mislukt', { error: (err as Error).message }))

  cron.schedule('*/15 * * * *', () =>
    runAutoPlanner().catch(err => log.error('Scheduled run mislukt', { error: (err as Error).message }))
  )
}
