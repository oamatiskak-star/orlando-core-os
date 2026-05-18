import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const companyId = sp.get('company_id') ?? ''
  const category  = sp.get('category') ?? ''

  let q = supabase
    .from('cfo_subscriptions')
    .select('*')
    .order('name', { ascending: true })

  if (companyId) q = q.eq('company_id', companyId)
  if (category)  q = q.eq('category', category)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ abonnementen: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, company_id, category, amount_monthly, amount_yearly, billing_cycle, next_billing_date, is_essential, notes } = body

  if (!name) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('cfo_subscriptions')
    .insert({
      name,
      company_id:       company_id ?? null,
      category:         category ?? 'software',
      amount_monthly:   amount_monthly ? Number(amount_monthly) : null,
      amount_yearly:    amount_yearly ? Number(amount_yearly) : null,
      billing_cycle:    billing_cycle ?? 'monthly',
      next_billing_date:next_billing_date ?? null,
      is_active:        true,
      is_essential:     is_essential ?? false,
      ai_detected:      false,
      notes:            notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ abonnement: data }, { status: 201 })
}
