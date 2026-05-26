// Copy this file into any engine that needs to report a heartbeat to the
// organization watchdog. Add `@supabase/supabase-js` to that engine's deps if
// it isn't already there (most are).
//
// Usage in an engine's main loop:
//
//   import { reportHeartbeat } from './watchdog-heartbeat'
//   ...
//   setInterval(() => {
//     reportHeartbeat('engine.youtube-engine.tick', { videos_processed: count })
//       .catch((e) => console.error('[heartbeat]', e))
//   }, 60_000)
//
// Usage in a Vercel cron route:
//
//   await reportHeartbeat('cron.vercel.viral-scan', { items: results.length })
//   return Response.json({ ok: true })
//
// Slugs must match a row in infra_watchdog_checks.config.slug (see migration 085).

import { createClient } from '@supabase/supabase-js'

let cached: ReturnType<typeof createClient> | null = null
function client() {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('reportHeartbeat: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

export async function reportHeartbeat(
  slug: string,
  meta?: Record<string, unknown>,
  status: 'ok' | 'degraded' | 'error' = 'ok'
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await client()
    .from('infra_watchdog_heartbeats')
    .upsert({ slug, last_seen_at: now, status, meta: meta ?? null, updated_at: now })
  if (error) throw new Error(`heartbeat upsert: ${error.message}`)
}
