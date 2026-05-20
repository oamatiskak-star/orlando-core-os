import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/factory-feeder
// Schedule: 20 */4 * * * (elke 4 uur, 20 min na viral-scan)
// Beveiligd via Bearer CRON_SECRET.
//
// Probleem: viral-scan inserts viral_opportunities maar niemand maakte
// downstream orchestrator_tasks aan voor content_factory nadat de
// externe orchestrator-poller gestopt is (2026-05-19 20:26 UTC).
//
// Fix: deze cron vindt recente viral_opportunities ZONDER bestaande
// content_factory task en maakt die taken aan. Zo herstart de volledige
// pipeline: viral → factory-feeder → content-factory cron → renderer-dispatch
// → renderer-poll → trg_autopilot_render_to_upload → upload queue.

const MAX_FEED = 10  // max nieuwe tasks per run
const LOOKBACK_HOURS = 8  // viral opps ouder dan X uur overslaan

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const cutoffDate = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString()

  // Haal recente viral_opportunities op
  const { data: opps, error: oppsErr } = await admin
    .from('viral_opportunities')
    .select('id, title, virality_score, source_platform')
    .gte('captured_at', cutoffDate)
    .order('virality_score', { ascending: false })
    .limit(MAX_FEED * 3)  // meer ophalen dan nodig, filteren we daarna

  if (oppsErr) return NextResponse.json({ error: oppsErr.message }, { status: 500 })
  if (!opps || opps.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_recent_viral_opps', duration_ms: Date.now() - startedAt })
  }

  // Haal bestaande content_factory tasks op voor deze opps
  const oppIds = opps.map(o => o.id as string)
  const { data: existingTasks } = await admin
    .from('orchestrator_tasks')
    .select('payload')
    .eq('executor', 'content_factory')
    .in('status', ['open', 'running', 'completed'])

  const alreadyQueued = new Set(
    (existingTasks ?? [])
      .map(t => (t.payload as Record<string, unknown>)?.viral_opportunity_id as string | undefined)
      .filter(Boolean) as string[]
  )

  // Filter: alleen opps zonder bestaande task
  const toFeed = opps
    .filter(o => !alreadyQueued.has(o.id as string))
    .slice(0, MAX_FEED)

  if (toFeed.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'all_opps_already_queued', duration_ms: Date.now() - startedAt })
  }

  // Maak orchestrator_tasks aan voor content_factory
  const now = new Date().toISOString()
  const inserts = toFeed.map((opp, i) => ({
    executor:       'content_factory',
    status:         'open',
    priority:       Math.max(1, 5 - Math.floor((opp.virality_score as number ?? 50) / 20)),
    run_at:         now,
    max_attempts:   3,
    attempts:       0,
    payload: {
      viral_opportunity_id: opp.id,
      source:               'factory-feeder-cron',
      virality_score:       opp.virality_score,
      platform:             opp.source_platform,
    },
    objective: ['Genereer content brief via Forge (Haiku LLM)', 'Insert media_holding_content_item met status=ready', 'Trigger autopilot render pipeline'],
  }))

  const { data: inserted, error: insErr } = await admin
    .from('orchestrator_tasks')
    .insert(inserts)
    .select('id')

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({
    ok:           true,
    fed:          (inserted ?? []).length,
    eligible_opps: toFeed.length,
    already_queued: alreadyQueued.size,
    duration_ms:  Date.now() - startedAt,
  })
}
