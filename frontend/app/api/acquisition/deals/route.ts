import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const province = searchParams.get('province')
  const object_type = searchParams.get('object_type')
  const pipeline_stage = searchParams.get('pipeline_stage')
  const min_roi = searchParams.get('min_roi')
  const min_score = searchParams.get('min_score')

  let query = supabase
    .from('acq_deals')
    .select('*', { count: 'exact' })
    .eq('status', 'actief')
    .order('created_at', { ascending: false })

  if (province) query = query.eq('province', province)
  if (object_type) query = query.eq('object_type', object_type)
  if (pipeline_stage) query = query.eq('pipeline_stage', pipeline_stage)
  if (min_roi) query = query.gte('roi_pct', parseFloat(min_roi))
  if (min_score) query = query.gte('ai_score', parseInt(min_score))

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('acq_deals')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
