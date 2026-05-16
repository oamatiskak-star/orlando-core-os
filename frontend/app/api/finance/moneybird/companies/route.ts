import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanyConfigs, testConnection } from '@/lib/finance/moneybird-multi'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — lijst alle gekoppelde bedrijven + verbindingsstatus
export async function GET() {
  try {
    const configs = await getAllCompanyConfigs()

    const checks = await Promise.allSettled(
      configs.map(c => testConnection(c.company_id))
    )

    const companies = configs.map((c, i) => {
      const check = checks[i]
      const connected = check.status === 'fulfilled' && check.value.ok
      return {
        company_id:        c.company_id,
        company_name:      c.company_name,
        administration_id: c.administration_id,
        digit_email:       c.digit_email,
        is_active:         c.is_active,
        last_sync_at:      c.last_sync_at,
        connected,
        error:             check.status === 'fulfilled' ? check.value.error : 'Verbindingsfout',
      }
    })

    return NextResponse.json({ companies })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — activeer/deactiveer bedrijf
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.company_id) {
    return NextResponse.json({ error: 'company_id vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('moneybird_companies')
    .update({ is_active: body.is_active ?? true, updated_at: new Date().toISOString() })
    .eq('company_id', body.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
