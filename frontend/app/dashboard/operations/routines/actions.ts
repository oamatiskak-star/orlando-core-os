'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createRoutine(fd: FormData) {
  const supabase = await createClient()

  let steps: unknown[] = []
  try { steps = JSON.parse(fd.get('steps') as string) } catch { steps = [] }

  await supabase.from('oc_routines').insert({
    naam: fd.get('naam') as string,
    omschrijving: (fd.get('omschrijving') as string) || null,
    company: (fd.get('company') as string) || 'MODIWÉ',
    category: (fd.get('category') as string) || null,
    schedule: fd.get('schedule') as string,
    steps,
    status: 'actief',
  })

  revalidatePath('/dashboard/operations/routines')
}

export async function runRoutine(id: string) {
  const supabase = await createClient()

  await supabase.from('oc_routine_runs').insert({
    routine_id: id,
    status: 'running',
    started_at: new Date().toISOString(),
  })

  await supabase.from('oc_routines').update({
    last_run_at: new Date().toISOString(),
    last_run_status: 'running',
    run_count: supabase.rpc('oc_increment_routine_run_count' as never, { r_id: id }) as unknown as number,
  }).eq('id', id)

  revalidatePath('/dashboard/operations/routines')
}

export async function toggleRoutineStatus(id: string, current: string) {
  const supabase = await createClient()
  const newStatus = current === 'actief' ? 'gepauzeerd' : 'actief'
  await supabase.from('oc_routines').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/routines')
}

export async function deleteRoutine(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_routines').update({ status: 'uitgeschakeld', updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/routines')
}
