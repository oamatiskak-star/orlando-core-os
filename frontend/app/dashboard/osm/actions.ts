'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUS = ['active', 'paused', 'context_full', 'crashed', 'done'] as const
type SessionStatus = (typeof VALID_STATUS)[number]

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
  revalidatePath('/dashboard/osm/sessions')
  revalidatePath('/dashboard/build-tracker')
  revalidatePath(`/dashboard/osm/sessions/${id}`)
  return { ok: true }
}
