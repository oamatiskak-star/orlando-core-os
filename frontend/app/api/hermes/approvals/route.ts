import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Keur een onomkeerbare actie goed of af (HARDE GATE). Vercel VOERT NIET UIT —
 * goedkeuren zet status op 'approved'; de lokale orchestrator/CLI-host pikt
 * approved rijen op en voert de gesanctioneerde actie dan pas uit.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { approval_id, decision } = body as { approval_id?: string; decision?: 'approve' | 'reject' }
  if (!approval_id || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'approval_id en decision (approve|reject) vereist' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('hermes')
    .from('approvals')
    .update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      decided_by: user.email ?? user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', approval_id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Goedkeuring niet gevonden of al beslist' }, { status: 409 })

  return NextResponse.json({ ok: true, id: data.id, status: data.status })
}
