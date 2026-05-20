import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

// Vercel cron — /api/youtube/cron/autopilot-tick
// Schedule: zie vercel.json (elke 4 uur, 6× per dag).
// Beveiligd via Bearer CRON_SECRET, identiek aan andere cron endpoints.
//
// Dispatch: één cron_dispatcher orchestrator_task. Die wordt door de
// ao-executor (Render planning-engine) opgepakt en spawnt drie child
// scan-tasks parallel:
//   • viral_scanner   → vult viral_opportunities (YouTube mostPopular NL/US/GB)
//   • trend_scanner   → vult trend_scanner_signals (keywords/topics)
//   • audio_scanner   → vult audio_library (trending sounds)
//
// Idempotency: skip als er al een open cron_dispatcher task is. Voorkomt
// queue-opbouw als de executor traag of offline is.
//
// Optionele tasks via env CRON_AUTOPILOT_TICK_TASKS (csv) — anders default
// uit de autopilot-cron POST handler ('viral_scanner','trend_scanner','audio_scanner').
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Idempotency
  const { data: openTicks, error: openErr } = await admin
    .from('orchestrator_tasks')
    .select('id, created_at')
    .eq('executor', 'cron_dispatcher')
    .in('status', ['open', 'running', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (openErr) {
    return NextResponse.json({ error: openErr.message }, { status: 500 })
  }
  if (openTicks && openTicks.length > 0) {
    return NextResponse.json({
      skipped: true,
      reason: 'open_tick_in_progress',
      task_id: openTicks[0].id,
      created_at: openTicks[0].created_at,
    })
  }

  // Optionele override van scanners via env
  const tasksEnv = process.env.CRON_AUTOPILOT_TICK_TASKS
  const tasks = tasksEnv
    ? tasksEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  const { data, error } = await admin
    .from('orchestrator_tasks')
    .insert({
      company_id:      'modiwerijo',
      title:           '[cron] autopilot tick',
      task_type:       'cron_tick',
      executor:        'cron_dispatcher',
      allowed_actions: ['*'],
      priority:        5,
      status:          'open',
      objective:       ['Periodieke scan-tick (Vercel cron, elke 4u).'],
      payload:         tasks ? { tasks, trigger: 'vercel_cron' } : { trigger: 'vercel_cron' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    task_id: data.id,
    tasks: tasks ?? 'default (viral + trend + audio)',
  }, { status: 202 })
}
