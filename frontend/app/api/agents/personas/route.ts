import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const VALID_TYPES = ['core', 'business', 'specialist', 'human'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const type = sp.get('type')

  let q = supabase
    .from('agent_personas')
    .select('*')
    .order('persona_type', { ascending: true })
    .order('name', { ascending: true })

  if (type && (VALID_TYPES as readonly string[]).includes(type)) {
    q = q.eq('persona_type', type)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ personas: data ?? [] })
}
