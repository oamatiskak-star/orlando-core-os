import { getSupabase } from './supabase'

// reportHeartbeat — signals liveness to the organization watchdog. Never throws.
export async function reportHeartbeat(
  slug: string,
  meta?: Record<string, unknown>,
  status: 'ok' | 'degraded' | 'error' = 'ok',
): Promise<void> {
  try {
    const db = getSupabase()
    const now = new Date().toISOString()
    await db
      .from('infra_watchdog_heartbeats')
      .upsert({ slug, last_seen_at: now, status, meta: meta ?? null, updated_at: now })
  } catch (err) {
    console.error('[watchdog-heartbeat] failed:', err instanceof Error ? err.message : err, 'slug=', slug)
  }
}
