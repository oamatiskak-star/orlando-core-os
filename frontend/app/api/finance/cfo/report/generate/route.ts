import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateExecutiveSummary, computeKpiData, computeTaxData } from '@/lib/finance/cfo-engine'

const ALL_COMPANIES = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO']
const MAANDEN = ['januari','februari','maart','april','mei','juni',
                 'juli','augustus','september','oktober','november','december']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const now         = new Date()
  const periodYear  = body.period_year  ?? now.getFullYear()
  const periodMonth = body.period_month ?? now.getMonth() + 1
  const companyIds: string[] = body.company_ids ?? ALL_COMPANIES

  const supabase = createAdminClient()

  try {
    // Bestaand rapport ophalen of nieuw genereren
    let { data: report } = await supabase
      .from('cfo_monthly_reports')
      .select('*')
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .single()

    if (!report) {
      // Genereer data
      const [kpi, tax] = await Promise.all([
        computeKpiData(companyIds, periodYear, periodMonth),
        computeTaxData(companyIds, periodYear, periodMonth),
      ])

      const { data: openInvoices } = await supabase
        .from('fin_invoices')
        .select('amount_incl')
        .in('company_id', companyIds)
        .in('status', ['open', 'vervallen'])

      const debtorsOpen = (openInvoices ?? []).reduce((s, i) => s + i.amount_incl, 0)

      const cashflowData = {
        current_balance: 0,
        balance_30d:     debtorsOpen * 0.7,
        balance_60d:     debtorsOpen * 0.5,
        balance_90d:     debtorsOpen * 0.3,
        incoming_30d:    debtorsOpen,
        outgoing_30d:    kpi.costs_total,
      }

      const execSummary = await generateExecutiveSummary(kpi, cashflowData, tax, periodYear, periodMonth)

      const { data: newReport } = await supabase
        .from('cfo_monthly_reports')
        .insert({
          period_year:       periodYear,
          period_month:      periodMonth,
          report_type:       'cfo_maand',
          status:            'concept',
          revenue_total:     kpi.revenue_total,
          costs_total:       kpi.costs_total,
          profit_net:        kpi.profit_net,
          profit_margin_pct: kpi.profit_margin_pct,
          cashflow_end:      cashflowData.balance_30d,
          btw_to_pay:        tax.btw_current_quarter,
          vpb_reserved:      tax.vpb_reserved,
          debtors_open:      debtorsOpen,
          executive_summary: execSummary,
          kpi_data:          kpi,
          cashflow_data:     cashflowData,
          tax_data:          tax,
          generated_at:      new Date().toISOString(),
        })
        .select('*')
        .single()

      report = newReport
    }

    if (!report) {
      return NextResponse.json({ error: 'Rapport genereren mislukt' }, { status: 500 })
    }

    // Update status naar gereed
    await supabase.from('cfo_monthly_reports')
      .update({ status: 'gereed', generated_at: new Date().toISOString() })
      .eq('id', report.id)

    return NextResponse.json({
      success:    true,
      report_id:  report.id,
      period:     `${MAANDEN[periodMonth - 1]} ${periodYear}`,
      status:     'gereed',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Genereren mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const supabase = createAdminClient()
  const { data: reports } = await supabase
    .from('cfo_monthly_reports')
    .select('id,period_year,period_month,report_type,status,revenue_total,costs_total,profit_net,profit_margin_pct,generated_at,created_at')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(24)

  return NextResponse.json({ reports: reports ?? [] })
}
