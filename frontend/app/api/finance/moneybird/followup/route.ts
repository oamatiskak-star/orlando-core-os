import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — sla follow-up op voor een factuur
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!body?.company_id || !body?.invoice_id) {
    return NextResponse.json({ error: 'company_id en invoice_id vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('moneybird_followups')
    .insert({
      company_id:    body.company_id,
      invoice_id:    body.invoice_id,
      invoice_nr:    body.invoice_nr ?? null,
      contact_name:  body.contact_name ?? null,
      amount_incl:   body.amount_incl ?? null,
      due_date:      body.due_date ?? null,
      days_overdue:  body.days_overdue ?? 0,
      followup_type: body.followup_type ?? 'herinnering',
      status:        'verzonden',
      notes:         body.notes ?? null,
      sent_at:       new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

// GET — haal follow-ups op per bedrijf
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company')
  const supabase  = createAdminClient()

  const query = supabase
    .from('moneybird_followups')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50)

  if (companyId) query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followups: data ?? [] })
}
