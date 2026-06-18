'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/sessions'

/** Zet de autopilot-vlag op een scope (global '*', host <host>, session <session_id>). */
export async function setAutopilot(
  scope: 'global' | 'host' | 'session',
  scopeId: string,
  on: boolean,
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('hermes_autopilot_set', {
    p_scope: scope,
    p_scope_id: scopeId,
    p_on: on,
  })
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null }
}

/** Stuurt "ga verder" naar de terminal van deze sessie via osm_terminal_commands. */
export async function resumeSession(host: string, cwd: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('hermes_resume_session', {
    p_host: host,
    p_cwd: cwd,
  })
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null, id: (data as string) ?? null }
}

/** Verwijdert één (dode/oude) sessie uit de lijst. Echt-actieve sessies komen
 *  vanzelf terug zodra ze een volgend event schrijven. */
export async function deleteSession(host: string, sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('hermes_delete_session', {
    p_host: host,
    p_session_id: sessionId,
  })
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null }
}

/** Ruimt in bulk alle sessies op die langer dan idleMinutes geen event hadden
 *  en niet meer 'working' zijn. Geeft het aantal opgeschoonde sessies terug. */
export async function clearStaleSessions(idleMinutes = 60) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('hermes_clear_stale_sessions', {
    p_idle_minutes: idleMinutes,
  })
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null, count: (data as number) ?? 0 }
}
