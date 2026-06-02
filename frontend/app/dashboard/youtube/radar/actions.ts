'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/youtube/radar'

/** Zet de status van een content-idee (idea | approved | rejected | promoted). */
export async function setIdeaStatus(id: string, status: 'idea' | 'approved' | 'rejected' | 'promoted') {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_radar_idea_status', { p_id: id, p_status: status })
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null }
}

/** Draait de generator handmatig (vult de queue bij met nieuwe signalen). */
export async function regenerate() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_radar_content_queue')
  revalidatePath(PATH)
  return { ok: !error, error: error?.message ?? null, created: (data as number) ?? 0 }
}
