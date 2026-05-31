import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Publieke lead-intake: bouwaanvragen / software-aanvragen → acq_leads + melding naar Hermes.
const TYPES = ['bouwaanvraag', 'software_aanvraag', 'algemeen']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const slug = typeof body.company === 'string' ? body.company : null
  const lead_type = TYPES.includes(body.lead_type) ? body.lead_type : 'algemeen'
  const name = body.name ?? null
  const email = body.email ?? null
  const phone = body.phone ?? null
  const message = body.message ?? null
  if (!slug || (!email && !phone)) {
    return NextResponse.json({ error: 'company + e-mail of telefoon vereist' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('id, name').eq('slug', slug).maybeSingle()
  if (!company) return NextResponse.json({ error: 'onbekende fabriek' }, { status: 400 })

  const { error } = await admin.from('acq_leads').insert({
    company_id: company.id, lead_type, name, email, phone, message, source: 'dashboard-form',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Melding naar Hermes (centrale log) — mail-engine/cron kan dit oppakken voor e-mail.
  await admin.rpc('log_to_hermes', {
    source: 'lead-generator',
    level: 'warn',
    event: 'lead.nieuw',
    message: `Nieuwe ${lead_type} voor ${company.name}: ${name ?? email ?? phone}`,
    context: { lead_type, slug, email, phone },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
