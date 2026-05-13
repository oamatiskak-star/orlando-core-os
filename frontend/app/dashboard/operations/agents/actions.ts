'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createAgent(fd: FormData) {
  const supabase = await createClient()

  let capabilities: string[] = []
  try { capabilities = JSON.parse(fd.get('capabilities') as string) } catch { capabilities = [] }

  await supabase.from('oc_ai_agents').insert({
    naam: fd.get('naam') as string,
    type: fd.get('type') as string,
    company: (fd.get('company') as string) || 'MODIWÉ',
    model: (fd.get('model') as string) || 'gpt-4o',
    system_prompt: (fd.get('system_prompt') as string) || null,
    capabilities,
    queue_name: (fd.get('queue_name') as string) || null,
    status: 'idle',
  })

  revalidatePath('/dashboard/operations/agents')
}

export async function runAgent(id: string, input: string) {
  const supabase = await createClient()

  await supabase.from('oc_agent_runs').insert({
    agent_id: id,
    trigger: 'manual',
    input: { text: input },
    status: 'running',
    started_at: new Date().toISOString(),
  })

  await supabase.from('oc_ai_agents').update({
    status: 'running',
    last_active_at: new Date().toISOString(),
    run_count: supabase.rpc('oc_increment_agent_run_count' as never, { a_id: id }) as unknown as number,
  }).eq('id', id)

  revalidatePath('/dashboard/operations/agents')
}

export async function toggleAgentStatus(id: string, current: string) {
  const supabase = await createClient()
  const newStatus = current === 'idle' ? 'disabled' : 'idle'
  await supabase.from('oc_ai_agents').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/agents')
}

export async function deleteAgent(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_ai_agents').delete().eq('id', id)
  revalidatePath('/dashboard/operations/agents')
}
