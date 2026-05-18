import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const status = req.nextUrl.searchParams.get('status')

  let q = supabase.from('osil_opportunities').select('*').order('ai_score', { ascending: false })
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunities: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase.from('osil_opportunities').insert({
    source: body.source ?? 'manual',
    category: body.category,
    title: body.title,
    description: body.description ?? null,
    potential_value: body.potential_value ?? null,
    probability_pct: body.probability_pct ?? 0,
    time_horizon: body.time_horizon ?? 'kwartaal',
    status: 'radar',
    ai_score: body.ai_score ?? 0,
    linked_company_id: body.linked_company_id ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunity: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, ...updates } = body

  const { data, error } = await supabase.from('osil_opportunities').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunity: data })
}
