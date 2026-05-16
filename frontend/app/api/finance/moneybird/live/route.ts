import { NextRequest, NextResponse } from 'next/server'
import { getLiveData, getAllCompanyConfigs, testConnection } from '@/lib/finance/moneybird-multi'

// GET /api/finance/moneybird/live?company=MODIWERIJO
// GET /api/finance/moneybird/live (alle bedrijven — summary only)
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company')?.toUpperCase()

  try {
    if (companyId) {
      const data = await getLiveData(companyId)
      return NextResponse.json(data)
    }

    // Alle bedrijven: parallel ophalen
    const configs = await getAllCompanyConfigs()
    const results = await Promise.allSettled(
      configs.map(c => getLiveData(c.company_id))
    )

    const companies = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      return {
        company:  configs[i],
        error:    r.reason?.message ?? 'Fout bij ophalen',
        invoices: { all: [], open: [], overdue: [], paid: [], late: [] },
        summary:  { total_open: 0, total_overdue: 0, total_paid: 0, amount_open: 0, amount_overdue: 0, amount_paid_ytd: 0, oldest_overdue_days: 0 },
      }
    })

    return NextResponse.json({ companies })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
