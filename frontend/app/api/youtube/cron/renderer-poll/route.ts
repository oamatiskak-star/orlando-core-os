import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPrediction, firstOutputUrl } from '@/lib/replicate'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/renderer-poll
// Schedule: */2 * * * * (zie vercel.json)
// Beveiligd via Bearer CRON_SECRET.
//
// Find content_items met status='rendering' + render_job_id, check Replicate
// status. Bij succeeded: set output_url + rendered_at → trg_render_to_upload
// fires en spawnt atlas_upload task. Bij failed: status='failed', error log.
//
// Marquerstaartelijke pending content_items: maximaal MAX_POLL per run.

const MAX_POLL = 30

interface RenderingItem {
  id: string
  title: string | null
  render_job_id: string | null
  render_started_at: string | null
  channel_id: string | null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const { data: items, error: selErr } = await admin
    .from('media_holding_content_items')
    .select('id, title, render_job_id, render_started_at, channel_id')
    .eq('status', 'rendering')
    .not('render_job_id', 'is', null)
    .order('render_started_at', { ascending: true })
    .limit(MAX_POLL)

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  const pending = (items ?? []) as RenderingItem[]

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_rendering_items', duration_ms: Date.now() - startedAt })
  }

  const results: Array<{ content_item_id: string; status: string; detail: string }> = []
  const nowIso = new Date().toISOString()

  for (const item of pending) {
    const jobId = item.render_job_id
    if (!jobId) continue

    let pred
    try {
      pred = await getPrediction(jobId)
    } catch (err) {
      results.push({ content_item_id: item.id, status: 'poll_error', detail: (err as Error).message })
      continue
    }

    if (pred.status === 'succeeded') {
      const outUrl = firstOutputUrl(pred)
      if (!outUrl) {
        await admin.from('media_holding_content_items').update({
          status:         'failed',
          failure_reason: 'Replicate succeeded maar geen output URL',
          updated_at:     nowIso,
        }).eq('id', item.id)
        await completeOrchestratorTask(admin, item.id, false, 'no_output_url')
        results.push({ content_item_id: item.id, status: 'failed', detail: 'no_output_url' })
        continue
      }

      // Update content_item: output_url vullen → trg_autopilot_render_to_upload fires
      await admin.from('media_holding_content_items').update({
        output_url:   outUrl,
        rendered_at:  nowIso,
        status:       'ready',
        render_logs:  pred.logs ?? null,
        updated_at:   nowIso,
      }).eq('id', item.id)

      await completeOrchestratorTask(admin, item.id, true, `Renderer klaar (model=${pred.model}): ${outUrl}`)
      results.push({ content_item_id: item.id, status: 'succeeded', detail: outUrl })

    } else if (pred.status === 'failed' || pred.status === 'canceled') {
      await admin.from('media_holding_content_items').update({
        status:         'failed',
        failure_reason: `Replicate ${pred.status}: ${(pred.error ?? '').slice(0, 200)}`,
        render_logs:    pred.logs ?? null,
        updated_at:     nowIso,
      }).eq('id', item.id)
      await completeOrchestratorTask(admin, item.id, false, `Replicate ${pred.status}: ${pred.error ?? 'no_detail'}`)
      results.push({ content_item_id: item.id, status: 'failed', detail: pred.error ?? pred.status })

    } else {
      // starting / processing — laat hangen tot volgende poll
      results.push({ content_item_id: item.id, status: pred.status, detail: jobId })
    }
  }

  return NextResponse.json({
    ok:           true,
    polled:       pending.length,
    succeeded:    results.filter((r) => r.status === 'succeeded').length,
    failed:       results.filter((r) => r.status === 'failed').length,
    in_progress:  results.filter((r) => r.status === 'processing' || r.status === 'starting').length,
    results,
    duration_ms:  Date.now() - startedAt,
  })
}

// Vind de matching renderer orchestrator_task voor dit content_item en update hem.
async function completeOrchestratorTask(
  admin: ReturnType<typeof createAdminClient>,
  contentItemId: string,
  success: boolean,
  detail: string,
) {
  const { data: tasks } = await admin
    .from('orchestrator_tasks')
    .select('id, attempts')
    .eq('executor', 'renderer')
    .in('status', ['running', 'open'])
    .contains('payload', { content_item_id: contentItemId })
    .limit(1)

  const task = tasks?.[0]
  if (!task) return

  await admin.from('orchestrator_tasks').update({
    status:         success ? 'completed' : 'failed',
    finished_at:    new Date().toISOString(),
    updated_at:     new Date().toISOString(),
    attempts:       (task.attempts ?? 0) + 1,
    result_summary: success ? detail : null,
    error:          success ? null : detail,
  }).eq('id', task.id)
}
