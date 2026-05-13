import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  let query = supabase
    .from('oc_api_connections')
    .select('id, naam, company, service, base_url, auth_type, status, last_tested_at, last_error, created_at')
    .order('naam', { ascending: true })

  if (company) query = query.eq('company', company)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('oc_api_connections')
    .insert({
      naam: body.naam,
      company: body.company ?? 'MODIWÉ',
      service: body.service,
      base_url: body.base_url ?? null,
      auth_type: body.auth_type ?? 'api_key',
      credentials: body.credentials ?? {},
      status: 'actief',
    })
    .select('id, naam, company, service, base_url, auth_type, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
