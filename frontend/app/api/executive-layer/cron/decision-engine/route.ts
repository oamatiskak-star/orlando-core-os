import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyAllChannels } from '@/lib/executive-layer/decision-engine'

export const revalidate = 0
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  const outcomes = await classifyAllChannels(admin)
  if (outcomes.length === 0) {
    return NextResponse.json({ decided: 0, transitions: 0, ms: Date.now() - startedAt })
  }

  const rows = outcomes.map(o => ({
    channel_id: o.channel_id,
    status: o.status,
    confidence: o.confidence,
    rationale: o.rationale,
    metrics_snapshot: o.metrics,
  }))

  const { error } = await admin.from('executive_decisions').insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { count: transitions } = await admin
    .from('channel_status_history')
    .select('id', { count: 'exact', head: true })
    .gte('changed_at', since)

  const byStatus: Record<string, number> = {}
  for (const o of outcomes) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1

  return NextResponse.json({
    decided: rows.length,
    transitions: transitions ?? 0,
    by_status: byStatus,
    ms: Date.now() - startedAt,
  })
}
