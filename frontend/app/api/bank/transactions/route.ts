import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const params   = req.nextUrl.searchParams
  const limit    = parseInt(params.get('limit') ?? '50')
  const offset   = parseInt(params.get('offset') ?? '0')
  const category = params.get('category')
  const month    = params.get('month') // '2025-05'
  const direction= params.get('direction')

  const supabase = createAdminClient()

  let query = supabase
    .from('personal_transactions')
    .select('*', { count: 'exact' })
    .order('booking_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category)  query = query.eq('category', category)
  if (direction) query = query.eq('direction', direction)
  if (month) {
    const [y, m] = month.split('-')
    const start = `${y}-${m}-01`
    const end   = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0]
    query = query.gte('booking_date', start).lte('booking_date', end)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Samenvatting
  const income   = (data ?? []).filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)
  const expenses = (data ?? []).filter(t => t.direction === 'debet').reduce((s, t) => s + t.amount, 0)

  return NextResponse.json({
    transactions: data ?? [],
    total:        count ?? 0,
    income,
    expenses,
    balance:      income - expenses,
  })
}

// PATCH — update categorie van transactie
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.id || !body?.category) {
    return NextResponse.json({ error: 'id en category vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('personal_transactions')
    .update({ category: body.category, subcategory: body.subcategory ?? null, ai_confidence: 1.0 })
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
