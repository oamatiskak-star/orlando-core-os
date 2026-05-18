import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — alle budgetten + actuals voor een maand
export async function GET(req: NextRequest) {
  const month   = req.nextUrl.searchParams.get('month')
  const supabase = createAdminClient()

  const { data: budgets, error } = await supabase
    .from('personal_budgets')
    .select('*')
    .order('category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actuals voor de maand ophalen als month param meegestuurd
  let actuals: Record<string, number> = {}
  if (month) {
    const { data: cats } = await supabase.rpc('personal_finance_cat_maand', { p_month: month })
    for (const row of (cats ?? [])) {
      actuals[row.category] = Number(row.uitgaven)
    }
  }

  const result = (budgets ?? []).map(b => ({
    ...b,
    uitgaven: actuals[b.category] ?? 0,
    resterend: b.maandbudget - (actuals[b.category] ?? 0),
    pct: b.maandbudget > 0 ? Math.round(((actuals[b.category] ?? 0) / b.maandbudget) * 100) : 0,
  }))

  return NextResponse.json({ budgets: result })
}

// PATCH — update maandbudget voor een categorie
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.category || body.maandbudget === undefined) {
    return NextResponse.json({ error: 'category en maandbudget vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('personal_budgets')
    .update({ maandbudget: Number(body.maandbudget), updated_at: new Date().toISOString() })
    .eq('category', body.category)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST — maak nieuwe budget categorie aan
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.category || body.maandbudget === undefined) {
    return NextResponse.json({ error: 'category en maandbudget vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('personal_budgets')
    .upsert({
      category:    body.category,
      maandbudget: Number(body.maandbudget),
      kleur:       body.kleur ?? '#6366f1',
      icon:        body.icon ?? 'wallet',
    }, { onConflict: 'category' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, budget: data })
}
