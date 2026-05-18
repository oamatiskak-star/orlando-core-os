import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { defaultModel } from '@/lib/ai/client'



export async function POST() {
  try {
    const supabase = await createClient()

    const [projectsRes, invoicesRes, incassoRes, cfoRes] = await Promise.all([
      supabase.from('projects').select('name, status, budget, actual_cost, margin_pct').limit(30),
      supabase.from('fin_invoices').select('status, amount_incl, amount_excl, btw_amount, category').limit(100),
      supabase.from('fin_incasso_cases').select('amount_total, costs').eq('status', 'actief'),
      supabase.from('cfo_ai_insights').select('type, priority, content, potential_saving').eq('resolved', false).limit(10),
    ])

    const projects = projectsRes.data ?? []
    const invoices = invoicesRes.data ?? []
    const incasso = incassoRes.data ?? []
    const insights = cfoRes.data ?? []

    const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0)
    const totalCost = projects.reduce((s, p) => s + (p.actual_cost ?? 0), 0)
    const avgMargin = projects.length ? projects.reduce((s, p) => s + (p.margin_pct ?? 0), 0) / projects.length : 0
    const totalRevenue = invoices.filter(i => i.status === 'betaald').reduce((s, i) => s + i.amount_incl, 0)
    const incassoCosts = incasso.reduce((s, c) => s + (c.costs ?? 0), 0)
    const potentialSavings = insights.reduce((s, i) => s + (i.potential_saving ?? 0), 0)

    const lowMarginProjects = projects.filter(p => (p.margin_pct ?? 0) < 10 && p.status === 'actief')
    const overBudgetProjects = projects.filter(p => (p.actual_cost ?? 0) > (p.budget ?? 0))

    const prompt = `Je bent de Financial Optimization Agent van Orlando — specialist in margeoptimalisatie en kostenreductie voor Nederlandse bouwbedrijven (STRKBEHEER, STRKBOUW, BOUWPROFFS, MODIWERIJO).

FINANCIËLE DATA (${new Date().toLocaleDateString('nl-NL')}):
- Totaal projectbudget: €${totalBudget.toLocaleString('nl-NL')}
- Werkelijke kosten: €${totalCost.toLocaleString('nl-NL')} (${totalBudget > 0 ? Math.round(totalCost/totalBudget*100) : 0}% benut)
- Gemiddelde projectmarge: ${avgMargin.toFixed(1)}%
- Totale omzet (betaald): €${totalRevenue.toLocaleString('nl-NL')}
- Incasso kosten: €${incassoCosts.toLocaleString('nl-NL')}
- CFO-geïdentificeerde besparingen: €${potentialSavings.toLocaleString('nl-NL')}
- Projecten met lage marge (<10%): ${lowMarginProjects.length}
- Projecten over budget: ${overBudgetProjects.length}

LAGE MARGE PROJECTEN:
${lowMarginProjects.slice(0, 5).map(p => `- ${p.name}: marge ${p.margin_pct?.toFixed(1) ?? '?'}%`).join('\n') || 'Geen'}

CFO INZICHTEN:
${insights.slice(0, 5).map(i => `- [${i.priority.toUpperCase()}] ${i.content}`).join('\n') || 'Geen openstaande inzichten'}

Geef een FINANCIAL OPTIMIZATION ANALYSE:
1. Top 3 Kostenreducties (concrete bedragen en acties)
2. Margeverbeterplan (per project categorie)
3. Cashflow Optimalisatie (betalingstermijnen, kortingen, timing)
4. Incasso Kostenreductie (voorkomen vs. oplossen)
5. Kwartaal Besparingstarget (realistisch bedrag + plan)

Schrijf als McKinsey financial advisor voor bouw. Concrete getallen, geen theorie.`

    const { text: analysis } = await generateText({
      model: defaultModel,
      maxOutputTokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    await supabase.from('osil_sessions').insert({
      session_type: 'financial_optimization',
      title: `Financial Optimization — ${new Date().toLocaleDateString('nl-NL')}`,
      status: 'completed',
      priority: overBudgetProjects.length > 2 ? 'hoog' : 'normaal',
      triggered_by: 'manual',
      company_ids: ['strkbeheer', 'strkbouw', 'modiwerijo'],
      context_snapshot: { avg_margin: avgMargin, total_budget: totalBudget, total_cost: totalCost, low_margin_count: lowMarginProjects.length, over_budget_count: overBudgetProjects.length },
      ai_analysis: analysis,
      ai_recommendations: [],
      executive_summary: analysis.split('\n')[0] ?? '',
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      analysis,
      stats: { totalBudget, totalCost, avgMargin, totalRevenue, potentialSavings, lowMarginCount: lowMarginProjects.length, overBudgetCount: overBudgetProjects.length },
    })
  } catch (err) {
    console.error('OSIL optimalisatie error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
