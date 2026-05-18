import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const unresolved = searchParams.get('unresolved') !== 'false'
  const limit      = parseInt(searchParams.get('limit') ?? '50')

  const supabase = createAdminClient()

  let query = supabase
    .from('cfo_risk_alerts')
    .select('*')
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unresolved) {
    query = query.eq('is_resolved', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ alerts: data ?? [], count: data?.length ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, action } = body

  if (!id || !action) {
    return NextResponse.json({ error: 'id en action vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (action === 'resolve') {
    const { error } = await supabase
      .from('cfo_risk_alerts')
      .update({
        is_resolved:  true,
        resolved_at:  new Date().toISOString(),
        resolved_by:  'gebruiker',
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
}
