import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp       = req.nextUrl.searchParams
  const platform = sp.get('platform') ?? ''
  const status   = sp.get('status') ?? ''
  const limit    = Math.min(parseInt(sp.get('limit') ?? '100'), 500)
  const offset   = parseInt(sp.get('offset') ?? '0')

  let q = supabase
    .from('social_posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (platform) q = q.eq('platform', platform)
  if (status)   q = q.eq('status', status)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { platform, content_type, caption, hashtags, scheduled_at, notes } = body

  if (!platform) return NextResponse.json({ error: 'platform vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      platform,
      content_type: content_type ?? 'post',
      status:       scheduled_at ? 'scheduled' : 'concept',
      caption:      caption ?? null,
      hashtags:     hashtags ?? null,
      scheduled_at: scheduled_at ?? null,
      notes:        notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ post: data }, { status: 201 })
}
