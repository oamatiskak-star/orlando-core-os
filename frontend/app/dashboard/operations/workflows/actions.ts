'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createWorkflow(fd: FormData) {
  const supabase = await createClient()
  const triggerType = fd.get('trigger_type') as string
  const schedule = fd.get('schedule') as string

  const triggerConfig: Record<string, string> = {}
  if (triggerType === 'cron' && schedule) {
    triggerConfig.schedule = schedule
    triggerConfig.label = schedule
  }
  if (triggerType === 'event') {
    triggerConfig.event_name = (fd.get('event_name') as string) || 'custom_event'
  }
  if (triggerType === 'webhook') {
    triggerConfig.webhook_secret = crypto.randomUUID().slice(0, 16)
  }

  let steps: unknown[] = []
  try { steps = JSON.parse(fd.get('steps') as string) } catch { steps = [] }

  await supabase.from('oc_workflows').insert({
    naam: fd.get('naam') as string,
    omschrijving: (fd.get('omschrijving') as string) || null,
    company: (fd.get('company') as string) || 'MODIWÉ',
    category: (fd.get('category') as string) || null,
    trigger_type: triggerType,
    trigger_config: triggerConfig,
    steps,
    status: 'actief',
  })

  revalidatePath('/dashboard/operations/workflows')
}

export async function triggerWorkflow(id: string) {
  const supabase = await createClient()

  await supabase.from('oc_workflow_runs').insert({
    workflow_id: id,
    status: 'running',
    trigger_source: 'manual',
    started_at: new Date().toISOString(),
  })

  await supabase.rpc('oc_increment_run_count' as never, { wf_id: id }).maybeSingle()

  await supabase.from('oc_workflows').update({
    last_run_at: new Date().toISOString(),
    last_run_status: 'running',
    run_count: supabase.rpc('oc_increment_run_count' as never, { wf_id: id }) as unknown as number,
  }).eq('id', id)

  revalidatePath('/dashboard/operations/workflows')
}

export async function toggleWorkflowStatus(id: string, current: string) {
  const supabase = await createClient()
  const newStatus = current === 'actief' ? 'gepauzeerd' : 'actief'
  await supabase.from('oc_workflows').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/workflows')
}

export async function deleteWorkflow(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_workflows').update({ status: 'uitgeschakeld', updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/workflows')
}
