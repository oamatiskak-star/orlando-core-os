import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = supabase
    .from('mobile_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

// Internal: create notification (called by executor or server actions)
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Allow service-role via x-service-key header OR authenticated user
  const serviceKey = req.headers.get('x-service-key')
  const isService  = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!isService) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { user_id, type, title, body: notifBody, metadata } = body

  if (!title || !type) {
    return NextResponse.json({ error: 'title and type required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('mobile_notifications').insert({
    user_id:  user_id ?? null,
    type:     type ?? 'info',
    title,
    body:     notifBody ?? '',
    metadata: metadata ?? {},
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}

// Mark all as read
export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('mobile_notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Delete all notifications
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('mobile_notifications')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
