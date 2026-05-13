import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  let query = supabase.from('oc_webhooks').select('*').order('naam', { ascending: true })
  if (company) query = query.eq('company', company)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const endpointPath = (body.endpoint_path as string)
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_/]/g, '-')

  const { data, error } = await supabase
    .from('oc_webhooks')
    .insert({
      naam: body.naam,
      company: body.company ?? 'MODIWÉ',
      endpoint_path: endpointPath,
      secret: crypto.randomUUID().replace(/-/g, ''),
      workflow_id: body.workflow_id ?? null,
      method: body.method ?? 'POST',
      headers_filter: body.headers_filter ?? null,
      status: 'actief',
      trigger_count: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
