import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectProgram } from '@/lib/affiliate-programs/activation.server'

/** Onboarding stap 3 — ACCOUNT KOPPELEN. Slaat affiliate_id/tracking_tag/referral_url op (geen activatie). */
export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const programId = String(body.programId ?? '').trim()
  const affiliateId = String(body.affiliateId ?? '').trim() || null
  const trackingTag = String(body.trackingTag ?? '').trim() || null
  const referralUrl = String(body.referralUrl ?? '').trim() || null
  if (!programId) return NextResponse.json({ error: 'programId ontbreekt' }, { status: 400 })

  try {
    await connectProgram(programId, affiliateId, trackingTag, referralUrl, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
