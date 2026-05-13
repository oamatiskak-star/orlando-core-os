import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const status = searchParams.get('status')

  let query = supabase.from('oc_routines').select('*').order('naam', { ascending: true })
  if (company) query = query.eq('company', company)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_routines')
    .insert({
      naam: body.naam,
      omschrijving: body.omschrijving ?? null,
      company: body.company ?? 'MODIWÉ',
      category: body.category ?? null,
      schedule: body.schedule,
      steps: body.steps ?? [],
      status: 'actief',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
