import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /api/build-tracker/daily-priority?company=<slug>
// Dagprioriteit van vandaag (hermes.v_daily_priority_today), optioneel gescoped
// op het actieve bedrijf (slug → companies.id). Read-only.
export async function GET(req: Request) {
  const admin = createAdminClient()
  const slug = new URL(req.url).searchParams.get('company')

  try {
    let companyId: string | null = null
    if (slug) {
      const { data: company } = await admin
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      companyId = (company as { id: string } | null)?.id ?? null
      // Onbekende slug → geen rijen i.p.v. alles tonen.
      if (!companyId) return NextResponse.json({ items: [], company_id: null })
    }

    let query = admin
      .schema('hermes')
      .from('v_daily_priority_today')
      .select('*')
      .order('priority_rank', { ascending: true })

    if (companyId) query = query.eq('company_id', companyId)

    const { data, error } = await query
    if (error) return NextResponse.json({ items: [], error: error.message })
    return NextResponse.json({ items: data ?? [], company_id: companyId })
  } catch (e) {
    // mig 159 nog niet toegepast — lege lijst i.p.v. 500.
    return NextResponse.json({ items: [], error: e instanceof Error ? e.message : 'unavailable' })
  }
}
