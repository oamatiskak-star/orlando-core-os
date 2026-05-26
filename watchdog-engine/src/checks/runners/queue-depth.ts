import { createClient } from '@supabase/supabase-js'
import { CheckResult, CheckRow } from '../types'

export async function runQueueDepth(check: CheckRow, supabaseUrl: string, supabaseKey: string): Promise<CheckResult> {
  const table = String(check.config.table ?? '')
  const statusColumn = String(check.config.status_column ?? 'status')
  const ageColumn = String(check.config.age_column ?? 'created_at')
  const pendingStates = Array.isArray(check.config.pending_states)
    ? (check.config.pending_states as string[])
    : ['pending']
  if (!table) return { ok: false, message: 'config.table missing' }

  const maxPending = Number(check.threshold.max_pending ?? 0)
  const maxAgeMin = Number(check.threshold.max_age_minutes ?? 0)
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const { count, error: countErr } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .in(statusColumn, pendingStates)
  if (countErr) return { ok: false, message: `count: ${countErr.message}` }
  const pending = count ?? 0

  let oldestAgeMin = 0
  if (pending > 0) {
    const { data, error } = await client
      .from(table)
      .select(`${ageColumn}`)
      .in(statusColumn, pendingStates)
      .order(ageColumn, { ascending: true })
      .limit(1)
    if (error) return { ok: false, message: `oldest: ${error.message}` }
    if (data && data[0]) {
      const row = data[0] as unknown as Record<string, string>
      const ts = new Date(row[ageColumn]).getTime()
      oldestAgeMin = Math.round((Date.now() - ts) / 60000)
    }
  }

  const overDepth = maxPending > 0 && pending > maxPending
  const overAge = maxAgeMin > 0 && oldestAgeMin > maxAgeMin
  if (overDepth || overAge) {
    return {
      ok: false,
      value: pending,
      message: `${pending} pending (max ${maxPending}); oldest ${oldestAgeMin}min (max ${maxAgeMin}min)`,
      metadata: { pending, oldest_age_minutes: oldestAgeMin, over_depth: overDepth, over_age: overAge }
    }
  }
  return {
    ok: true,
    value: pending,
    metadata: { pending, oldest_age_minutes: oldestAgeMin }
  }
}
