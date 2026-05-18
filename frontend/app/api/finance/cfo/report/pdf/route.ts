import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAANDEN = ['januari','februari','maart','april','mei','juni',
                 'juli','augustus','september','oktober','november','december']

function fmt(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function generateHtml(report: Record<string, unknown>): string {
  const kpi      = (report.kpi_data      as Record<string, unknown>) ?? {}
  const cashflow = (report.cashflow_data as Record<string, unknown>) ?? {}
  const tax      = (report.tax_data      as Record<string, unknown>) ?? {}
  const actions  = (report.action_list   as Array<Record<string, unknown>>) ?? []
  const insights = ((report.insights_data as Record<string, unknown>)?.all_insights as Array<Record<string, unknown>>) ?? []
  const period   = `${MAANDEN[(report.period_month as number) - 1]} ${report.period_year}`

  const priorityColor = (p: string) =>
    p === 'kritiek' || p === 'Hoog' ? '#ef4444'
    : p === 'hoog' || p === 'Middel' ? '#f59e0b'
    : '#10b981'

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>CFO Rapport — ${period}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0a0f1e; color: #e2e8f0; font-size: 12px; line-height: 1.6; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px; }
    .header { border-bottom: 2px solid #1e40af; padding-bottom: 24px; margin-bottom: 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo { font-size: 22px; font-weight: 800; color: #3b82f6; letter-spacing: -0.5px; }
    .logo span { color: #ffffff; }
    .report-meta { text-align: right; }
    .report-title { font-size: 28px; font-weight: 700; color: #ffffff; margin-top: 16px; }
    .report-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 14px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-bottom: 16px; }
    .exec-summary { background: #0f172a; border: 1px solid #1e293b; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; font-size: 13px; line-height: 1.8; color: #cbd5e1; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .kpi-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; }
    .kpi-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-value { font-size: 22px; font-weight: 700; }
    .kpi-sub { font-size: 10px; color: #64748b; margin-top: 4px; }
    .green { color: #10b981; }
    .red { color: #ef4444; }
    .amber { color: #f59e0b; }
    .blue { color: #3b82f6; }
    .white { color: #ffffff; }
    .cashflow-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .cf-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; text-align: center; }
    .cf-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .cf-value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 8px 12px; border-bottom: 1px solid #1e293b; }
    td { padding: 10px 12px; border-bottom: 1px solid #0f172a; font-size: 12px; }
    tr:hover td { background: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-red { background: rgba(239,68,68,0.15); color: #ef4444; }
    .badge-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-green { background: rgba(16,185,129,0.15); color: #10b981; }
    .action-row td:first-child { font-weight: 600; }
    .insight-item { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .insight-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .insight-title { font-size: 13px; font-weight: 600; color: #ffffff; }
    .insight-body { font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .footer { border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #475569; }
    .tax-table { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
    .tax-table th { background: #0f172a; }
    .deadline-urgent { background: rgba(239,68,68,0.05); }
    @media print {
      body { background: white; color: #0a0f1e; }
      .page { max-width: 100%; padding: 20px; }
      .kpi-card, .cf-card, .insight-item, .exec-summary { background: #f8fafc; border-color: #e2e8f0; }
      .section-title { color: #1e40af; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="logo">ORLANDO<span> CORE</span></div>
        <div style="font-size:10px;color:#475569;margin-top:2px;">STRKBEHEER BV / STRKBOUW BV / BOUWPROFFS NL</div>
      </div>
      <div class="report-meta">
        <div style="font-size:10px;color:#475569;">CFO RAPPORT</div>
        <div style="font-size:14px;font-weight:700;color:#ffffff;">${period}</div>
        <div style="font-size:10px;color:#475569;">Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}</div>
      </div>
    </div>
    <div class="report-title">CFO Maandrapportage</div>
    <div class="report-sub">Vertrouwelijk — uitsluitend bestemd voor directie</div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-title">01 Executive Summary</div>
    <div class="exec-summary">${report.executive_summary ?? 'Geen samenvatting beschikbaar.'}</div>
  </div>

  <!-- KPI's -->
  <div class="section">
    <div class="section-title">02 Financiële KPI's</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Totale Omzet</div>
        <div class="kpi-value white">${fmt(kpi.revenue_total as number ?? 0)}</div>
        <div class="kpi-sub">${fmtPct(kpi.revenue_mom_change as number ?? 0)} t.o.v. vorige maand</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Totale Kosten</div>
        <div class="kpi-value red">${fmt(kpi.costs_total as number ?? 0)}</div>
        <div class="kpi-sub">Burnrate: ${fmt(kpi.burnrate as number ?? 0)}/dag</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Nettowinst</div>
        <div class="kpi-value ${(kpi.profit_net as number ?? 0) >= 0 ? 'green' : 'red'}">${fmt(kpi.profit_net as number ?? 0)}</div>
        <div class="kpi-sub">Marge: ${(kpi.profit_margin_pct as number ?? 0).toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Recurring Omzet</div>
        <div class="kpi-value blue">${fmt(kpi.revenue_recurring as number ?? 0)}</div>
        <div class="kpi-sub">Eenmalig: ${fmt(kpi.revenue_one_off as number ?? 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">EBITDA</div>
        <div class="kpi-value ${(kpi.ebitda as number ?? 0) >= 0 ? 'green' : 'red'}">${fmt(kpi.ebitda as number ?? 0)}</div>
        <div class="kpi-sub">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Runway</div>
        <div class="kpi-value ${(kpi.runway_days as number ?? 0) > 90 ? 'green' : (kpi.runway_days as number ?? 0) > 30 ? 'amber' : 'red'}">${kpi.runway_days as number ?? 0} dagen</div>
        <div class="kpi-sub">Op basis van huidige burnrate</div>
      </div>
    </div>
  </div>

  <!-- Cashflow -->
  <div class="section">
    <div class="section-title">03 Cashflow Analyse</div>
    <div class="cashflow-grid">
      <div class="cf-card">
        <div class="cf-label">Huidig Saldo</div>
        <div class="cf-value white">${fmt(cashflow.current_balance as number ?? 0)}</div>
      </div>
      <div class="cf-card">
        <div class="cf-label">Over 30 dagen</div>
        <div class="cf-value ${(cashflow.balance_30d as number ?? 0) >= 0 ? 'green' : 'red'}">${fmt(cashflow.balance_30d as number ?? 0)}</div>
      </div>
      <div class="cf-card">
        <div class="cf-label">Over 60 dagen</div>
        <div class="cf-value ${(cashflow.balance_60d as number ?? 0) >= 0 ? 'green' : 'red'}">${fmt(cashflow.balance_60d as number ?? 0)}</div>
      </div>
      <div class="cf-card">
        <div class="cf-label">Over 90 dagen</div>
        <div class="cf-value ${(cashflow.balance_90d as number ?? 0) >= 0 ? 'green' : 'red'}">${fmt(cashflow.balance_90d as number ?? 0)}</div>
      </div>
    </div>
    ${cashflow.risk_date ? `<div style="margin-top:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;color:#ef4444;font-size:12px;">
      ⚠ Cashflow risicomoment verwacht op <strong>${cashflow.risk_date}</strong> — Saldo: <strong>${fmt(cashflow.risk_amount as number ?? 0)}</strong>
    </div>` : ''}
  </div>

  <!-- Belastingen -->
  <div class="section">
    <div class="section-title">04 Belastingen & Compliance</div>
    <div class="tax-table">
      <table>
        <thead>
          <tr>
            <th>Type</th><th>Deadline</th><th>Vereist</th><th>Gereserveerd</th><th>Gap</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:600">BTW Q${Math.ceil(new Date().getMonth() / 3) + (new Date().getDate() > 1 ? 0 : -1) || 1}</td>
            <td>${tax.btw_deadline ?? '—'}</td>
            <td>${fmt(tax.btw_current_quarter as number ?? 0)}</td>
            <td>${fmt(tax.btw_reserved as number ?? 0)}</td>
            <td class="${(tax.btw_gap as number ?? 0) > 0 ? 'red' : 'green'}">${fmt(Math.abs(tax.btw_gap as number ?? 0))}</td>
            <td><span class="badge ${(tax.btw_gap as number ?? 0) > 500 ? 'badge-red' : 'badge-green'}">${(tax.btw_gap as number ?? 0) > 500 ? 'Onvoldoende' : 'OK'}</span></td>
          </tr>
          <tr>
            <td style="font-weight:600">VPB (jaar)</td>
            <td>30 mei ${new Date().getFullYear() + 1}</td>
            <td>${fmt(tax.vpb_estimated_year as number ?? 0)}</td>
            <td>${fmt(tax.vpb_reserved as number ?? 0)}</td>
            <td class="${(tax.vpb_gap as number ?? 0) > 0 ? 'amber' : 'green'}">${fmt(Math.abs(tax.vpb_gap as number ?? 0))}</td>
            <td><span class="badge ${(tax.vpb_gap as number ?? 0) > 1000 ? 'badge-amber' : 'badge-green'}">${(tax.vpb_gap as number ?? 0) > 1000 ? 'Let op' : 'OK'}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- AI Inzichten -->
  ${insights.length > 0 ? `
  <div class="section">
    <div class="section-title">05 AI CFO Adviezen</div>
    ${insights.slice(0, 6).map((ins: Record<string, unknown>) => `
    <div class="insight-item">
      <div class="insight-header">
        <div class="insight-title">${ins.title}</div>
        <span class="badge" style="background:rgba(255,255,255,0.05);color:${priorityColor(ins.priority as string)}">${String(ins.priority).toUpperCase()}</span>
      </div>
      <div class="insight-body">${ins.body}</div>
      ${ins.impact_amount ? `<div style="margin-top:6px;font-size:11px;color:#3b82f6;">Impact: ${fmt(ins.impact_amount as number)}</div>` : ''}
    </div>`).join('')}
  </div>` : ''}

  <!-- CEO Actie Lijst -->
  ${actions.length > 0 ? `
  <div class="section">
    <div class="section-title">06 CEO Actie Lijst</div>
    <table>
      <thead>
        <tr><th>Prioriteit</th><th>Categorie</th><th>Actie</th><th>Impact</th><th>Deadline</th></tr>
      </thead>
      <tbody>
        ${actions.map((a: Record<string, unknown>) => `
        <tr class="action-row">
          <td><span class="badge ${a.priority === 'Hoog' ? 'badge-red' : a.priority === 'Middel' ? 'badge-amber' : 'badge-green'}">${a.priority}</span></td>
          <td style="color:#64748b">${a.category}</td>
          <td>${a.action}</td>
          <td style="color:#94a3b8">${a.impact ?? '—'}</td>
          <td style="color:#64748b">${a.deadline ?? '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>Orlando Core OS — CFO Agent v2.0 — Gegenereerd door AI (Boekhouder + CFO + Fiscalist lagen)</div>
    <div>Vertrouwelijk — ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const reportId = searchParams.get('id')
  const year     = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month    = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const supabase = createAdminClient()

  let query = supabase.from('cfo_monthly_reports').select('*')
  if (reportId) {
    query = query.eq('id', reportId)
  } else {
    query = query.eq('period_year', year).eq('period_month', month)
  }

  const { data: report, error } = await query.single()
  if (error || !report) {
    return NextResponse.json({ error: 'Rapport niet gevonden' }, { status: 404 })
  }

  const html = generateHtml(report)

  return new NextResponse(html, {
    headers: {
      'Content-Type':        'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="cfo-rapport-${report.period_year}-${String(report.period_month).padStart(2, '0')}.html"`,
      'Cache-Control':       'no-store',
    },
  })
}
