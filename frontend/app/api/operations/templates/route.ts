import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const templateType = searchParams.get('template_type')

  let query = supabase.from('oc_automation_templates').select('*').order('naam', { ascending: true })
  if (category) query = query.eq('category', category)
  if (templateType) query = query.eq('template_type', templateType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_automation_templates')
    .insert({
      naam: body.naam,
      omschrijving: body.omschrijving ?? null,
      category: body.category,
      template_type: body.template_type,
      template_data: body.template_data ?? {},
      is_system: false,
      icon: body.icon ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
