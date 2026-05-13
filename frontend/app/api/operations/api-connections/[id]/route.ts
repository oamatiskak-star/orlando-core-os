import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('oc_api_connections')
    .select('id, naam, company, service, base_url, auth_type, status, last_tested_at, last_error, created_at')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { credentials: _c, ...safeBody } = body
  const updateData: Record<string, unknown> = { ...safeBody, updated_at: new Date().toISOString() }
  if (body.credentials) updateData.credentials = body.credentials

  const { data, error } = await supabase
    .from('oc_api_connections')
    .update(updateData)
    .eq('id', id)
    .select('id, naam, company, service, base_url, auth_type, status, last_tested_at, last_error, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('oc_api_connections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('oc_api_connections')
    .select('base_url')
    .eq('id', id)
    .single()

  if (!conn?.base_url) {
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: 'No base URL configured',
      status: 'error',
    }).eq('id', id)
    return NextResponse.json({ success: false, error: 'No base URL' })
  }

  try {
    const res = await fetch(conn.base_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    const status = res.ok ? 'actief' : 'error'
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: res.ok ? null : `HTTP ${res.status}`,
      status,
    }).eq('id', id)
    return NextResponse.json({ success: res.ok, status_code: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: message,
      status: 'error',
    }).eq('id', id)
    return NextResponse.json({ success: false, error: message })
  }
}
