import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

// S4 — Affiliate conversie-webhook: POST /api/media-holding/affiliate-engine/webhook/<network>
// Publiek maar SECRET-gated (geen user-auth, zodat affiliate-netwerken kunnen posten).
// Genormaliseerde payload; per-netwerk-mapping is een dunne adapter hierboven.
// Schrijven van de conversie triggert automatisch affiliate_revenue_rollup +
// sync_affiliate_to_monetization (omzet → ledger/monetization). Geen rollup-cron nodig.
//
// Body (genormaliseerd): {
//   link_id? | link_code?, click_id? | session_token?, content_item_id?, channel_id?,
//   value_eur, commission_eur, currency?, status?, network_transaction_id?|transaction_id?, occurred_at?
// }
// Auth: header `x-webhook-secret` of query `?token=` === env AFFILIATE_WEBHOOK_SECRET.
export async function POST(req: NextRequest, ctx: { params: Promise<{ network: string }> }) {
  const { network } = await ctx.params

  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('token')
  if (!process.env.AFFILIATE_WEBHOOK_SECRET || secret !== process.env.AFFILIATE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const admin = createAdminClient()

  let linkId        = (body.link_id as string) ?? null
  let channelId     = (body.channel_id as string) ?? null
  let contentItemId = (body.content_item_id as string) ?? null

  // 1) link resolven via short_code
  if (!linkId && body.link_code) {
    const { data: l } = await admin
      .from('affiliate_links')
      .select('id, channel_id, content_item_id')
      .eq('short_code', body.link_code as string)
      .maybeSingle()
    if (l) { linkId = l.id; channelId ??= l.channel_id; contentItemId ??= l.content_item_id }
  }

  // 2) klik resolven via click_id of session_token (voor volledige attributie)
  let clickId = (body.click_id as string) ?? null
  if (!clickId && body.session_token) {
    const { data: c } = await admin
      .from('affiliate_clicks')
      .select('id, content_item_id, channel_id, link_id')
      .eq('session_token', body.session_token as string)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (c) { clickId = c.id; contentItemId ??= c.content_item_id; channelId ??= c.channel_id; linkId ??= c.link_id }
  }

  if (!linkId) {
    return NextResponse.json({ error: 'link niet te resolven (link_id, link_code of session_token vereist)' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('affiliate_conversions')
    .insert({
      link_id:                linkId,
      click_id:               clickId,
      content_item_id:        contentItemId,
      channel_id:             channelId,
      value_eur:              Number(body.value_eur ?? 0),
      commission_eur:         Number(body.commission_eur ?? 0),
      currency:               (body.currency as string) ?? 'EUR',
      status:                 (body.status as string) ?? 'pending',
      network_transaction_id: (body.network_transaction_id as string) ?? (body.transaction_id as string) ?? null,
      occurred_at:            (body.occurred_at as string) ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, network, conversion_id: data.id }, { status: 201 })
}
