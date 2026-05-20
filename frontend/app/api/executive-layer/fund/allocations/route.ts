import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 200)

  let query = admin
    .from('content_fund_allocations')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const channelIds = Array.from(new Set((data ?? []).map(a => a.channel_id as string).filter(Boolean)))
  const { data: channels } = channelIds.length > 0
    ? await admin.from('media_holding_channels').select('id,name,niche').in('id', channelIds)
    : { data: [] }
  const channelMap = new Map<string, { name: string; niche: string | null }>()
  for (const c of channels ?? []) {
    channelMap.set(c.id as string, { name: c.name as string, niche: (c.niche as string | null) ?? null })
  }

  const enriched = (data ?? []).map(a => ({
    ...a,
    channel_name: a.channel_id ? channelMap.get(a.channel_id as string)?.name ?? null : null,
  }))

  return NextResponse.json({ allocations: enriched })
}
