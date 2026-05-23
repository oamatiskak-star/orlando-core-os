'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function decideApproval(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '') as 'approved' | 'declined' | 'deferred'
  const note = String(formData.get('note') ?? '') || null

  if (!id || !['approved', 'declined', 'deferred'].includes(decision)) {
    return { ok: false, error: 'invalid_input' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('aquier_approvals')
    .update({
      status: decision,
      decided_by: 'Orlando',
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq('id', id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/aquier/approvals')
  revalidatePath('/dashboard/aquier')
  return { ok: true }
}
