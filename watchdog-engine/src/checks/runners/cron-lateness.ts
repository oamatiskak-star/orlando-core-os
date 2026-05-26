import { createClient } from '@supabase/supabase-js'
import { parseExpression } from 'cron-parser'
import { CheckResult, CheckRow } from '../types'

export async function runCronLateness(check: CheckRow, supabaseUrl: string, supabaseKey: string): Promise<CheckResult> {
  const slug = String(check.config.slug ?? check.slug)
  const schedule = String(check.config.schedule ?? '')
  const graceSec = Number(check.threshold.grace_seconds ?? 600)
  const tz = String(check.config.timezone ?? 'Europe/Amsterdam')
  if (!schedule) return { ok: false, message: 'config.schedule missing' }

  let expectedRunAt: Date
  try {
    const iter = parseExpression(schedule, { tz, currentDate: new Date() })
    expectedRunAt = iter.prev().toDate()
  } catch (err) {
    return { ok: false, message: `bad cron expression '${schedule}': ${err instanceof Error ? err.message : err}` }
  }

  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const { data, error } = await client
    .from('infra_watchdog_heartbeats')
    .select('slug,last_seen_at,status,meta')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return { ok: false, message: `supabase: ${error.message}` }

  if (!data) {
    // No heartbeat ever: treat as missing. Only fail if at least one run is past due
    // by more than grace (avoids alerting on a brand-new check).
    const overdueSec = Math.round((Date.now() - expectedRunAt.getTime()) / 1000)
    if (overdueSec > graceSec) {
      return {
        ok: false,
        value: overdueSec,
        message: `no heartbeat ever; last expected run ${overdueSec}s ago (grace ${graceSec}s)`,
        metadata: { slug, expected_run_at: expectedRunAt.toISOString() }
      }
    }
    return { ok: true, value: overdueSec, metadata: { slug, expected_run_at: expectedRunAt.toISOString(), note: 'no heartbeat yet but within grace' } }
  }

  const lastSeen = new Date(data.last_seen_at).getTime()
  const expectedSec = Math.round((Date.now() - expectedRunAt.getTime()) / 1000)
  const sinceLastSec = Math.round((Date.now() - lastSeen) / 1000)
  // If the last heartbeat is older than the most recent expected run + grace,
  // the cron either didn't fire or didn't complete.
  const missedSec = Math.round((expectedRunAt.getTime() - lastSeen) / 1000)
  if (missedSec > graceSec) {
    return {
      ok: false,
      value: missedSec,
      message: `last heartbeat ${sinceLastSec}s ago; missed expected run by ${missedSec}s (grace ${graceSec}s)`,
      metadata: { slug, last_seen_at: data.last_seen_at, expected_run_at: expectedRunAt.toISOString() }
    }
  }
  if (data.status && data.status !== 'ok') {
    return {
      ok: false,
      value: sinceLastSec,
      message: `cron heartbeat reports status='${data.status}'`,
      metadata: { slug, last_seen_at: data.last_seen_at, meta: data.meta }
    }
  }
  return {
    ok: true,
    value: sinceLastSec,
    metadata: { slug, last_seen_at: data.last_seen_at, expected_run_at: expectedRunAt.toISOString(), expected_age_sec: expectedSec }
  }
}
