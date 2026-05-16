import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('personal_liabilities')
    .select('*')
    .order('saldo', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ liabilities: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { naam, categorie, saldo, rente_pct, maandbedrag, einddatum, aanbieder, notes } = body

  if (!naam) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('personal_liabilities')
    .insert({
      naam,
      categorie:  categorie ?? 'overig',
      saldo:      Number(saldo ?? 0),
      rente_pct:  rente_pct ? Number(rente_pct) : null,
      maandbedrag:maandbedrag ? Number(maandbedrag) : null,
      einddatum:  einddatum ?? null,
      aanbieder:  aanbieder ?? null,
      notes:      notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ liability: data }, { status: 201 })
}
