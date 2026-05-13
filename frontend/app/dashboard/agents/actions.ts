'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function dispatchAgentTask(agentId: string, taskType: string, payload: Record<string, unknown> = {}) {
  const supabase = await createClient()

  await supabase.from('oc_agent_tasks').insert({
    agent_id: agentId,
    task_type: taskType,
    payload,
    status: 'queued',
    queued_at: new Date().toISOString(),
  })

  await supabase.from('oc_agents').update({
    status: 'processing',
    current_task: taskType,
    updated_at: new Date().toISOString(),
  }).eq('id', agentId)

  revalidatePath('/dashboard/agents')
}

export async function updateAgentStatus(agentId: string, status: string) {
  const supabase = await createClient()

  await supabase.from('oc_agents').update({
    status,
    current_task: status === 'idle' || status === 'offline' ? null : undefined,
    updated_at: new Date().toISOString(),
  }).eq('id', agentId)

  revalidatePath('/dashboard/agents')
}

export async function cancelTask(taskId: string) {
  const supabase = await createClient()

  await supabase.from('oc_agent_tasks').update({
    status: 'cancelled',
    finished_at: new Date().toISOString(),
  }).eq('id', taskId)

  revalidatePath('/dashboard/agents')
}

export async function retryTask(taskId: string) {
  const supabase = await createClient()

  await supabase.from('oc_agent_tasks').update({
    status: 'queued',
    queued_at: new Date().toISOString(),
    error: null,
    finished_at: null,
  }).eq('id', taskId)

  revalidatePath('/dashboard/agents')
}
