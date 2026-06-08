import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { detectIncident } from '@/lib/hermes/command-router'

export const runtime = 'nodejs'

/**
 * Producer on-ramp (FASE 2/10): dashboardacties / engines laten hun werk eerst
 * via Hermes lopen i.p.v. direct uit te voeren. Maakt een routing_request aan;
 * de lokale orchestrator plant + dispatcht, de executor voert uit.
 *
 * Body: { company_id, message, source }
 * Retour: { request_id } — de aanroeper kan op het plan/resultaat pollen.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { company_id, message, source } = body as { company_id?: string; message?: string; source?: string }
  if (!company_id || !message?.trim()) {
    return NextResponse.json({ error: 'company_id en message vereist' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.schema('hermes').rpc('submit_routing_request', {
    p_company: company_id,
    p_message: message,
    p_source: source ?? 'dashboard-action',
    p_incident: detectIncident(message),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, request_id: data })
}
