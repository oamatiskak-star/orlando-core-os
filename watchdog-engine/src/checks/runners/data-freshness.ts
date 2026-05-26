import { createClient } from '@supabase/supabase-js'
import { CheckResult, CheckRow } from '../types'

export async function runDataFreshness(check: CheckRow, supabaseUrl: string, supabaseKey: string): Promise<CheckResult> {
  const table = String(check.config.table ?? '')
  const tsCol = String(check.config.timestamp_column ?? 'created_at')
  const maxAgeMin = Number(check.threshold.max_age_minutes ?? 0)
  if (!table || maxAgeMin <= 0) {
    return { ok: false, message: 'config.table or threshold.max_age_minutes missing' }
  }
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  let query = client
    .from(table)
    .select(tsCol)
    .order(tsCol, { ascending: false })
    .limit(1)

  if (check.config.where && typeof check.config.where === 'object') {
    for (const [col, val] of Object.entries(check.config.where as Record<string, unknown>)) {
      query = query.eq(col, val as never)
    }
  }

  const { data, error } = await query
  if (error) return { ok: false, message: `supabase: ${error.message}` }
  if (!data || data.length === 0) {
    return { ok: false, message: `table '${table}' empty or unreadable` }
  }
  const row = data[0] as unknown as Record<string, string>
  const latest = new Date(row[tsCol]).getTime()
  const ageMin = Math.round((Date.now() - latest) / 60000)
  if (ageMin > maxAgeMin) {
    return {
      ok: false,
      value: ageMin,
      message: `latest row is ${ageMin}min old (threshold ${maxAgeMin}min)`,
      metadata: { table, latest_at: new Date(latest).toISOString() }
    }
  }
  return {
    ok: true,
    value: ageMin,
    metadata: { table, latest_at: new Date(latest).toISOString() }
  }
}
