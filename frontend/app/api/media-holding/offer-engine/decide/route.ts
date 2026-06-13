import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Offer Engine — menselijke beslissing (propose-only keten sluiten).
// Zet één kandidaat op approved/rejected/building/live. Geen auto-actie.
const ALLOWED = ['approved', 'rejected', 'building', 'live', 'proposed']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id: string = (body?.id ?? '').toString()
  const status: string = (body?.status ?? '').toString()
  if (!id || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'id en geldige status vereist' }, { status: 400 })
  }

  const { error } = await supabase.from('offer_candidates').update({
    status,
    decided_at: new Date().toISOString(),
    decided_by: user.email ?? user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id, status })
}
