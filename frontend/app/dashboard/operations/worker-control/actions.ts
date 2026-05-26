'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/operations/worker-control'

async function ensureControllable(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('worker_registry')
    .select('id, controllable')
    .eq('id', id)
    .maybeSingle()
  if (error) return { supabase, error: error.message as string | null }
  if (!data) return { supabase, error: `Worker "${id}" niet gevonden` }
  if (!data.controllable) return { supabase, error: 'Deze worker draait niet lokaal (geen PM2-besturing mogelijk)' }
  return { supabase, error: null }
}

/** Zet de gewenste eindtoestand. De local-watchdog brengt PM2 in lijn. */
export async function setWorkerState(id: string, state: 'running' | 'stopped') {
  const { supabase, error } = await ensureControllable(id)
  if (error) return { ok: false, error }

  const { error: updErr } = await supabase
    .from('worker_registry')
    .update({
      desired_state: state,
      last_command: state === 'running' ? 'start' : 'stop',
      last_command_at: new Date().toISOString(),
      last_command_by: 'dashboard',
      last_command_result: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) return { ok: false, error: updErr.message }
  revalidatePath(PATH)
  return { ok: true }
}

/** Vraag een herstart aan (desired_state blijft running). */
export async function restartWorker(id: string) {
  const { supabase, error } = await ensureControllable(id)
  if (error) return { ok: false, error }

  const { error: updErr } = await supabase
    .from('worker_registry')
    .update({
      desired_state: 'running',
      restart_requested_at: new Date().toISOString(),
      last_command: 'restart',
      last_command_at: new Date().toISOString(),
      last_command_by: 'dashboard',
      last_command_result: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) return { ok: false, error: updErr.message }
  revalidatePath(PATH)
  return { ok: true }
}

/** Herstart alle lokaal bestuurbare workers in één keer. */
export async function restartAllControllable() {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('worker_registry')
    .update({
      desired_state: 'running',
      restart_requested_at: now,
      last_command: 'restart',
      last_command_at: now,
      last_command_by: 'dashboard',
      last_command_result: null,
      updated_at: now,
    })
    .eq('controllable', true)
    .select('id')

  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true, count: data?.length ?? 0 }
}
