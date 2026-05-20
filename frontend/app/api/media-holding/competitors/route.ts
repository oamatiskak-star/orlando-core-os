import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/competitors
// Lijst competitors + upload-freq join + open signals count.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const platform = req.nextUrl.searchParams.get('platform')
  const niche    = req.nextUrl.searchParams.get('niche')

  let q = supabase
    .from('competitor_channels')
    .select('*')
    .eq('active', true)
    .order('subscriber_count', { ascending: false })
  if (platform) q = q.eq('platform', platform)
  if (niche)    q = q.eq('niche', niche)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const competitors = rows ?? []

  // Upload freq + open signals counts
  const ids = competitors.map((c) => c.id)
  const [{ data: freqRows }, { data: signalCounts }] = await Promise.all([
    ids.length
      ? supabase.from('competitor_upload_freq').select('*').in('competitor_id', ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabase.from('competitor_signals')
          .select('competitor_id')
          .is('acknowledged_at', null)
          .in('competitor_id', ids)
      : Promise.resolve({ data: [] as { competitor_id: string }[] }),
  ])

  const freqById = new Map((freqRows ?? []).map((f) => [(f as { competitor_id: string }).competitor_id, f]))
  const openByCompetitor = new Map<string, number>()
  for (const r of signalCounts ?? []) {
    openByCompetitor.set(r.competitor_id, (openByCompetitor.get(r.competitor_id) ?? 0) + 1)
  }

  return NextResponse.json({
    competitors: competitors.map((c) => ({
      ...c,
      freq: freqById.get(c.id) ?? null,
      open_signals: openByCompetitor.get(c.id) ?? 0,
    })),
  })
}

// POST /api/media-holding/competitors
// Body: { platform, external_id, name, handle?, niche?, language?, url?, thumbnail_url?, watched_by_channel?, notes? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.platform || !body.external_id || !body.name) {
    return NextResponse.json({ error: 'platform, external_id en name zijn vereist' }, { status: 400 })
  }
  const validPlatforms = ['youtube','tiktok','instagram','facebook','snapchat']
  if (!validPlatforms.includes(body.platform)) {
    return NextResponse.json({ error: `platform moet één van: ${validPlatforms.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('competitor_channels')
    .upsert({
      platform:           body.platform,
      external_id:        body.external_id,
      name:               body.name,
      handle:             body.handle ?? null,
      niche:              body.niche ?? null,
      language:           body.language ?? null,
      url:                body.url ?? null,
      thumbnail_url:      body.thumbnail_url ?? null,
      subscriber_count:   body.subscriber_count ?? 0,
      video_count:        body.video_count ?? 0,
      total_view_count:   body.total_view_count ?? 0,
      watched_by_channel: body.watched_by_channel ?? null,
      notes:              body.notes ?? null,
      active:             true,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'platform,external_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitor: data }, { status: 201 })
}
