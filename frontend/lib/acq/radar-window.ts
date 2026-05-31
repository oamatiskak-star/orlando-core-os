import { createAdminClient } from '@/lib/supabase/admin'

// Planner-gate voor de acquisitie-radars. Vraagt engine_window_open() op zodat
// een radar alleen draait binnen zijn tijdblok (/dashboard/planner). Bij twijfel
// (RPC-fout) → true, zodat een radar nooit stil valt door een leesfout.
export async function radarWindowOpen(scanSlug: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('engine_window_open', {
      p_engine_key: `acq_radar:${scanSlug}`,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}
