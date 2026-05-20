import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectAllAlerts } from '@/lib/executive-layer/alert-detectors'

export const revalidate = 0
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const candidates = await detectAllAlerts(admin)
  if (candidates.length === 0) {
    return NextResponse.json({ detected: 0, inserted: 0, ms: Date.now() - startedAt })
  }

  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: existing } = await admin
    .from('executive_alerts')
    .select('payload')
    .gte('detected_at', since1h)
  const existingDedupes = new Set<string>()
  for (const e of existing ?? []) {
    const key = (e.payload as { dedupe_key?: string } | null)?.dedupe_key
    if (key) existingDedupes.add(key)
  }

  const fresh = candidates.filter(c => !existingDedupes.has(c.dedupe_key))
  if (fresh.length === 0) {
    return NextResponse.json({ detected: candidates.length, inserted: 0, dedup_skipped: candidates.length, ms: Date.now() - startedAt })
  }

  const rows = fresh.map(c => ({
    alert_kind: c.alert_kind,
    severity: c.severity,
    target_kind: c.target_kind,
    target_id: c.target_id,
    title: c.title,
    message: c.message,
    payload: { ...c.payload, dedupe_key: c.dedupe_key },
  }))

  const { error } = await admin.from('executive_alerts').insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byKind: Record<string, number> = {}
  for (const r of fresh) byKind[r.alert_kind] = (byKind[r.alert_kind] ?? 0) + 1

  return NextResponse.json({
    detected: candidates.length,
    inserted: fresh.length,
    dedup_skipped: candidates.length - fresh.length,
    by_kind: byKind,
    ms: Date.now() - startedAt,
  })
}
