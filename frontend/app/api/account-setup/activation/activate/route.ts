import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueActivationSequence } from '@/lib/affiliate-programs/activation.server'

/**
 * Fase 2 — ACTIVEER PROGRAMMA (one-click).
 * Zet de volledige agent-sequence in de queue (Setup → terms/MCP → browser-registratie met
 * auto-submit) en triggert MANUAL-detectie. Hermes voert daarna alles uit wat technisch kan.
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
    const runIds = await enqueueActivationSequence(programId, user.id)
    return NextResponse.json({ ok: true, runIds })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
