import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('mail_workflows').select('*').order('priority', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mail_workflows')
    .insert({
      name:         body.name,
      description:  body.description ?? null,
      trigger_type: body.trigger_type ?? 'routing_rule',
      steps:        body.steps ?? [],
      enabled:      body.enabled ?? true,
      priority:     body.priority ?? 50,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
