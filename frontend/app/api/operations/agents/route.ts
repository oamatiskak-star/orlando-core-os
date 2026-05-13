import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const status = searchParams.get('status')

  let query = supabase.from('oc_ai_agents').select('*').order('naam', { ascending: true })
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
    .from('oc_ai_agents')
    .insert({
      naam: body.naam,
      type: body.type,
      company: body.company ?? 'MODIWÉ',
      model: body.model ?? 'gpt-4o',
      system_prompt: body.system_prompt ?? null,
      capabilities: body.capabilities ?? [],
      config: body.config ?? {},
      queue_name: body.queue_name ?? null,
      status: 'idle',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
