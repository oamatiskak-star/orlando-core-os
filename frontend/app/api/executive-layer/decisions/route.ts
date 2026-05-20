import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 200)

  const { data: channels, error: chErr } = await admin
    .from('media_holding_channels')
    .select('id,name,niche,status,current_status,current_status_at,target_views_10d,current_views_10d')
    .order('current_status_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 })

  const channelIds = (channels ?? []).map(c => c.id as string)
  const { data: latestDecisions } = await admin
    .from('executive_decisions')
    .select('channel_id,status,confidence,decided_at,rationale')
    .in('channel_id', channelIds)
    .order('decided_at', { ascending: false })
    .limit(limit * 5)

  const latestByChannel = new Map<string, {
    status: string; confidence: number; decided_at: string; rationale: unknown
  }>()
  for (const d of latestDecisions ?? []) {
    const cid = d.channel_id as string
    if (!latestByChannel.has(cid)) {
      latestByChannel.set(cid, {
        status: d.status as string,
        confidence: Number(d.confidence ?? 0),
        decided_at: d.decided_at as string,
        rationale: d.rationale,
      })
    }
  }

  const rows = (channels ?? []).map(c => ({
    channel_id: c.id,
    channel_name: c.name,
    niche: c.niche,
    operational_status: c.status,
    decision: latestByChannel.get(c.id as string) ?? null,
    target_views_10d: c.target_views_10d,
    current_views_10d: c.current_views_10d,
  }))

  return NextResponse.json({ channels: rows })
}
