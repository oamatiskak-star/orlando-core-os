import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { goLive } from '@/lib/affiliate-programs/activation.server'

/**
 * Fase 4 — GO LIVE. referral_code/affiliate_link invoeren → account_status='active'.
 * De bestaande affiliate_go_live()-trigger doet approval + link-activatie + rank + recs.
 */
export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const programId = String(body.programId ?? '').trim()
  const referralCode = String(body.referralCode ?? '').trim() || null
  const affiliateLink = String(body.affiliateLink ?? '').trim() || null

  if (!programId) return NextResponse.json({ error: 'programId ontbreekt' }, { status: 400 })
  if (!referralCode && !affiliateLink) {
    return NextResponse.json({ error: 'referralCode of affiliateLink is verplicht' }, { status: 400 })
  }

  try {
    await goLive(programId, referralCode, affiliateLink, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
