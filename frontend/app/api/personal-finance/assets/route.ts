import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('personal_assets')
    .select('*')
    .order('waarde', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { naam, categorie, waarde, valuta, aanbieder, rekeningnummer, rendement_pct, aankoopdatum, notes } = body

  if (!naam) return NextResponse.json({ error: 'naam vereist' }, { status: 400 })

  const { data, error } = await supabase
    .from('personal_assets')
    .insert({
      naam,
      categorie:     categorie ?? 'overig',
      waarde:        Number(waarde ?? 0),
      valuta:        valuta ?? 'EUR',
      aanbieder:     aanbieder ?? null,
      rekeningnummer:rekeningnummer ?? null,
      rendement_pct: rendement_pct ? Number(rendement_pct) : null,
      aankoopdatum:  aankoopdatum ?? null,
      notes:         notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data }, { status: 201 })
}
