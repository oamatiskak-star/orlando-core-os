import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  runCfoAnalysis,
  computeKpiData,
  computeTaxData,
  generateExecutiveSummary,
  checkTaxDeadlines,
  detectSubscriptions,
} from '@/lib/finance/cfo-engine'

const ALL_COMPANIES = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const now        = new Date()
  const periodYear  = body.period_year  ?? now.getFullYear()
  const periodMonth = body.period_month ?? now.getMonth() + 1
  const companyIds: string[] = body.company_ids ?? ALL_COMPANIES
  const generateReport: boolean = body.generate_report ?? false

  const supabase = createAdminClient()

  try {
    // ── 1. KPI Data ─────────────────────────────────────────────────────────
    const kpi = await computeKpiData(companyIds, periodYear, periodMonth)

    // ── 2. Tax Data ──────────────────────────────────────────────────────────
    const tax = await computeTaxData(companyIds, periodYear, periodMonth)

    // ── 3. Cashflow Data ─────────────────────────────────────────────────────
    const { data: cashflowRows } = await supabase
      .from('cfo_cashflow_forecast')
      .select('*')
      .in('company_id', companyIds)
      .gte('forecast_date', now.toISOString().split('T')[0])
      .order('forecast_date', { ascending: true })
      .limit(90)

    const currentBalance = cashflowRows?.[0]?.opening_balance ?? 0
    const balance30d     = cashflowRows?.find(r => {
      const d = new Date(r.forecast_date)
      return Math.abs(d.getTime() - (now.getTime() + 30 * 86400000)) < 3 * 86400000
    })?.closing_balance ?? currentBalance
    const balance60d = cashflowRows?.find(r => {
      const d = new Date(r.forecast_date)
      return Math.abs(d.getTime() - (now.getTime() + 60 * 86400000)) < 3 * 86400000
    })?.closing_balance ?? currentBalance
    const balance90d = cashflowRows?.find(r => {
      const d = new Date(r.forecast_date)
      return Math.abs(d.getTime() - (now.getTime() + 90 * 86400000)) < 3 * 86400000
    })?.closing_balance ?? currentBalance

    const { data: openInvoices } = await supabase
      .from('fin_invoices')
      .select('amount_incl')
      .in('company_id', companyIds)
      .in('status', ['open', 'vervallen'])

    const incoming30d = (openInvoices ?? []).reduce((s, i) => s + i.amount_incl, 0)

    const cashflowData = {
      current_balance: currentBalance,
      balance_30d:     balance30d,
      balance_60d:     balance60d,
      balance_90d:     balance90d,
      incoming_30d:    incoming30d,
      outgoing_30d:    kpi.burnrate * 30,
      risk_date:       cashflowRows?.find(r => r.risk_flag)?.forecast_date,
      risk_amount:     cashflowRows?.find(r => r.risk_flag)?.closing_balance,
    }

    // ── 4. CFO AI Inzichten ───────────────────────────────────────────────
    const { insights, actions } = await runCfoAnalysis(companyIds, periodYear, periodMonth)

    // ── 5. Belasting Deadlines ───────────────────────────────────────────
    const taxAlerts = await checkTaxDeadlines(companyIds)

    // ── 6. Risico Alerts opslaan ─────────────────────────────────────────
    if (taxAlerts.length > 0) {
      await supabase.from('cfo_risk_alerts').insert(
        taxAlerts.map(a => ({
          company_id:    a.company_id,
          alert_type:    a.alert_type,
          severity:      a.severity,
          title:         a.title,
          message:       a.message,
          threshold:     a.threshold,
          current_value: a.current_value,
          is_resolved:   false,
        }))
      )
    }

    // ── 7. Inzichten opslaan ─────────────────────────────────────────────
    if (insights.length > 0) {
      // Verwijder oude inzichten van vandaag
      const today = now.toISOString().split('T')[0]
      await supabase.from('cfo_ai_insights')
        .delete()
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59')

      await supabase.from('cfo_ai_insights').insert(insights)
    }

    // ── 8. Abonnement detectie ────────────────────────────────────────────
    for (const cid of companyIds) {
      await detectSubscriptions(cid).catch(() => null)
    }

    // ── 9. Maandrapport aanmaken (optioneel) ──────────────────────────────
    let reportId: string | undefined
    if (generateReport) {
      const executiveSummary = await generateExecutiveSummary(
        kpi, cashflowData, tax, periodYear, periodMonth,
      )

      const { data: report } = await supabase
        .from('cfo_monthly_reports')
        .upsert({
          company_id:       null,
          period_year:      periodYear,
          period_month:     periodMonth,
          report_type:      'cfo_maand',
          status:           'concept',
          revenue_total:    kpi.revenue_total,
          costs_total:      kpi.costs_total,
          profit_net:       kpi.profit_net,
          profit_margin_pct: kpi.profit_margin_pct,
          cashflow_end:     cashflowData.balance_30d,
          btw_to_pay:       tax.btw_current_quarter,
          vpb_reserved:     tax.vpb_reserved,
          debtors_open:     incoming30d,
          executive_summary: executiveSummary,
          kpi_data:         kpi,
          cashflow_data:    cashflowData,
          tax_data:         tax,
          insights_data:    { top_cost_saving: insights[0]?.title, all_insights: insights },
          action_list:      actions,
          generated_at:     new Date().toISOString(),
        }, { onConflict: 'company_id,period_year,period_month,report_type' })
        .select('id')
        .single()

      reportId = report?.id
    }

    return NextResponse.json({
      success:     true,
      period:      { year: periodYear, month: periodMonth },
      kpi,
      cashflow:    cashflowData,
      tax,
      insights:    insights.length,
      alerts:      taxAlerts.length,
      actions:     actions.length,
      report_id:   reportId,
      analyzed_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analyse mislukt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const supabase = createAdminClient()

  const [{ data: report }, { data: insights }, { data: alerts }] = await Promise.all([
    supabase.from('cfo_monthly_reports')
      .select('*')
      .eq('period_year', year)
      .eq('period_month', month)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase.from('cfo_ai_insights')
      .select('*')
      .eq('is_dismissed', false)
      .order('priority', { ascending: true })
      .limit(20),
    supabase.from('cfo_risk_alerts')
      .select('*')
      .eq('is_resolved', false)
      .order('severity', { ascending: true })
      .limit(10),
  ])

  return NextResponse.json({
    report:   report ?? null,
    insights: insights ?? [],
    alerts:   alerts ?? [],
  })
}
