'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeNextCron } from '@/lib/routines/cron'
import type { RoutineKind, RoutineStatus, StepType, TriggerKind } from '@/lib/routines/types'

/**
 * Server actions voor Routines Control Center.
 *
 * Veiligheid: deze acties draaien via de auth-cookie van de ingelogde gebruiker.
 * RLS-policies in 089_routines_control_center.sql geven alleen leesrechten aan
 * `authenticated` — schrijfacties moeten via service-role of via een SECURITY
 * DEFINER functie. Voor nu gebruiken we de service-role-omgeving (server-side)
 * — wanneer een NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in process.env staat zou
 * dat een veiligheidsrisico zijn. We gebruiken de anon client met de session
 * cookie; de gebruiker moet authenticated zijn.
 */

const ALL_KINDS: RoutineKind[]   = ['agent', 'workflow', 'cron', 'reactive']
const ALL_STATUS: RoutineStatus[] = ['active', 'paused', 'disabled', 'draft']
const ALL_STEP_TYPES: StepType[]  = ['action', 'condition', 'approval', 'fallback', 'delay']
const ALL_TRIGGERS: TriggerKind[] = ['cron', 'event', 'webhook', 'manual']

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function audit(routineId: string | null, runId: string | null, action: string, detail: Record<string, unknown> = {}) {
  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user
  await supabase.from('routine_audit_log').insert({
    routine_id: routineId,
    run_id:     runId,
    action,
    actor:      'user',
    actor_id:   user?.id ?? null,
    detail,
  })
}

// ── createRoutine ─────────────────────────────────────────────────────────
export async function createRoutine(formData: FormData) {
  const name        = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const kindRaw     = String(formData.get('kind') ?? '').trim()
  const companySlug = String(formData.get('company_slug') ?? '').trim()
  const statusRaw   = String(formData.get('status') ?? 'draft').trim()

  if (!name) throw new Error('Naam is verplicht')
  if (!ALL_KINDS.includes(kindRaw as RoutineKind)) throw new Error('Ongeldige kind')
  if (!ALL_STATUS.includes(statusRaw as RoutineStatus)) throw new Error('Ongeldige status')

  const supabase = await createClient()

  let companyId: string | null = null
  if (companySlug) {
    const { data } = await supabase.from('companies').select('id').eq('slug', companySlug).maybeSingle()
    companyId = data?.id ?? null
    if (!companyId) throw new Error(`Onbekende company slug: ${companySlug}`)
  }

  const slug = slugify(name)
  if (!slug) throw new Error('Naam levert geen geldige slug op')

  const { data: inserted, error } = await supabase
    .from('routines')
    .insert({
      company_id:  companyId,
      slug,
      name,
      description: description || null,
      kind:        kindRaw as RoutineKind,
      status:      statusRaw as RoutineStatus,
    })
    .select('id, slug')
    .single()

  if (error || !inserted) throw new Error(error?.message ?? 'Routine aanmaken mislukt')

  await audit(inserted.id, null, 'routine.created', { slug, kind: kindRaw, status: statusRaw, company_id: companyId })

  revalidatePath('/dashboard/build-tracker/routines')
  redirect(`/dashboard/build-tracker/routines/${inserted.id}`)
}

// ── updateRoutine ─────────────────────────────────────────────────────────
export async function updateRoutine(formData: FormData) {
  const id          = String(formData.get('id') ?? '').trim()
  const name        = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const statusRaw   = String(formData.get('status') ?? '').trim()

  if (!id) throw new Error('routine id ontbreekt')
  if (!ALL_STATUS.includes(statusRaw as RoutineStatus)) throw new Error('Ongeldige status')

  const supabase = await createClient()
  const { error } = await supabase
    .from('routines')
    .update({
      name:        name || undefined,
      description: description || null,
      status:      statusRaw as RoutineStatus,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await audit(id, null, 'routine.updated', { name, status: statusRaw })
  revalidatePath(`/dashboard/build-tracker/routines/${id}`)
}

// ── addStep ───────────────────────────────────────────────────────────────
export async function addStep(formData: FormData) {
  const routineId = String(formData.get('routine_id') ?? '').trim()
  const typeRaw   = String(formData.get('type') ?? '').trim()
  const configRaw = String(formData.get('config') ?? '{}').trim()

  if (!routineId) throw new Error('routine_id ontbreekt')
  if (!ALL_STEP_TYPES.includes(typeRaw as StepType)) throw new Error('Ongeldige step type')

  let config: Record<string, unknown> = {}
  try {
    config = configRaw ? JSON.parse(configRaw) : {}
  } catch {
    throw new Error('Config moet geldige JSON zijn')
  }

  const supabase = await createClient()

  const { data: maxOrder } = await supabase
    .from('routine_steps')
    .select('order_idx')
    .eq('routine_id', routineId)
    .order('order_idx', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxOrder?.order_idx ?? -1) + 1

  const { data: step, error } = await supabase
    .from('routine_steps')
    .insert({ routine_id: routineId, order_idx: nextOrder, type: typeRaw as StepType, config })
    .select('id')
    .single()

  if (error || !step) throw new Error(error?.message ?? 'Step aanmaken mislukt')

  await audit(routineId, null, 'step.added', { step_id: step.id, type: typeRaw, order_idx: nextOrder })
  revalidatePath(`/dashboard/build-tracker/routines/${routineId}`)
}

// ── setTrigger ────────────────────────────────────────────────────────────
export async function setTrigger(formData: FormData) {
  const routineId = String(formData.get('routine_id') ?? '').trim()
  const kindRaw   = String(formData.get('kind') ?? '').trim()
  const configRaw = String(formData.get('config') ?? '{}').trim()
  const enabled   = formData.get('enabled') === 'on'

  if (!routineId) throw new Error('routine_id ontbreekt')
  if (!ALL_TRIGGERS.includes(kindRaw as TriggerKind)) throw new Error('Ongeldige trigger kind')

  let config: Record<string, unknown> = {}
  try {
    config = configRaw ? JSON.parse(configRaw) : {}
  } catch {
    throw new Error('Trigger config moet geldige JSON zijn')
  }

  let nextRunAt: string | null = null
  if (kindRaw === 'cron') {
    const cronExpr = String(config.cron ?? '')
    if (!cronExpr) throw new Error('Cron trigger vereist config.cron')
    nextRunAt = computeNextCron(cronExpr)
    if (!nextRunAt) throw new Error(`Cron-expressie kon niet geparsed worden: "${cronExpr}"`)
  }

  const supabase = await createClient()
  const { data: trigger, error } = await supabase
    .from('routine_triggers')
    .insert({
      routine_id:  routineId,
      kind:        kindRaw as TriggerKind,
      config,
      enabled,
      next_run_at: nextRunAt,
    })
    .select('id')
    .single()

  if (error || !trigger) throw new Error(error?.message ?? 'Trigger aanmaken mislukt')

  await audit(routineId, null, 'trigger.added', { trigger_id: trigger.id, kind: kindRaw, enabled, next_run_at: nextRunAt })
  revalidatePath(`/dashboard/build-tracker/routines/${routineId}`)
}

// ── runRoutineNow ─────────────────────────────────────────────────────────
export async function runRoutineNow(formData: FormData) {
  const routineId = String(formData.get('routine_id') ?? '').trim()
  if (!routineId) throw new Error('routine_id ontbreekt')

  const supabase = await createClient()

  const { data: routine } = await supabase
    .from('routines')
    .select('id, status, name')
    .eq('id', routineId)
    .maybeSingle()

  if (!routine) throw new Error('Routine niet gevonden')
  if (routine.status !== 'active') {
    throw new Error(`Kan alleen routines met status='active' runnen (huidige: ${routine.status})`)
  }

  const { data: run, error } = await supabase
    .from('routine_runs')
    .insert({
      routine_id:    routineId,
      status:        'queued',
      trigger_kind:  'manual',
      trigger_payload: { source: 'ui:run_now' },
    })
    .select('id')
    .single()

  if (error || !run) throw new Error(error?.message ?? 'Run enqueuen mislukt')

  await audit(routineId, run.id, 'run.enqueued', { trigger_kind: 'manual', source: 'ui' })
  revalidatePath(`/dashboard/build-tracker/routines/${routineId}`)
}

// ── pauseRoutine / resumeRoutine ──────────────────────────────────────────
export async function pauseRoutine(formData: FormData) {
  const id = String(formData.get('routine_id') ?? '').trim()
  if (!id) throw new Error('routine_id ontbreekt')

  const supabase = await createClient()
  const { error } = await supabase.from('routines').update({ status: 'paused' }).eq('id', id)
  if (error) throw new Error(error.message)

  await audit(id, null, 'routine.paused', {})
  revalidatePath(`/dashboard/build-tracker/routines/${id}`)
}

export async function resumeRoutine(formData: FormData) {
  const id = String(formData.get('routine_id') ?? '').trim()
  if (!id) throw new Error('routine_id ontbreekt')

  const supabase = await createClient()
  const { error } = await supabase.from('routines').update({ status: 'active' }).eq('id', id)
  if (error) throw new Error(error.message)

  await audit(id, null, 'routine.resumed', {})
  revalidatePath(`/dashboard/build-tracker/routines/${id}`)
}

// ── cancelRun ─────────────────────────────────────────────────────────────
export async function cancelRun(formData: FormData) {
  const runId = String(formData.get('run_id') ?? '').trim()
  if (!runId) throw new Error('run_id ontbreekt')

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('routine_runs')
    .update({
      status:   'cancelled',
      ended_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .in('status', ['queued', 'running', 'paused', 'awaiting_approval'])
    .select('id, routine_id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('Run kon niet worden geannuleerd (al voltooid?)')

  await audit(row.routine_id, runId, 'run.cancelled', { reason: 'user_cancel' })
  revalidatePath(`/dashboard/build-tracker/routines/${row.routine_id}`)
  revalidatePath('/dashboard/build-tracker/routines/live')
}

// ── restartRun (Fase 4: recovery) ────────────────────────────────────────
// Een nieuwe run starten voor dezelfde routine, met parent_run_id verwijzend
// naar de oude. De oude run blijft als historie behouden.
export async function restartRun(formData: FormData) {
  const previousRunId = String(formData.get('run_id') ?? '').trim()
  if (!previousRunId) throw new Error('run_id ontbreekt')

  const supabase = await createClient()
  const { data: prev } = await supabase
    .from('routine_runs')
    .select('id, routine_id, trigger_kind, status')
    .eq('id', previousRunId)
    .maybeSingle()

  if (!prev) throw new Error('Vorige run niet gevonden')
  if (!['failed', 'cancelled', 'recovered'].includes(prev.status)) {
    throw new Error(`Kan alleen restarten vanaf failed/cancelled (huidige: ${prev.status})`)
  }

  const { data: routine } = await supabase
    .from('routines')
    .select('status')
    .eq('id', prev.routine_id)
    .maybeSingle()
  if (routine?.status !== 'active') {
    throw new Error(`Routine moet status='active' zijn (huidige: ${routine?.status})`)
  }

  const { data: newRun, error } = await supabase
    .from('routine_runs')
    .insert({
      routine_id:    prev.routine_id,
      parent_run_id: prev.id,
      status:        'queued',
      trigger_kind:  'retry',
      trigger_payload: { source: 'ui:restart', previous_run_id: prev.id },
    })
    .select('id')
    .single()

  if (error || !newRun) throw new Error(error?.message ?? 'Restart mislukt')

  // Markeer vorige run als 'recovered' (zodat de feedback-loop volledig is)
  await supabase
    .from('routine_runs')
    .update({ status: 'recovered' })
    .eq('id', prev.id)
    .eq('status', prev.status)

  await audit(prev.routine_id, newRun.id, 'run.restarted', { previous_run_id: prev.id })
  revalidatePath(`/dashboard/build-tracker/routines/${prev.routine_id}`)
  revalidatePath('/dashboard/build-tracker/routines/recovery')
}

// ── approveStep / denyStep ───────────────────────────────────────────────
async function decideApproval(approvalId: string, decision: 'approve' | 'deny' | 'defer', notes: string) {
  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user

  const { data: approval, error: fetchErr } = await supabase
    .from('routine_approvals')
    .select('id, run_id, step_id, decision')
    .eq('id', approvalId)
    .maybeSingle()

  if (fetchErr || !approval) throw new Error('Approval niet gevonden')
  if (approval.decision) throw new Error(`Approval al beslist (${approval.decision})`)

  const { error: updateErr } = await supabase
    .from('routine_approvals')
    .update({
      decision,
      decided_at: new Date().toISOString(),
      decided_by: user?.id ?? null,
      notes:      notes || null,
    })
    .eq('id', approvalId)

  if (updateErr) throw new Error(updateErr.message)

  // Run-status update afhankelijk van beslissing
  if (decision === 'approve') {
    // Hervat de run zodat de runner doorgaat met de volgende step
    await supabase.from('routine_runs').update({ status: 'queued' }).eq('id', approval.run_id).eq('status', 'awaiting_approval')
  } else if (decision === 'deny') {
    await supabase.from('routine_runs').update({
      status:   'cancelled',
      ended_at: new Date().toISOString(),
      error:    { reason: 'approval_denied', step_id: approval.step_id, notes },
    }).eq('id', approval.run_id).eq('status', 'awaiting_approval')
  }
  // 'defer' laat run op awaiting_approval staan voor later

  const { data: run } = await supabase
    .from('routine_runs')
    .select('routine_id')
    .eq('id', approval.run_id)
    .maybeSingle()

  await audit(run?.routine_id ?? null, approval.run_id, `approval.${decision}`, {
    approval_id: approvalId, step_id: approval.step_id, notes,
  })

  revalidatePath('/dashboard/build-tracker/routines/recovery')
  if (run?.routine_id) revalidatePath(`/dashboard/build-tracker/routines/${run.routine_id}`)
}

export async function approveStep(formData: FormData) {
  const approvalId = String(formData.get('approval_id') ?? '').trim()
  const notes      = String(formData.get('notes') ?? '').trim()
  if (!approvalId) throw new Error('approval_id ontbreekt')
  await decideApproval(approvalId, 'approve', notes)
}

export async function denyStep(formData: FormData) {
  const approvalId = String(formData.get('approval_id') ?? '').trim()
  const notes      = String(formData.get('notes') ?? '').trim()
  if (!approvalId) throw new Error('approval_id ontbreekt')
  await decideApproval(approvalId, 'deny', notes)
}

export async function deferStep(formData: FormData) {
  const approvalId = String(formData.get('approval_id') ?? '').trim()
  const notes      = String(formData.get('notes') ?? '').trim()
  if (!approvalId) throw new Error('approval_id ontbreekt')
  await decideApproval(approvalId, 'defer', notes)
}

// ── setAutopilot ─────────────────────────────────────────────────────────
export async function setAutopilot(formData: FormData) {
  const routineId = String(formData.get('routine_id') ?? '').trim()
  if (!routineId) throw new Error('routine_id ontbreekt')

  const autoRecover    = formData.get('auto_recover') === 'on'
  const autoEscalate   = formData.get('auto_escalate') === 'on'
  const thresholdRaw   = String(formData.get('auto_approve_threshold') ?? '').trim()
  const threshold      = thresholdRaw ? Number(thresholdRaw) : null

  if (threshold !== null && (isNaN(threshold) || threshold < 0)) {
    throw new Error('auto_approve_threshold moet ≥ 0 zijn')
  }

  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user

  const { error } = await supabase.from('routine_autopilot_config').upsert({
    routine_id:             routineId,
    auto_recover:           autoRecover,
    auto_escalate:          autoEscalate,
    auto_approve_threshold: threshold,
    updated_at:             new Date().toISOString(),
    updated_by:             user?.id ?? null,
  }, { onConflict: 'routine_id' })

  if (error) throw new Error(error.message)

  await audit(routineId, null, 'autopilot.updated', {
    auto_recover: autoRecover, auto_escalate: autoEscalate, threshold,
  })

  revalidatePath('/dashboard/build-tracker/routines/settings')
}

// ── ackRecommendation / dismissAlert (Fase 5 placeholder voor F4 UI) ─────
export async function ackRecommendation(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('id ontbreekt')

  const supabase = await createClient()
  const { error } = await supabase
    .from('executive_recommendations')
    .update({ status: 'executed', executed_at: new Date().toISOString(), executed_by: 'user_ack' })
    .eq('id', id)
    .eq('target_kind', 'routine')
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/build-tracker/routines/intelligence')
  revalidatePath('/dashboard/build-tracker/routines/recovery')
}

export async function dismissAlert(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('id ontbreekt')

  const supabase = await createClient()
  const user = (await supabase.auth.getUser()).data.user
  const { error } = await supabase
    .from('executive_alerts')
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
    .eq('id', id)
    .eq('target_kind', 'routine')
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/build-tracker/routines/intelligence')
  revalidatePath('/dashboard/build-tracker/routines/recovery')
}

// computeNextCron leeft in @/lib/routines/cron (synchronous helper, mag
// niet uit een 'use server' module geëxporteerd worden).
