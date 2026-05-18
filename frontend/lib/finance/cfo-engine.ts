// CFO Intelligence Engine — 3 AI lagen: Boekhouder, CFO, Fiscalist
// Analyseert transacties en genereert professionele inzichten

import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CfoTransaction,
  CfoInsight,
  CfoRiskAlert,
  CfoCashflowData,
  CfoTaxData,
  CfoKpiData,
  CfoAction,
  CfoMailDocument,
} from './cfo-types'


// ── Boekhouder AI — Operationeel ─────────────────────────────────────────────

export async function classifyMailDocument(
  subject: string,
  body: string,
  senderEmail: string,
  senderName: string,
): Promise<CfoMailDocument> {
  const prompt = `Je bent een Nederlandse boekhouder. Analyseer dit e-mailbericht en extraheer financiële informatie.

AFZENDER: ${senderName} <${senderEmail}>
ONDERWERP: ${subject}
INHOUD: ${body.slice(0, 3000)}

Geef uitsluitend geldige JSON terug (geen markdown, geen uitleg):
{
  "supplier": "naam leverancier",
  "invoice_total": 0.00,
  "vat": 0.00,
  "category": "AI Software|Hosting|Bouwmaterialen|Marketing|Abonnement|Transport|Personeel|Kantoor|Overig",
  "confidence": 0-100,
  "company": "STRKBEHEER|STRKBOUW|BOUWPROFFS|MODIWERIJO|ONBEKEND",
  "project_id": null,
  "is_duplicate": false,
  "is_subscription": false,
  "ubl_detected": false,
  "payment_reminder": false,
  "contract_detected": false,
  "raw_amounts": []
}`

  const { text } = await generateText({
    model: claude.haiku,
    maxOutputTokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return {
      supplier: senderName,
      invoice_total: 0,
      vat: 0,
      category: 'Overig',
      confidence: 30,
      company: 'ONBEKEND',
      project_id: undefined,
      is_duplicate: false,
      is_subscription: false,
      ubl_detected: false,
      payment_reminder: false,
      contract_detected: false,
      raw_amounts: [],
    }
  }
}

export async function suggestLedgerAccount(
  supplierName: string,
  description: string,
  amount: number,
): Promise<{ ledger: string; code: string; confidence: number }> {
  const supabase = createAdminClient()

  // Zoek eerst in geleerde regels
  const { data: rules } = await supabase
    .from('cfo_ledger_rules')
    .select('*')
    .eq('active', true)
    .order('confidence', { ascending: false })
    .limit(50)

  if (rules && rules.length > 0) {
    const nameLower = supplierName.toLowerCase()
    const descLower = description.toLowerCase()
    for (const rule of rules) {
      const keyword = (rule.keyword ?? '').toLowerCase()
      if (keyword && (nameLower.includes(keyword) || descLower.includes(keyword))) {
        await supabase
          .from('cfo_ledger_rules')
          .update({ hit_count: rule.hit_count + 1 })
          .eq('id', rule.id)
        return { ledger: rule.ledger_account, code: rule.ledger_code ?? '', confidence: rule.confidence }
      }
    }
  }

  // AI fallback
  const knownMappings = `
OpenAI/Anthropic → AI Software (8010)
Render/Vercel/AWS/Hetzner → Hosting & Cloud (8020)
Stripe/Mollie/Adyen → Betaalkosten (8030)
Google Ads/Meta/LinkedIn → Marketing (8040)
Gamma/Bouwmaat/Hornbach → Bouwmaterialen (7010)
Intratuin/Praxis → Onderhoud gebouw (8060)
Accountant/Notaris → Accountancy & Juridisch (8070)
Auto/Lease/Brandstof → Autokosten (8080)
Telefonie/Internet → Telecommunicatie (8090)
Personeel/ZZP → Personeelskosten (6010)
Huur/Leasing → Huurlasten (8050)
`

  const prompt = `Koppel deze boeking aan het juiste grootboek.

Leverancier: ${supplierName}
Omschrijving: ${description}
Bedrag: €${amount}

Bekende koppelingen:
${knownMappings}

JSON: {"ledger":"naam","code":"nummer","confidence":85}`

  const { text } = await generateText({
    model: claude.haiku,
    maxOutputTokens: 128,
    messages: [{ role: 'user', content: prompt }],
  })
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return { ledger: 'Overige kosten', code: '8099', confidence: 40 }
  }
}

// ── CFO AI — Analyse & Advies ─────────────────────────────────────────────────

export async function runCfoAnalysis(
  companyIds: string[],
  periodYear: number,
  periodMonth: number,
): Promise<{ insights: Omit<CfoInsight, 'id' | 'created_at'>[]; actions: CfoAction[] }> {
  const supabase = createAdminClient()

  const startDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`
  const endDate   = new Date(periodYear, periodMonth, 0).toISOString().split('T')[0]

  // Haal transactiedata op
  const { data: transactions } = await supabase
    .from('cfo_transactions')
    .select('company_id, direction, amount_incl, amount_vat, category, ai_category, transaction_date, supplier_id')
    .in('company_id', companyIds)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)

  // Haal belastingreserveringen op
  const { data: taxData } = await supabase
    .from('cfo_tax_reservations')
    .select('*')
    .in('company_id', companyIds)
    .eq('period_year', periodYear)
    .in('status', ['open', 'gereserveerd'])

  // Haal openstaande debiteuren op
  const { data: openInvoices } = await supabase
    .from('fin_invoices')
    .select('company_id, amount_incl, days_overdue, status')
    .in('company_id', companyIds)
    .in('status', ['open', 'vervallen'])

  // Cashflow gegevens
  const { data: cashflow } = await supabase
    .from('cfo_cashflow_forecast')
    .select('*')
    .in('company_id', companyIds)
    .gte('forecast_date', new Date().toISOString().split('T')[0])
    .order('forecast_date', { ascending: true })
    .limit(90)

  const totalRevenue = (transactions ?? [])
    .filter(t => t.direction === 'credit')
    .reduce((s, t) => s + (t.amount_incl ?? 0), 0)

  const totalCosts = (transactions ?? [])
    .filter(t => t.direction === 'debet')
    .reduce((s, t) => s + (t.amount_incl ?? 0), 0)

  const totalBtwDebt = (taxData ?? [])
    .filter(t => t.tax_type === 'btw')
    .reduce((s, t) => s + Math.max(0, t.amount_required - t.amount_reserved), 0)

  const overdueAmount = (openInvoices ?? [])
    .filter(i => i.status === 'vervallen')
    .reduce((s, i) => s + (i.amount_incl ?? 0), 0)

  const lowestCashflow = cashflow
    ? Math.min(...cashflow.map(c => c.closing_balance ?? 0))
    : 0

  const analysisPrompt = `Je bent de CFO van een Nederlandse vastgoed- en bouwonderneming. Analyseer de financiële situatie en geef 5-8 concrete, actiegerichte inzichten.

FINANCIËLE DATA — ${periodMonth}/${periodYear}:
- Totale omzet: €${totalRevenue.toFixed(0)}
- Totale kosten: €${totalCosts.toFixed(0)}
- Nettowinst: €${(totalRevenue - totalCosts).toFixed(0)}
- Marge: ${totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100).toFixed(1) : 0}%
- Openstaande BTW schuld: €${totalBtwDebt.toFixed(0)}
- Vervallen debiteuren: €${overdueAmount.toFixed(0)}
- Laagste verwachte cashflow (90 dagen): €${lowestCashflow.toFixed(0)}

Geef JSON terug:
{
  "insights": [
    {
      "company_id": null,
      "insight_type": "liquiditeit|kostenoptimalisatie|omzetgroei|belasting|risico|groei|anomalie|advies",
      "priority": "kritiek|hoog|middel|laag",
      "title": "Korte titel",
      "body": "Concrete analyse + aanbeveling in 2-3 zinnen",
      "impact_amount": 0,
      "impact_pct": null,
      "action_required": true,
      "action_label": "Actie knop tekst",
      "action_url": null,
      "is_dismissed": false,
      "ai_model": "claude-sonnet-4-6",
      "confidence": 85
    }
  ],
  "actions": [
    {
      "priority": "Hoog|Middel|Laag",
      "category": "Liquiditeit|Kosten|Omzet|Belasting|Groei",
      "action": "Concrete actie omschrijving",
      "impact": "Verwacht effect",
      "deadline": "YYYY-MM-DD of null"
    }
  ]
}`

  const { text } = await generateText({
    model: claude.sonnet,
    maxOutputTokens: 3000,
    messages: [{ role: 'user', content: analysisPrompt }],
  })
  try {
    const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    return {
      insights: parsed.insights ?? [],
      actions:  parsed.actions ?? [],
    }
  } catch {
    return { insights: [], actions: [] }
  }
}

export async function computeKpiData(
  companyIds: string[],
  periodYear: number,
  periodMonth: number,
): Promise<CfoKpiData> {
  const supabase = createAdminClient()
  const startDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`
  const endDate   = new Date(periodYear, periodMonth, 0).toISOString().split('T')[0]

  // Vorige maand
  const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1
  const prevYear  = periodMonth === 1 ? periodYear - 1 : periodYear
  const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevEnd   = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]

  const [{ data: curTx }, { data: prevTx }, { data: subs }] = await Promise.all([
    supabase.from('cfo_transactions').select('direction,amount_incl,category,ai_category')
      .in('company_id', companyIds).gte('transaction_date', startDate).lte('transaction_date', endDate),
    supabase.from('cfo_transactions').select('direction,amount_incl')
      .in('company_id', companyIds).gte('transaction_date', prevStart).lte('transaction_date', prevEnd),
    supabase.from('cfo_subscriptions').select('amount_monthly').in('company_id', companyIds).eq('is_active', true),
  ])

  const revenue    = (curTx ?? []).filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount_incl, 0)
  const costs      = (curTx ?? []).filter(t => t.direction === 'debet').reduce((s, t) => s + t.amount_incl, 0)
  const prevRevenue = (prevTx ?? []).filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount_incl, 0)
  const recurringCosts = (subs ?? []).reduce((s, s2) => s + s2.amount_monthly, 0)

  // Top kostenposten per categorie
  const costByCategory: Record<string, number> = {}
  for (const tx of (curTx ?? []).filter(t => t.direction === 'debet')) {
    const cat = tx.ai_category ?? tx.category ?? 'Overig'
    costByCategory[cat] = (costByCategory[cat] ?? 0) + tx.amount_incl
  }
  const topCosts = Object.entries(costByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount, change_pct: 0 }))

  const burnrate   = costs / 30
  const runwayDays = burnrate > 0 ? Math.round(revenue / burnrate) : 999

  return {
    revenue_total:    revenue,
    revenue_recurring: recurringCosts,
    revenue_one_off:  revenue - recurringCosts,
    revenue_mom_change: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
    costs_total:      costs,
    costs_top:        topCosts,
    profit_net:       revenue - costs,
    profit_margin_pct: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0,
    ebitda:           revenue - costs,
    burnrate,
    runway_days:      runwayDays,
  }
}

// ── Fiscalist AI — Belasting & Compliance ─────────────────────────────────────

export async function computeTaxData(
  companyIds: string[],
  periodYear: number,
  periodMonth: number,
): Promise<CfoTaxData> {
  const supabase = createAdminClient()

  const { data: taxRows } = await supabase
    .from('cfo_tax_reservations')
    .select('*')
    .in('company_id', companyIds)
    .eq('period_year', periodYear)
    .order('deadline', { ascending: true })

  const btwRows   = (taxRows ?? []).filter(r => r.tax_type === 'btw')
  const vpbRows   = (taxRows ?? []).filter(r => r.tax_type === 'vpb')
  const currentQ  = Math.ceil(periodMonth / 3)

  const currentBtw = btwRows
    .filter(r => r.period_quarter === currentQ)
    .reduce((s, r) => s + r.amount_required, 0)
  const reservedBtw = btwRows
    .filter(r => r.period_quarter === currentQ)
    .reduce((s, r) => s + r.amount_reserved, 0)

  const vpbYear    = vpbRows.reduce((s, r) => s + r.amount_required, 0)
  const vpbReserved = vpbRows.reduce((s, r) => s + r.amount_reserved, 0)

  const upcoming = (taxRows ?? [])
    .filter(r => r.deadline && new Date(r.deadline) > new Date())
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5)
    .map(r => ({
      type:     r.tax_type.toUpperCase(),
      deadline: r.deadline!,
      amount:   r.amount_required - r.amount_paid,
      status:   r.status,
    }))

  return {
    btw_current_quarter: currentBtw,
    btw_reserved:        reservedBtw,
    btw_gap:             currentBtw - reservedBtw,
    btw_deadline:        btwRows.find(r => r.period_quarter === currentQ)?.deadline,
    vpb_estimated_year:  vpbYear,
    vpb_reserved:        vpbReserved,
    vpb_gap:             vpbYear - vpbReserved,
    loonheffing_monthly: 0,
    next_deadlines:      upcoming,
  }
}

export async function checkTaxDeadlines(companyIds: string[]): Promise<CfoRiskAlert[]> {
  const supabase = createAdminClient()
  const alerts: CfoRiskAlert[] = []
  const today  = new Date()
  const in14   = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const in30   = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: taxRows } = await supabase
    .from('cfo_tax_reservations')
    .select('*')
    .in('company_id', companyIds)
    .in('status', ['open', 'gereserveerd'])
    .not('deadline', 'is', null)
    .order('deadline', { ascending: true })

  for (const row of taxRows ?? []) {
    const deadline = new Date(row.deadline)
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const gap      = row.amount_required - row.amount_reserved
    const typeName = row.tax_type.toUpperCase()

    if (deadline < today) {
      alerts.push({
        id: crypto.randomUUID(),
        company_id:    row.company_id,
        alert_type:    `${row.tax_type}_deadline`,
        severity:      'critical',
        title:         `${typeName} deadline VERSTREKEN`,
        message:       `De ${typeName} deadline van ${row.deadline} is verstreken. Openstaand: €${(row.amount_required - row.amount_paid).toFixed(0)}. Direct actie vereist.`,
        threshold:     0,
        current_value: row.amount_required - row.amount_paid,
        is_resolved:   false,
        created_at:    new Date().toISOString(),
      })
    } else if (deadline <= in14) {
      alerts.push({
        id: crypto.randomUUID(),
        company_id:    row.company_id,
        alert_type:    `${row.tax_type}_deadline`,
        severity:      'high',
        title:         `${typeName} deadline over ${daysLeft} dagen`,
        message:       `${typeName} aangifte moet vóór ${row.deadline}. Gereserveerd: €${row.amount_reserved.toFixed(0)} / Vereist: €${row.amount_required.toFixed(0)}. Gap: €${gap.toFixed(0)}.`,
        threshold:     row.amount_required,
        current_value: row.amount_reserved,
        is_resolved:   false,
        created_at:    new Date().toISOString(),
      })
    } else if (deadline <= in30 && gap > 500) {
      alerts.push({
        id: crypto.randomUUID(),
        company_id:    row.company_id,
        alert_type:    `${row.tax_type}_deadline`,
        severity:      'medium',
        title:         `${typeName} reservering onvoldoende`,
        message:       `${typeName} deadline over ${daysLeft} dagen. Reserveringstekort: €${gap.toFixed(0)}.`,
        threshold:     row.amount_required,
        current_value: row.amount_reserved,
        is_resolved:   false,
        created_at:    new Date().toISOString(),
      })
    }
  }
  return alerts
}

export async function generateExecutiveSummary(
  kpi:      CfoKpiData,
  cashflow: CfoCashflowData,
  tax:      CfoTaxData,
  periodYear: number,
  periodMonth: number,
): Promise<string> {
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  const maand   = maanden[periodMonth - 1]

  const prompt = `Schrijf een Executive Summary voor het CFO-rapport van ${maand} ${periodYear}. Stijl: Deloitte/McKinsey niveau. Zakelijk, precies, no-nonsense. 4-6 zinnen.

KPI DATA:
- Omzet: €${kpi.revenue_total.toFixed(0)} (${kpi.revenue_mom_change > 0 ? '+' : ''}${kpi.revenue_mom_change.toFixed(1)}% MoM)
- Kosten: €${kpi.costs_total.toFixed(0)}
- Nettowinst: €${kpi.profit_net.toFixed(0)} (marge ${kpi.profit_margin_pct.toFixed(1)}%)
- Cashflow 30d: €${cashflow.balance_30d.toFixed(0)}
- BTW tekort: €${tax.btw_gap.toFixed(0)}
- Openstaand: €${cashflow.incoming_30d.toFixed(0)}

Schrijf directe CFO-taal. Benoem concrete risico's en kansen.`

  const { text } = await generateText({
    model: claude.sonnet,
    maxOutputTokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  return text
}

// ── Abonnement detectie ───────────────────────────────────────────────────────

export async function detectSubscriptions(companyId: string): Promise<void> {
  const supabase = createAdminClient()

  // Haal laatste 3 maanden transacties op per leverancier
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: transactions } = await supabase
    .from('cfo_transactions')
    .select('supplier_id, amount_incl, transaction_date, description, cfo_suppliers(name, category)')
    .eq('company_id', companyId)
    .eq('direction', 'debet')
    .gte('transaction_date', threeMonthsAgo.toISOString().split('T')[0])
    .order('transaction_date', { ascending: false })

  if (!transactions) return

  // Groepeer per leverancier
  const bySupplier: Record<string, typeof transactions> = {}
  for (const tx of transactions) {
    if (!tx.supplier_id) continue
    if (!bySupplier[tx.supplier_id]) bySupplier[tx.supplier_id] = []
    bySupplier[tx.supplier_id].push(tx)
  }

  for (const [supplierId, txList] of Object.entries(bySupplier)) {
    if (txList.length < 2) continue

    // Check of bedragen vergelijkbaar zijn (terugkerend patroon)
    const amounts = txList.map(t => t.amount_incl)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const variance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1)

    if (variance && txList.length >= 2) {
      const supplierName = (txList[0] as any).cfo_suppliers?.name ?? 'Onbekend'
      await supabase.from('cfo_subscriptions').upsert({
        company_id:       companyId,
        supplier_id:      supplierId,
        name:             supplierName,
        category:         (txList[0] as any).cfo_suppliers?.category ?? 'software',
        amount_monthly:   avgAmount,
        billing_cycle:    'maandelijks',
        last_seen_date:   txList[0].transaction_date,
        is_active:        true,
        ai_detected:      true,
        ai_confidence:    Math.min(95, 60 + txList.length * 10),
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'company_id, supplier_id' })
    }
  }
}
