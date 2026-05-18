import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { defaultModel } from '@/lib/ai/client'



export async function POST() {
  try {
    const supabase = await createClient()

    const [invoicesRes, projectsRes, incassoRes] = await Promise.all([
      supabase.from('fin_invoices').select('status, amount_incl, amount_excl, btw_amount, category, invoice_date').limit(200),
      supabase.from('projects').select('name, status, budget, actual_cost, margin_pct, start_date, end_date').limit(30),
      supabase.from('fin_incasso_cases').select('amount_total, costs, status').limit(20),
    ])

    const invoices = invoicesRes.data ?? []
    const projects = projectsRes.data ?? []
    const incasso = incassoRes.data ?? []

    const totalBTW = invoices.reduce((s, i) => s + (i.btw_amount ?? 0), 0)
    const btwTeBetalen = invoices.filter(i => i.status === 'open' || i.status === 'vervallen').reduce((s, i) => s + (i.btw_amount ?? 0), 0)
    const totalExcl = invoices.filter(i => i.status === 'betaald').reduce((s, i) => s + i.amount_excl, 0)
    const totalInkoop = invoices.filter(i => i.category === 'inkoop' || i.category === 'kosten').reduce((s, i) => s + i.amount_excl, 0)
    const brutomarge = totalExcl - totalInkoop
    const vennootschapsbelasting = Math.max(0, brutomarge * 0.19)
    const incassoCosts = incasso.reduce((s, c) => s + (c.costs ?? 0), 0)

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentQuarter = Math.ceil(currentMonth / 3)
    const btwDeadline = new Date(now.getFullYear(), currentQuarter * 3, 30).toLocaleDateString('nl-NL')

    const prompt = `Je bent de AI Fiscalist van Orlando — expert in Nederlandse belastingwetgeving voor bouwbedrijven en vastgoedontwikkelaars (BV-structuur, BTW-aangifte, VPB, dividenduitkering, intercompany).

Entiteiten: STRKBEHEER BV, STRKBOUW BV, BOUWPROFFS BV (60/40 JV), MODIWERIJO FINANCIAL MANAGEMENT BV
Holding: O.S.M. Amatiskak (via STRKBEHEER als tussenholding)

FISCALE DATA (${now.toLocaleDateString('nl-NL')}):
- Kwartaal: Q${currentQuarter} ${now.getFullYear()}
- Volgende BTW-deadline: ${btwDeadline}
- Totale BTW uitgefactureerd: €${totalBTW.toLocaleString('nl-NL')}
- BTW op openstaande/vervallen facturen: €${btwTeBetalen.toLocaleString('nl-NL')}
- Omzet (excl. BTW, betaald): €${totalExcl.toLocaleString('nl-NL')}
- Inkoopkosten: €${totalInkoop.toLocaleString('nl-NL')}
- Brutomarge: €${brutomarge.toLocaleString('nl-NL')}
- Geschatte VPB (19%): €${vennootschapsbelasting.toLocaleString('nl-NL')}
- Incasso kosten (aftrekbaar): €${incassoCosts.toLocaleString('nl-NL')}
- Actieve projecten: ${projects.filter(p => p.status === 'actief').length}

Geef een FISCALE ANALYSE & OPTIMALISATIE:
1. BTW Aangifte Status (Q${currentQuarter} — wat nu doen)
2. VPB Optimalisatie (aftrekposten, timing, holdingstructuur)
3. Dividendstrategie (optimaal uitkeringsmoment vanuit holding)
4. Intercompany Risico's (BOUWPROFFS 60/40 JV, doorbelasting)
5. Fiscale Actiepunten komende 30 dagen (met deadlines)

Schrijf als Nederlandse belastingadviseur (Big 4 niveau). Gebruik Nederlandse fiscale terminologie. Geen disclaimers — concrete adviezen.`

    const { text: analysis } = await generateText({
      model: defaultModel,
      maxOutputTokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    await supabase.from('osil_sessions').insert({
      session_type: 'fiscal_analysis',
      title: `AI Fiscalist Q${currentQuarter} — ${now.toLocaleDateString('nl-NL')}`,
      status: 'completed',
      priority: btwTeBetalen > 10000 ? 'hoog' : 'normaal',
      triggered_by: 'manual',
      company_ids: ['strkbeheer', 'strkbouw', 'modiwerijo', 'bouwproffs'],
      context_snapshot: { btw_totaal: totalBTW, btw_te_betalen: btwTeBetalen, omzet_excl: totalExcl, brutomarge, vpb_schatting: vennootschapsbelasting, kwartaal: currentQuarter },
      ai_analysis: analysis,
      ai_recommendations: [],
      executive_summary: analysis.split('\n')[0] ?? '',
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      analysis,
      stats: { totalBTW, btwTeBetalen, totalExcl, brutomarge, vennootschapsbelasting, currentQuarter, btwDeadline },
    })
  } catch (err) {
    console.error('OSIL fiscalist error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
