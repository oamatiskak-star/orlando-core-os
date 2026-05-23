import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60 // Revalidate every 60 seconds

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const projectType = sp.get('type') ?? ''
  const status = sp.get('status') ?? ''

  let query = supabase
    .from('youtube_projects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (projectType) query = query.eq('type', projectType)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    projects: data ?? [],
    total: count ?? 0,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    name,
    description,
    type,
    status,
    goal_description,
    success_metrics,
    channels,
    clusters,
    metadata,
  } = body

  if (!name) return NextResponse.json({ error: 'Naam vereist' }, { status: 400 })
  if (!type) return NextResponse.json({ error: 'Type vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('youtube_projects')
    .insert({
      name,
      description: description ?? null,
      type,
      status: status ?? 'planning',
      goal_description: goal_description ?? null,
      success_metrics: success_metrics ?? [],
      channels: channels ?? [],
      clusters: clusters ?? [],
      metadata: metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data }, { status: 201 })
}
