import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Sprint D — Revenue-import voor netwerken ZONDER server-postback (Amazon PA-API, Temu,
// marketplace-rapporten). Batch-ingest: POST /api/media-holding/affiliate-engine/import/<network>
// Publiek maar SECRET-gated (zelfde secret als de webhook). Landt rapport-/API-rijen in
// affiliate_conversions (confirmed) -> trigger sync_affiliate_to_monetization -> monetization
// -> director. Idempotent op transaction_id (import_affiliate_conversions).
//
// Body: { rows: [ { transaction_id, value_eur, commission_eur, currency?, occurred_at?,
//                    channel_id? (media_holding_channels.id), content_item_id? }, ... ],
//         source?: 'amazon_paapi' | 'report' }
// Auth: header `x-webhook-secret` of query `?token=` === env AFFILIATE_WEBHOOK_SECRET.
export async function POST(req: NextRequest, ctx: { params: Promise<{ network: string }> }) {
  const { network } = await ctx.params

  const secret = req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('token')
  if (!process.env.AFFILIATE_WEBHOOK_SECRET || secret !== process.env.AFFILIATE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows) {
    return NextResponse.json({ error: 'rows[] vereist (array van rapport-/PA-API-rijen)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('import_affiliate_conversions', {
    p_network: network,
    p_rows: rows,
    p_source: (body.source as string) ?? 'report',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, network, result: data }, { status: 201 })
}
