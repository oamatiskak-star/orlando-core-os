'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUS = ['active', 'paused', 'context_full', 'crashed', 'done'] as const
type SessionStatus = (typeof VALID_STATUS)[number]

function revalidateSession(id: string) {
  revalidatePath('/dashboard/osm/sessions')
  revalidatePath('/dashboard/build-tracker')
  revalidatePath(`/dashboard/osm/sessions/${id}`)
}

export async function setSessionStatus(id: string, status: SessionStatus) {
  if (!VALID_STATUS.includes(status)) {
    return { ok: false, error: 'invalid status' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('osm_sessions')
    .update({ status })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateSession(id)
  return { ok: true }
}

/**
 * Stop een sessie: zet de status op 'done' (closed/inactive volgens de bestaande
 * status-conventie) + leg een stop-reden vast. Verwijdert GEEN build, tracker-items,
 * commits of logs — sluit alleen het sessie-proces logisch af. Gestopte sessies vallen
 * uit de actieve lijst maar blijven historisch zichtbaar op /dashboard/osm/sessions.
 *
 * Er is geen fysieke OS-process-kill: de sessie-runner kent geen veilige remote-kill,
 * dus we markeren de sessie als afgesloten (zie eindrapport).
 */
export async function stopSession(id: string, reason = 'Gestopt via dashboard') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'auth required' }
  const { error } = await supabase
    .from('osm_sessions')
    .update({ status: 'done', stop_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateSession(id)
  return { ok: true }
}

/**
 * Archiveer (soft-delete) een sessie: zet archived_at zodat de sessie uit alle actieve
 * dashboardlijsten verdwijnt. De rij + alle gekoppelde data blijven bestaan (herstelbaar).
 * Verwijdert GEEN build-tracker items, commits, PR-data of logs.
 */
export async function archiveSession(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'auth required' }
  const { error } = await supabase
    .from('osm_sessions')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateSession(id)
  return { ok: true }
}
