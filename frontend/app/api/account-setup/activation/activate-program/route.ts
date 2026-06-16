import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { activateLive } from '@/lib/affiliate-programs/activation.server'

/**
 * Onboarding stap 5 — ACTIVATE PROGRAM. Zet account_status='active' op basis van de
 * gekoppelde keys → bestaande affiliate_go_live()-trigger (approval + links + rank + recs).
 */
export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const programId = String(body.programId ?? '').trim()
  if (!programId) return NextResponse.json({ error: 'programId ontbreekt' }, { status: 400 })

  try {
    await activateLive(programId, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
