import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const companyId  = searchParams.get('company_id')
  const direction  = searchParams.get('direction')
  const dateFrom   = searchParams.get('date_from')
  const dateTo     = searchParams.get('date_to')
  const search     = searchParams.get('search')
  const page       = parseInt(searchParams.get('page') ?? '1')
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset     = (page - 1) * limit

  const supabase = createAdminClient()

  let query = supabase
    .from('cfo_transactions')
    .select('*, cfo_suppliers(name, category)', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (companyId) query = query.eq('company_id', companyId)
  if (direction)  query = query.eq('direction', direction)
  if (dateFrom)   query = query.gte('transaction_date', dateFrom)
  if (dateTo)     query = query.lte('transaction_date', dateTo)
  if (search) {
    query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    transactions: data ?? [],
    total: count ?? 0,
    page,
    pages: count ? Math.ceil(count / limit) : 1,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body vereist' }, { status: 400 })

  const required = ['company_id', 'direction', 'amount_incl', 'transaction_date']
  for (const field of required) {
    if (!body[field]) return NextResponse.json({ error: `${field} vereist` }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cfo_transactions')
    .insert({
      company_id:       body.company_id,
      source:           body.source ?? 'handmatig',
      direction:        body.direction,
      amount_excl:      body.amount_excl ?? 0,
      amount_vat:       body.amount_vat ?? 0,
      amount_incl:      body.amount_incl,
      vat_pct:          body.vat_pct ?? 21,
      currency:         body.currency ?? 'EUR',
      description:      body.description,
      reference:        body.reference,
      supplier_id:      body.supplier_id,
      ledger_account:   body.ledger_account,
      category:         body.category,
      transaction_date: body.transaction_date,
      status:           body.status ?? 'geboekt',
      approved_by_human: true,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const supabase = createAdminClient()
  const allowedFields = [
    'description','category','ledger_account','ledger_account_code',
    'supplier_id','project_id','status','approved_by_human','notes',
  ]
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('cfo_transactions')
    .update(updates)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
