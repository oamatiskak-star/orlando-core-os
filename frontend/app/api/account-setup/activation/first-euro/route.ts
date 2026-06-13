import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Fase 6 — Eerste-euro dashboard. Realtime rollup (v_affiliate_first_euro) + per-programma
 * omzetdetail (v_affiliate_program_performance). Read-only.
 */
export const revalidate = 0

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [rollup, perProgram] = await Promise.all([
    supabase.from('v_affiliate_first_euro').select('*').maybeSingle(),
    supabase
      .from('v_affiliate_program_performance')
      .select('program_id, program_name, category, account_status, clicks, conversions, confirmed, revenue_eur, actual_epc')
      .order('revenue_eur', { ascending: false })
      .limit(50),
  ])

  if (rollup.error) return NextResponse.json({ error: rollup.error.message }, { status: 500 })

  return NextResponse.json({
    rollup: rollup.data ?? null,
    perProgram: perProgram.data ?? [],
  })
}
