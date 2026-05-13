'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function triggerWorkflow(workflowId: string) {
  const supabase = await createClient()

  // Maak een nieuwe run aan
  const { data: run } = await supabase
    .from('oc_workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      triggered_by: 'manual',
      started_at: new Date().toISOString(),
      logs: [{ ts: new Date().toISOString(), level: 'info', msg: 'Workflow handmatig gestart' }],
    })
    .select('id')
    .single()

  // Update workflow last_run
  await supabase
    .from('oc_workflows')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: 'running',
      run_count: supabase.rpc('oc_increment_run_count', { wf_id: workflowId }),
    })
    .eq('id', workflowId)

  // Simuleer async executie — in productie roept dit de executor backend aan
  // De executor pikt dit op via Supabase realtime of polling
  setTimeout(async () => {
    const client = await createClient()
    const finishedAt = new Date()
    await client.from('oc_workflow_runs').update({
      status: 'success',
      finished_at: finishedAt.toISOString(),
      duration_ms: Math.floor(Math.random() * 2000) + 500,
      logs: [
        { ts: new Date().toISOString(), level: 'info', msg: 'Workflow gestart' },
        { ts: new Date().toISOString(), level: 'info', msg: 'Stap 1 voltooid' },
        { ts: new Date().toISOString(), level: 'success', msg: 'Workflow succesvol afgerond' },
      ],
    }).eq('id', run?.id)

    await client.from('oc_workflows').update({
      last_run_status: 'success',
    }).eq('id', workflowId)
  }, 2000)

  revalidatePath('/dashboard/workflows')
}

export async function toggleWorkflowStatus(workflowId: string, currentStatus: string) {
  const supabase = await createClient()
  const newStatus = currentStatus === 'actief' ? 'gepauzeerd' : 'actief'
  await supabase.from('oc_workflows').update({ status: newStatus }).eq('id', workflowId)
  revalidatePath('/dashboard/workflows')
}

export async function deleteWorkflow(workflowId: string) {
  const supabase = await createClient()
  await supabase.from('oc_workflows').delete().eq('id', workflowId)
  revalidatePath('/dashboard/workflows')
}

export async function createWorkflow(formData: FormData) {
  const supabase = await createClient()

  const triggerType = formData.get('trigger_type') as string
  const schedule = formData.get('schedule') as string

  const triggerConfig: Record<string, string> = {}
  if (triggerType === 'cron' && schedule) {
    triggerConfig.schedule = schedule
    triggerConfig.label = schedule
  }
  if (triggerType === 'event') {
    triggerConfig.event_name = (formData.get('event_name') as string) || 'custom_event'
  }
  if (triggerType === 'webhook') {
    triggerConfig.webhook_secret = crypto.randomUUID().slice(0, 16)
  }

  const stepsRaw = formData.get('steps') as string
  let steps = []
  try { steps = JSON.parse(stepsRaw) } catch { steps = [] }

  await supabase.from('oc_workflows').insert({
    naam: formData.get('naam') as string,
    omschrijving: (formData.get('omschrijving') as string) || null,
    company: (formData.get('company') as string) || 'MODIWÉ',
    trigger_type: triggerType,
    trigger_config: triggerConfig,
    steps,
    status: 'actief',
  })

  revalidatePath('/dashboard/workflows')
}
