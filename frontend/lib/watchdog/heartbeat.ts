import { createAdminClient } from '@/lib/supabase/admin'

// reportHeartbeat — write the success heartbeat for a watchdog-registered slug.
// Used by every Vercel cron route at the end of its success path so the
// organization watchdog (cron_lateness check) can detect missed runs.
// Never throws — failure to record a heartbeat must not break the route.
export async function reportHeartbeat(
  slug: string,
  meta?: Record<string, unknown>,
  status: 'ok' | 'degraded' | 'error' = 'ok',
): Promise<void> {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    await admin
      .from('infra_watchdog_heartbeats')
      .upsert({ slug, last_seen_at: now, status, meta: meta ?? null, updated_at: now })
  } catch (err) {
    console.error('[watchdog-heartbeat] failed:', err instanceof Error ? err.message : err, 'slug=', slug)
  }
}
