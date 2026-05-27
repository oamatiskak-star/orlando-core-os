'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/infra'

const ALLOWED = new Set([
  'run-cleanup',
  'aggressive-cleanup',
  'emergency-cleanup',
  'reclaim-space',
  'restart-docker',
])

/** Zet een storage-command in de queue. De local-watchdog op de host voert het uit. */
export async function queueStorageCommand(hostId: string, command: string) {
  if (!ALLOWED.has(command)) return { ok: false, error: `Onbekend command: ${command}` }
  if (!hostId) return { ok: false, error: 'Geen host opgegeven' }

  const supabase = await createClient()
  const { error } = await supabase.from('storage_commands').insert({
    host_id: hostId,
    command,
    status: 'pending',
    requested_by: 'dashboard',
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}
