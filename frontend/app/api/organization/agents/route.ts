import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const system = sp.get('system')
  const limit = parseInt(sp.get('limit') ?? '100')
  const offset = parseInt(sp.get('offset') ?? '0')

  const { data, error } = await supabase.rpc('get_organization_agents', {
    p_status: status,
    p_system: system,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ agents: data ?? [] })
}
