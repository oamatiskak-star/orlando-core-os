import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'
import { radarWindowOpen } from '@/lib/acq/radar-window'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/seed-deals
// Schedule: 10 5 * * * (dagelijks 05:10, binnen acq_radar-venster, vóór deal-scan 05:20)
//
// ZAAIER: promoveert gekwalificeerde signalen naar acq_deals (pipeline_stage='radar',
// ai_score=null) zodat deal-scan + DealHunter ze oppakken. Vult het gat: er was géén
// bron die acq_deals vulde, waardoor deal-scan altijd op 'no_unscored_deals' skipte.
//
// Bronnen:
//   1. acq_offmarket_leads zonder deal_id  → acq_deal (distressed/offmarket)
//   2. acq_build_opps met estimated_value ≥ €500k → acq_deal (aanbesteding)
//
// Idempotent: leads worden gelinkt via deal_id; build-opps gededupliceerd op source_url.

const BUILD_OPP_MIN_VALUE = 500_000

function leadObjectType(leadType: string | null): string | null {
  switch (leadType) {
    case 'faillissement': return 'bouwbedrijf-activa'
    case 'stilstand':     return 'bouwproject'
    default:              return null
  }
}

function leadDealType(leadType: string | null): string {
  switch (leadType) {
    case 'faillissement': return 'faillissement-overname'
    case 'stilstand':     return 'vervangend-aannemerschap'
    default:              return leadType ?? 'offmarket'
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Heartbeat-on-fire: bewijs dat de cron draaide, óók als hij hierna correct skipt.
  await reportHeartbeat('cron.vercel.acquisition.seed-deals').catch(() => {})

  if (!(await radarWindowOpen('seed-deals'))) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'buiten_planner_venster' })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  let seededFromLeads = 0
  let seededFromOpps = 0

  // ── 1. Off-market leads zonder deal_id → acq_deal ───────────────────────────
  const { data: leads, error: leadErr } = await admin
    .from('acq_offmarket_leads')
    .select('id, address, city, province, lead_type, roi_prognose, notes')
    .is('deal_id', null)
    .limit(200)

  if (leadErr) return NextResponse.json({ error: `leads: ${leadErr.message}` }, { status: 500 })

  for (const lead of leads ?? []) {
    const { data: deal, error: insErr } = await admin
      .from('acq_deals')
      .insert({
        title:          `${leadDealType(lead.lead_type)}: ${lead.address}`.slice(0, 200),
        address:        lead.address,
        city:           lead.city,
        province:       lead.province,
        object_type:    leadObjectType(lead.lead_type),
        deal_type:      leadDealType(lead.lead_type),
        roi_pct:        lead.roi_prognose,
        source:         'offmarket_lead',
        notes:          lead.notes,
        pipeline_stage: 'radar',
      })
      .select('id')
      .single()

    if (insErr || !deal) continue

    await admin
      .from('acq_offmarket_leads')
      .update({ deal_id: deal.id, status: 'omgezet' })
      .eq('id', lead.id)

    seededFromLeads++
  }

  // ── 2. High-budget build-opps → acq_deal (gededupliceerd op source_url) ──────
  const { data: existingDeals } = await admin
    .from('acq_deals')
    .select('source_url')
    .not('source_url', 'is', null)

  const seenUrls = new Set((existingDeals ?? []).map((d) => d.source_url as string))

  const { data: opps, error: oppErr } = await admin
    .from('acq_build_opps')
    .select('title, municipality, province, opp_type, estimated_value, source, source_url, notes')
    .gte('estimated_value', BUILD_OPP_MIN_VALUE)
    .limit(200)

  if (oppErr) return NextResponse.json({ error: `opps: ${oppErr.message}` }, { status: 500 })

  const oppRows = (opps ?? [])
    .filter((o) => !o.source_url || !seenUrls.has(o.source_url))
    .map((o) => ({
      title:           (o.title ?? 'Bouwaanbesteding').slice(0, 200),
      province:        o.province,
      city:            o.municipality,
      object_type:     o.opp_type,
      deal_type:       'aanbesteding',
      estimated_value: o.estimated_value,
      source:          o.source ?? 'build_opp',
      source_url:      o.source_url,
      notes:           o.notes,
      pipeline_stage:  'radar',
    }))

  if (oppRows.length > 0) {
    const { data: insertedOpps, error: oppInsErr } = await admin
      .from('acq_deals')
      .insert(oppRows)
      .select('id')
    if (oppInsErr) return NextResponse.json({ error: `opp-insert: ${oppInsErr.message}` }, { status: 500 })
    seededFromOpps = (insertedOpps ?? []).length
  }

  return NextResponse.json({
    ok:                true,
    seeded_from_leads: seededFromLeads,
    seeded_from_opps:  seededFromOpps,
    total_seeded:      seededFromLeads + seededFromOpps,
    duration_ms:       Date.now() - startedAt,
  })
}
