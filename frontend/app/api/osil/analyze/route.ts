import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  try {
    const supabase = await createClient()

    // Collect live data from all systems
    const [invRes, casesRes, cfoRes, projectsRes, alertsRes] = await Promise.all([
      supabase.from('fin_invoices').select('status, amount_incl, days_overdue').limit(200),
      supabase.from('fin_incasso_cases').select('status, amount_total').eq('status', 'actief'),
      supabase.from('cfo_ai_insights').select('type, priority, content').eq('resolved', false).limit(10),
      supabase.from('projects').select('status, budget, actual_cost').limit(50),
      supabase.from('osil_alerts').select('severity, title').eq('resolved', false).limit(20),
    ])

    const invoices = invRes.data ?? []
    const incasso = casesRes.data ?? []
    const cfoInsights = cfoRes.data ?? []
    const projects = projectsRes.data ?? []
    const activeAlerts = alertsRes.data ?? []

    // Compute KPIs
    const openAR = invoices.filter(i => i.status === 'open').reduce((s, i) => s + i.amount_incl, 0)
    const overdueAR = invoices.filter(i => i.status === 'vervallen').reduce((s, i) => s + i.amount_incl, 0)
    const incassoTotal = incasso.reduce((s, c) => s + c.amount_total, 0)
    const criticalCount = invoices.filter(i => i.days_overdue > 30).length

    const projectBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)
    const projectCosts = projects.reduce((s, p) => s + (p.actual_cost ?? 0), 0)
    const budgetUtilization = projectBudget > 0 ? Math.round((projectCosts / projectBudget) * 100) : 0

    const snapshot = {
      ar_open: openAR,
      ar_overdue: overdueAR,
      ar_incasso: incassoTotal,
      critical_invoices: criticalCount,
      active_projects: projects.length,
      budget_utilization_pct: budgetUtilization,
      active_cfo_alerts: cfoInsights.length,
      active_osil_alerts: activeAlerts.length,
      survival_mode: overdueAR > 50000 || incassoTotal > 25000,
      growth_mode: overdueAR < 10000 && openAR > 100000,
    }

    // AI strategic analysis
    const prompt = `Je bent de strategische AI-adviseur van Orlando — een Nederlandse vastgoedontwikkelaar, aannemer en SaaS-builder.

Bedrijven: STRKBEHEER BV, STRKBOUW BV, BOUWPROFFS BV, MODIWERIJO FINANCIAL MANAGEMENT BV

LIVE DATA (vandaag, ${new Date().toLocaleDateString('nl-NL')}):
- Openstaande debiteuren: €${openAR.toLocaleString('nl-NL')}
- Vervallen facturen: €${overdueAR.toLocaleString('nl-NL')}
- Actieve incasso dossiers: €${incassoTotal.toLocaleString('nl-NL')}
- Kritieke facturen (>30d): ${criticalCount}
- Actieve projecten: ${projects.length}
- Budget utilization: ${budgetUtilization}%
- Openstaande CFO waarschuwingen: ${cfoInsights.length}
- Modus: ${snapshot.survival_mode ? 'SURVIVAL' : snapshot.growth_mode ? 'GROEI' : 'BALANS'}

OPENSTAANDE WAARSCHUWINGEN:
${activeAlerts.map(a => `- [${a.severity.toUpperCase()}] ${a.title}`).join('\n') || 'Geen openstaande waarschuwingen'}

Geef een STRATEGISCHE BOARD ANALYSE in het Nederlands:
1. Executive Summary (3-4 zinnen, CEO-niveau)
2. Top 3 Risico's (met actie)
3. Top 3 Kansen (met actie)
4. Operationele Prioriteiten deze week
5. Survival vs Growth verdict

Wees direct, zakelijk, geen fluff. Schrijf als McKinsey meets Dutch construction.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const analysis = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse recommendations from AI
    const recommendations = [
      { priority: 'hoog', action: `Incasso dossiers (€${incassoTotal.toLocaleString('nl-NL')}) opvolgen`, category: 'finance' },
      { priority: overdueAR > 20000 ? 'kritiek' : 'normaal', action: `Vervallen facturen innen (€${overdueAR.toLocaleString('nl-NL')})`, category: 'cashflow' },
      { priority: budgetUtilization > 90 ? 'hoog' : 'normaal', action: `Projectbudget monitoring (${budgetUtilization}% benut)`, category: 'projects' },
    ]

    // Save session to DB
    const { data: session } = await supabase.from('osil_sessions').insert({
      session_type: 'board_meeting',
      title: `Board Analyse — ${new Date().toLocaleDateString('nl-NL')}`,
      status: 'completed',
      priority: snapshot.survival_mode ? 'kritiek' : 'normaal',
      triggered_by: 'manual',
      company_ids: ['strkbeheer', 'strkbouw', 'modiwerijo'],
      context_snapshot: snapshot,
      ai_analysis: analysis,
      ai_recommendations: recommendations,
      executive_summary: analysis.split('\n')[0] ?? '',
      completed_at: new Date().toISOString(),
    }).select().single()

    // Save KPI snapshot
    await supabase.from('osil_kpi_snapshots').insert({
      company_id: 'all',
      ar_open: openAR,
      ar_overdue: overdueAR,
      ar_incasso: incassoTotal,
      active_projects: projects.length,
      survival_mode: snapshot.survival_mode,
      growth_mode: snapshot.growth_mode,
      ai_verdict: analysis.substring(0, 500),
    })

    // Generate alerts for critical conditions
    if (snapshot.survival_mode) {
      await supabase.from('osil_alerts').upsert({
        alert_type: 'cashflow_critical',
        severity: 'critical',
        title: 'Survival Mode geactiveerd',
        description: `Vervallen AR €${overdueAR.toLocaleString('nl-NL')} + Incasso €${incassoTotal.toLocaleString('nl-NL')} overschrijdt drempel`,
        recommended_action: 'Directe cashflow actie vereist. Schakel CFO Agent in.',
        company_id: 'all',
        resolved: false,
      }, { onConflict: 'alert_type,company_id' })
    }

    return NextResponse.json({
      ok: true,
      session_id: session?.id,
      snapshot,
      analysis,
      recommendations,
      mode: snapshot.survival_mode ? 'SURVIVAL' : snapshot.growth_mode ? 'GROEI' : 'BALANS',
    })
  } catch (err) {
    console.error('OSIL analyze error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const [sessionsRes, alertsRes, kpiRes, oppsRes] = await Promise.all([
      supabase.from('osil_sessions').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('osil_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('osil_kpi_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('osil_opportunities').select('*').neq('status', 'afgewezen').order('ai_score', { ascending: false }).limit(5),
    ])

    return NextResponse.json({
      sessions: sessionsRes.data ?? [],
      alerts: alertsRes.data ?? [],
      latest_kpi: kpiRes.data ?? null,
      top_opportunities: oppsRes.data ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
