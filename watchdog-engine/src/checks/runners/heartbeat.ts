import { createClient } from '@supabase/supabase-js'
import { CheckResult, CheckRow } from '../types'

export async function runHeartbeat(check: CheckRow, supabaseUrl: string, supabaseKey: string): Promise<CheckResult> {
  const slug = String(check.config.slug ?? check.slug)
  const maxAge = Number(check.threshold.max_age_seconds ?? 600)
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const { data, error } = await client
    .from('infra_watchdog_heartbeats')
    .select('slug,last_seen_at,status,meta')
    .eq('slug', slug)
    .maybeSingle()

  if (error) return { ok: false, message: `supabase: ${error.message}` }
  if (!data) {
    return {
      ok: false,
      message: `no heartbeat ever recorded for slug '${slug}'`,
      metadata: { slug }
    }
  }
  const lastSeen = new Date(data.last_seen_at).getTime()
  const ageSec = Math.round((Date.now() - lastSeen) / 1000)
  if (ageSec > maxAge) {
    return {
      ok: false,
      value: ageSec,
      message: `heartbeat is ${ageSec}s old (threshold ${maxAge}s)`,
      metadata: { last_seen_at: data.last_seen_at, status: data.status }
    }
  }
  if (data.status && data.status !== 'ok') {
    return {
      ok: false,
      value: ageSec,
      message: `heartbeat status='${data.status}'`,
      metadata: { last_seen_at: data.last_seen_at, meta: data.meta }
    }
  }
  return { ok: true, value: ageSec, metadata: { last_seen_at: data.last_seen_at } }
}
