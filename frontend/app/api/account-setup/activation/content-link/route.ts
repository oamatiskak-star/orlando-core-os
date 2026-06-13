import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateChannelContentLinks } from '@/lib/affiliate-programs/activation.server'

/**
 * Fase 5 — content-koppeling. Genereert affiliate-links voor de top-N content-items van het
 * gekoppelde kanaal (of alle kanalen). Alleen toegestaan als het programma actief is.
 */
export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const programId = String(body.programId ?? '').trim()
  const channelId = String(body.channelId ?? '').trim() || null
  const topNraw = Number(body.topN ?? 5)
  const topN = Number.isFinite(topNraw) ? Math.min(Math.max(Math.trunc(topNraw), 1), 25) : 5

  if (!programId) return NextResponse.json({ error: 'programId ontbreekt' }, { status: 400 })

  // Gate: alleen voor actieve programma's (geen error-state — actionable bericht).
  const { data: prog, error: progErr } = await supabase
    .from('affiliate_programs')
    .select('account_status, name')
    .eq('id', programId)
    .maybeSingle()
  if (progErr) return NextResponse.json({ error: progErr.message }, { status: 500 })
  if (!prog) return NextResponse.json({ error: 'Programma niet gevonden' }, { status: 404 })
  if (!['active', 'payout_active'].includes(String(prog.account_status))) {
    return NextResponse.json(
      { error: `${prog.name} is nog niet actief — voer eerst de referral-code/affiliate-link in (GO LIVE).` },
      { status: 409 },
    )
  }

  try {
    const created = await generateChannelContentLinks(programId, channelId, topN, user.id)
    return NextResponse.json({ ok: true, created })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
