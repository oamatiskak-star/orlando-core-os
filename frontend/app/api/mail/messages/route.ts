import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const priority = searchParams.get('priority')
  const category = searchParams.get('category')
  const unread = searchParams.get('unread')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  let query = supabase
    .from('mail_messages')
    .select('*')
    .eq('is_archived', false)
    .order('is_read', { ascending: true })
    .order('received_at', { ascending: false })
    .limit(limit)

  if (priority) query = query.eq('priority', priority)
  if (category) query = query.eq('category', category)
  if (unread === 'true') query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}
