import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPrediction } from '@/lib/replicate'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/renderer-dispatch
// Schedule: */5 * * * * (zie vercel.json)
// Beveiligd via Bearer CRON_SECRET.
//
// Claim open renderer orchestrator_tasks → start Replicate prediction met
// content_item.prompt → sla prediction_id op in content_item.render_job_id
// + content_item.status='rendering'. Task gaat naar 'running'.
//
// Aparte cron (renderer-poll) finalizet bij done.
//
// Replicate model default: minimax/video-01 (same als oude orchestrator did).
// Override via env CRON_RENDER_MODEL.

const BATCH_SIZE = 5
// minimax/video-01 is bewezen werkend in oude flow + stabieler dan seedance
// (Bytedance hosted model bij Replicate had E004 service unavailable errors).
// Override via CRON_RENDER_MODEL env var voor experimenten.
const DEFAULT_MODEL = process.env.CRON_RENDER_MODEL ?? 'minimax/video-01'

// Premium rail threshold — content_items van viral_opportunities met score
// onder dit grens worden door de lokale rail (FFmpeg+stock) verwerkt, niet
// Replicate. Override via CRON_PREMIUM_THRESHOLD env.
const PREMIUM_THRESHOLD = Number(process.env.CRON_PREMIUM_THRESHOLD ?? '95')

interface OpenRenderTask {
  id: string
  payload: { content_item_id?: string; persona?: string }
  attempts: number
  max_attempts: number | null
}

// Per-model input adapter — elke video generator heeft andere parameter-namen.
function buildModelInput(model: string, prompt: string): Record<string, unknown> {
  const clipped = prompt.slice(0, 4000)
  if (model.startsWith('bytedance/seedance')) {
    return {
      prompt:        clipped,
      aspect_ratio:  '9:16',
      duration:      10,        // 5 of 10 sec; 10 = max
      resolution:    '720p',    // 480p of 720p
      camera_fixed:  false,
    }
  }
  if (model.startsWith('kwaivgi/kling')) {
    return {
      prompt:       clipped,
      aspect_ratio: '9:16',
      duration:     5,
    }
  }
  if (model.startsWith('minimax/video')) {
    return {
      prompt:           clipped,
      prompt_optimizer: true,
    }
  }
  return { prompt: clipped }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // 2-staps claim
  const { data: candidates, error: selErr } = await admin
    .from('orchestrator_tasks')
    .select('id, payload, attempts, max_attempts')
    .eq('status', 'open')
    .eq('executor', 'renderer')
    .lte('run_at', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_open_tasks', duration_ms: Date.now() - startedAt })
  }

  const ids = candidates.map((c) => c.id as string)
  const { data: claimed, error: claimErr } = await admin
    .from('orchestrator_tasks')
    .update({ status: 'running', started_at: nowIso, updated_at: nowIso })
    .in('id', ids)
    .eq('status', 'open')
    .select('id, payload, attempts, max_attempts')

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })
  const tasks = (claimed ?? []) as OpenRenderTask[]

  const results: Array<{ task_id: string; status: 'dispatched'|'failed'; detail: string }> = []

  for (const task of tasks) {
    const itemId = task.payload?.content_item_id
    if (!itemId) {
      await markFailed(admin, task, 'payload.content_item_id ontbreekt')
      results.push({ task_id: task.id, status: 'failed', detail: 'no_content_item_id' })
      continue
    }

    const { data: item, error: itemErr } = await admin
      .from('media_holding_content_items')
      .select(`
        id, title, prompt, status, render_job_id, channel_id, duration_seconds, kind,
        source_opportunity_id,
        viral_opportunities!source_opportunity_id ( virality_score )
      `)
      .eq('id', itemId)
      .single()

    if (itemErr || !item) {
      await markFailed(admin, task, `content_item ${itemId} niet gevonden`)
      results.push({ task_id: task.id, status: 'failed', detail: 'item_not_found' })
      continue
    }
    if (!item.prompt) {
      await markFailed(admin, task, 'content_item.prompt is leeg')
      results.push({ task_id: task.id, status: 'failed', detail: 'no_prompt' })
      continue
    }

    // Threshold check — onder threshold gaat naar lokale rail (executor='renderer'
    // blijft 'open', wordt door local-agent gepakt).
    const viralOpp = Array.isArray(item.viral_opportunities)
      ? item.viral_opportunities[0]
      : item.viral_opportunities
    const score = Number(viralOpp?.virality_score ?? 0)
    if (score < PREMIUM_THRESHOLD) {
      // Release task terug naar 'open' zodat local rail hem kan pakken
      await admin.from('orchestrator_tasks').update({
        status:     'open',
        started_at: null,
        error:      `routed_to_local_rail: score ${score} < ${PREMIUM_THRESHOLD}`,
        updated_at: new Date().toISOString(),
      }).eq('id', task.id)
      results.push({ task_id: task.id, status: 'failed', detail: `routed_to_local (score ${score})` })
      continue
    }
    if (item.render_job_id) {
      // Al een prediction draaiend — markeer task running zodat renderer-poll het oppakt.
      results.push({ task_id: task.id, status: 'dispatched', detail: `existing_prediction:${item.render_job_id}` })
      continue
    }

    // Start Replicate prediction
    try {
      const prediction = await createPrediction(DEFAULT_MODEL, buildModelInput(DEFAULT_MODEL, item.prompt))

      await admin.from('media_holding_content_items').update({
        status:             'rendering',
        render_job_id:      prediction.id,
        render_model:       DEFAULT_MODEL,
        render_started_at:  nowIso,
        updated_at:         nowIso,
      }).eq('id', item.id)

      results.push({ task_id: task.id, status: 'dispatched', detail: prediction.id })
    } catch (err) {
      await markFailed(admin, task, `Replicate dispatch: ${(err as Error).message}`)
      results.push({ task_id: task.id, status: 'failed', detail: (err as Error).message })
    }
  }

  return NextResponse.json({
    ok:          true,
    claimed:     tasks.length,
    dispatched:  results.filter((r) => r.status === 'dispatched').length,
    failed:      results.filter((r) => r.status === 'failed').length,
    results,
    duration_ms: Date.now() - startedAt,
  })
}

async function markFailed(admin: ReturnType<typeof createAdminClient>, task: OpenRenderTask, error: string) {
  const maxAttempts = task.max_attempts ?? 3
  const nextAttempts = (task.attempts ?? 0) + 1
  const finalStatus = nextAttempts >= maxAttempts ? 'failed' : 'open'

  await admin.from('orchestrator_tasks').update({
    status:     finalStatus,
    error,
    attempts:   nextAttempts,
    started_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', task.id)
}
