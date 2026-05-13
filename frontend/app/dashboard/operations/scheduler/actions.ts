'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createSchedulerTask(fd: FormData) {
  const supabase = await createClient()

  let taskConfig: Record<string, unknown> = {}
  try { taskConfig = JSON.parse(fd.get('task_config') as string) } catch { taskConfig = {} }

  await supabase.from('oc_scheduler_tasks').insert({
    naam: fd.get('naam') as string,
    company: (fd.get('company') as string) || 'MODIWÉ',
    schedule: fd.get('schedule') as string,
    task_type: fd.get('task_type') as string,
    task_config: taskConfig,
    timezone: (fd.get('timezone') as string) || 'Europe/Amsterdam',
    status: 'actief',
  })

  revalidatePath('/dashboard/operations/scheduler')
}

export async function toggleSchedulerTask(id: string, current: string) {
  const supabase = await createClient()
  const newStatus = current === 'actief' ? 'gepauzeerd' : 'actief'
  await supabase.from('oc_scheduler_tasks').update({ status: newStatus }).eq('id', id)
  revalidatePath('/dashboard/operations/scheduler')
}

export async function deleteSchedulerTask(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_scheduler_tasks').delete().eq('id', id)
  revalidatePath('/dashboard/operations/scheduler')
}
