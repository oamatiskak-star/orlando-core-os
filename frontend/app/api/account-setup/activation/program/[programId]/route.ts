import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Onboarding — programma-detail + live resultaten (stap 1/2/6/7). Read-only.
 * Bronnen: v_affiliate_activation_center (detail), v_affiliate_program_performance
 * (clicks/conversies/omzet/EPC), v_affiliate_link_health (link-status). Geen mock: 0 = 0.
 */
export const revalidate = 0

export async function GET(_req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programId } = await ctx.params

  const [center, perf, links] = await Promise.all([
    supabase.from('v_affiliate_activation_center').select('*').eq('id', programId).maybeSingle(),
    supabase.from('v_affiliate_program_performance')
      .select('program_name, category, account_status, clicks, conversions, confirmed, revenue_eur, actual_epc')
      .eq('program_id', programId).maybeSingle(),
    supabase.from('affiliate_programs').select('name, referral_code, affiliate_link, payout_model, metadata, last_status_check_at').eq('id', programId).maybeSingle(),
  ])

  if (center.error) return NextResponse.json({ error: center.error.message }, { status: 500 })
  const c = center.data
  if (!c) return NextResponse.json({ error: 'Programma niet gevonden' }, { status: 404 })
  const prog = links.data

  // link-health voor dit programma (network = programmanaam)
  const { data: health } = await supabase
    .from('v_affiliate_link_health')
    .select('product, url, short_code, active, status, http_status, redirected, checked_at')
    .eq('network', c.name)

  // Connect-status: ACTIVE (account_status active) > CONNECTED (keys aanwezig) > NOT_CONNECTED
  const hasKeys = Boolean(prog?.referral_code || prog?.affiliate_link)
  const connectStatus = ['active', 'payout_active'].includes(String(c.account_status))
    ? 'ACTIVE' : (hasKeys ? 'CONNECTED' : 'NOT_CONNECTED')

  const clicks = Number(perf.data?.clicks ?? 0)
  const conversions = Number(perf.data?.conversions ?? 0)
  const confirmed = Number(perf.data?.confirmed ?? 0)
  const revenue = Number(perf.data?.revenue_eur ?? 0)
  const epc = Number(perf.data?.actual_epc ?? 0)

  // FIRST EURO STATUS (per programma, afgeleid uit echte metrics)
  const firstEuro =
    revenue >= 1 ? 'FIRST EURO'
    : confirmed > 0 ? 'FIRST COMMISSION'
    : conversions > 0 ? 'FIRST CONVERSION'
    : clicks > 0 ? 'FIRST CLICK'
    : 'NOT STARTED'

  return NextResponse.json({
    program: {
      id: c.id,
      name: c.name,
      account_status: c.account_status,
      approval_status: c.approval_status,
      login_status: c.login_status,
      connect_status: connectStatus,
      network: c.name,
      category: c.category,
      cookie_days: c.cookie_days,
      commission_model: prog?.payout_model ?? (c.recurring ? 'recurring' : 'one-time'),
      recurring: c.recurring,
      best_channel: c.best_channel_name,
      referral_code: prog?.referral_code ?? null,
      affiliate_link: prog?.affiliate_link ?? null,
      affiliate_account_id: (prog?.metadata as Record<string, unknown> | null)?.['affiliate_account_id'] ?? null,
      last_sync_at: prog?.last_status_check_at ?? null,
    },
    metrics: { clicks, conversions, confirmed, revenue_eur: revenue, epc },
    first_euro_status: firstEuro,
    links: health ?? [],
  })
}
