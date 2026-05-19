import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const minScore = parseInt(sp.get('min_score') ?? '0', 10)
  const platform = sp.get('platform')
  const limit = Math.min(500, parseInt(sp.get('limit') ?? '100', 10))

  let q = supabase
    .from('viral_opportunities')
    .select('*')
    .order('virality_score', { ascending: false })
    .order('captured_at', { ascending: false })
    .limit(limit)

  if (minScore > 0) q = q.gte('virality_score', minScore)
  if (platform)     q = q.eq('source_platform', platform)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunities: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const required = ['source_platform', 'external_id', 'title']
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `${k} vereist` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('viral_opportunities')
    .upsert({
      source_platform:     body.source_platform,
      external_id:         body.external_id,
      title:               body.title,
      url:                 body.url ?? null,
      thumbnail_url:       body.thumbnail_url ?? null,
      channel_name:        body.channel_name ?? null,
      channel_external_id: body.channel_external_id ?? null,
      niche:               body.niche ?? null,
      language:            body.language ?? null,
      duration_seconds:    body.duration_seconds ?? null,
      published_at:        body.published_at ?? null,
      views:               body.views ?? 0,
      likes:               body.likes ?? 0,
      comments:            body.comments ?? 0,
      view_velocity:       body.view_velocity ?? 0,
      retention_score:     body.retention_score ?? 0,
      saturation_score:    body.saturation_score ?? 50,
      automation_score:    body.automation_score ?? 50,
      virality_score:      body.virality_score ?? 0,
      revenue_potential:   body.revenue_potential ?? 0,
      raw_payload:         body.raw_payload ?? {},
    }, { onConflict: 'source_platform,external_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunity: data }, { status: 201 })
}
