import { NextRequest, NextResponse } from 'next/server'
import {
  saveCredentials,
  hasCredentials,
  createIngRequisition,
  testCredentials,
} from '@/lib/bank/gocardless'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — status van de bank koppeling
export async function GET() {
  const supabase = createAdminClient()

  const [hasCreds, { data: connections }] = await Promise.all([
    hasCredentials(),
    supabase
      .from('personal_bank_connections')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    has_credentials: hasCreds,
    connections:     connections ?? [],
  })
}

// POST — sla GoCardless credentials op EN/OF start ING requisition
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const action: string = body.action ?? 'save_credentials'

  try {
    if (action === 'save_credentials') {
      if (!body.secret_id || !body.secret_key) {
        return NextResponse.json({ error: 'secret_id en secret_key vereist' }, { status: 400 })
      }
      await saveCredentials(body.secret_id, body.secret_key)
      const test = await testCredentials()
      return NextResponse.json({ ok: test.ok, error: test.error })
    }

    if (action === 'connect_ing') {
      const redirectUrl = body.redirect_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dashboard.strkbeheer.nl'}/dashboard/dyme/bank-callback`
      const requisition = await createIngRequisition(redirectUrl)

      const supabase = createAdminClient()
      await supabase.from('personal_bank_connections').insert({
        bank_id:            'ING_INGBNL2A',
        bank_name:          'ING',
        gocardless_req_id:  requisition.id,
        status:             'pending',
      })

      return NextResponse.json({ ok: true, link: requisition.link, requisition_id: requisition.id })
    }

    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
