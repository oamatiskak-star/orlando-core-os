import { createAdminClient } from '@/lib/supabase/admin'

// Generieke Engine-Planner gate. Vraagt engine_window_open() op zodat een job
// alleen draait binnen zijn tijdblok (/dashboard/planner). Bij een leesfout → true
// zodat een job nooit stil valt door een infrafout (fail-open).
export async function engineWindowOpen(engineKey: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('engine_window_open', { p_engine_key: engineKey })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}
