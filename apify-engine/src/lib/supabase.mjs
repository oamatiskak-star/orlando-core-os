import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SERVICE_KEY } from '../config.mjs'

let _client = null

export function db() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _client
}

export async function windowOpen(engineKey) {
  const { data, error } = await db().rpc('engine_window_open', { p_engine_key: engineKey })
  if (error) throw new Error(`engine_window_open(${engineKey}): ${error.message}`)
  return !!data
}

export async function heartbeat(slug, meta = {}, status = 'ok') {
  const now = new Date().toISOString()
  await db()
    .from('infra_watchdog_heartbeats')
    .upsert({ slug, last_seen_at: now, status, meta, updated_at: now })
    .throwOnError()
}
