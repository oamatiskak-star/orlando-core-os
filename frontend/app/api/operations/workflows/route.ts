import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  let query = supabase.from('oc_workflows').select('*').order('naam', { ascending: true })
  if (company) query = query.eq('company', company)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_workflows')
    .insert({
      naam: body.naam,
      omschrijving: body.omschrijving ?? null,
      company: body.company ?? 'MODIWÉ',
      category: body.category ?? null,
      trigger_type: body.trigger_type ?? 'manual',
      trigger_config: body.trigger_config ?? {},
      steps: body.steps ?? [],
      status: 'actief',
      tags: body.tags ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
