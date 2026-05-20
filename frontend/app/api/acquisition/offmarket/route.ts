import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const lead_type = searchParams.get('lead_type')
  const province = searchParams.get('province')
  const status = searchParams.get('status')

  let query = supabase
    .from('acq_offmarket_leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (lead_type) query = query.eq('lead_type', lead_type)
  if (province) query = query.eq('province', province)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { data, error } = await supabase.from('acq_offmarket_leads').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
