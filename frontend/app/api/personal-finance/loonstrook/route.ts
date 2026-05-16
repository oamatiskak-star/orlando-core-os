import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { berekenDgaLoonstrook, type DgaInput, type DgaLoonstrook } from '@/lib/bank/dga-loonstrook'

// GET — haal alle DGA loonstroken op
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('dga_loonstroken')
    .select('*')
    .order('periode', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loonstroken: data ?? [] })
}

// POST — genereer loonstrook voor opgegeven periode
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.periode) {
    return NextResponse.json({ error: 'periode vereist (bijv. "2025-05")' }, { status: 400 })
  }

  const input: DgaInput = {
    bruto:         body.bruto         ?? 5833,
    vakantiegeld:  body.vakantiegeld  ?? 0,
    bonus:         body.bonus         ?? 0,
    pensioen:      body.pensioen      ?? 0,
    periode:       body.periode,
    betaald_op:    body.betaald_op    ?? null,
  }

  const strook = berekenDgaLoonstrook(input)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('dga_loonstroken')
    .upsert({
      periode:          strook.periode,
      bruto:            strook.bruto_maand,
      loonheffing:      strook.loonheffing,
      heffingskorting:  strook.heffingskorting_totaal,
      zvw_bijdrage:     strook.zvw_werkgever,
      netto:            strook.netto_uitbetaald,
      vakantiegeld:     strook.vakantiegeld,
      pensioen:         strook.pensioen,
      bonus:            strook.bonus,
      betaald_op:       strook.betaald_op,
      status:           strook.status,
      berekenings_data: strook.berekenings_data,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'periode' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id, strook })
}

// POST — genereer meerdere periodes in één keer (batch)
// body: { periodes: ['2025-01', '2025-02', ...], bruto: 5833 }
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.periodes || !Array.isArray(body.periodes)) {
    return NextResponse.json({ error: 'periodes array vereist' }, { status: 400 })
  }

  const supabase  = createAdminClient()
  const stroken   = body.periodes.map((p: string) =>
    berekenDgaLoonstrook({ bruto: body.bruto ?? 5833, periode: p })
  )

  const rows = stroken.map((s: DgaLoonstrook) => ({
    periode:          s.periode,
    bruto:            s.bruto_maand,
    loonheffing:      s.loonheffing,
    heffingskorting:  s.heffingskorting_totaal,
    zvw_bijdrage:     s.zvw_werkgever,
    netto:            s.netto_uitbetaald,
    vakantiegeld:     s.vakantiegeld,
    pensioen:         s.pensioen,
    bonus:            s.bonus,
    status:           'definitief',
    berekenings_data: s.berekenings_data,
    updated_at:       new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('dga_loonstroken')
    .upsert(rows, { onConflict: 'periode' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length, stroken })
}
