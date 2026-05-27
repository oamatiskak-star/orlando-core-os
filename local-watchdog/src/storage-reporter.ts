// storage-reporter.ts
// Schrijft de storage-guard state als heartbeat naar host_storage_status
// (migratie 099). Het dashboard leest deze tabel. Service-role → bypasst RLS.

import { getClient } from './supabase-state'
import { getStorageState, HOST_ID } from './storage-guard'

export async function reportStorageStatus(): Promise<void> {
  const c = getClient()
  if (!c) return
  const s = getStorageState()
  // Niets te rapporteren vóór de eerste check.
  if (s.lastCheckAt === null) return
  try {
    const { error } = await c.from('host_storage_status').upsert(
      {
        host_id: HOST_ID,
        disk_pct: s.diskPct,
        free_gb: s.freeGb,
        used_gb: s.usedGb,
        size_gb: null,
        docker_raw_gb: s.dockerRawGb,
        tier: s.lastTier,
        last_actions: s.lastAction,
        last_truncated: s.lastTruncated,
        reclaimed_gb_total: s.reclaimedGbTotal,
        last_error: s.lastError,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'host_id' }
    )
    if (error) console.error('[storage-reporter] upsert error:', error.message)
  } catch (err) {
    console.error('[storage-reporter] upsert throw:', err instanceof Error ? err.message : err)
  }
}
