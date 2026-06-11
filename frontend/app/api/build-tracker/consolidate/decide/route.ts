import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Mens-beslissing over een consolidation-voorstel (aanscherping 3).
// candidate: pending → accepted/rejected. program: bevestig (is_proposed=false) of verwijder.
// Geen automatische merge/verwijdering van build-items — alleen de beslissing wordt vastgelegd.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const decision: string = (body?.decision ?? '').toString()
  if (!['accepted', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision moet accepted of rejected zijn' }, { status: 400 })
  }
  const who = user.email ?? user.id

  if (body?.candidate_id) {
    const { error } = await supabase.from('build_duplicate_candidates')
      .update({ status: decision, decided_by: who, decided_at: new Date().toISOString() })
      .eq('id', body.candidate_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, candidate_id: body.candidate_id, decision })
  }

  if (body?.program_id) {
    if (decision === 'accepted') {
      const { error } = await supabase.from('build_programs')
        .update({ is_proposed: false }).eq('id', body.program_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // afwijzen = voorstel verwijderen (program_id op projecten staat al op null)
      const { error } = await supabase.from('build_programs')
        .delete().eq('id', body.program_id).eq('is_proposed', true)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, program_id: body.program_id, decision })
  }

  return NextResponse.json({ error: 'candidate_id of program_id vereist' }, { status: 400 })
}
