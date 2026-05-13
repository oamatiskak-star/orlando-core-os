import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'
  const company = searchParams.get('company')

  let query = supabase
    .from('oc_ai_suggestions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (company) query = query.eq('company', company)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const action = body.action as 'dismiss' | 'apply' | undefined
  const id = body.id as string | undefined

  if (action && id) {
    const update =
      action === 'dismiss'
        ? { status: 'dismissed', dismissed_at: new Date().toISOString() }
        : { status: 'applied', applied_at: new Date().toISOString() }

    const { error } = await supabase.from('oc_ai_suggestions').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action })
  }

  const { data, error } = await supabase
    .from('oc_ai_suggestions')
    .insert({
      company: body.company ?? 'MODIWÉ',
      type: body.type,
      title: body.title,
      description: body.description,
      impact: body.impact ?? 'medium',
      related_workflow_id: body.related_workflow_id ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
