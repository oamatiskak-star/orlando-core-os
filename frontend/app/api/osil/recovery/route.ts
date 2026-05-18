import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { defaultModel } from '@/lib/ai/client'



export async function POST() {
  try {
    const supabase = await createClient()

    const [invRes, incassoRes, alertsRes, mailRes] = await Promise.all([
      supabase.from('fin_invoices').select('status, amount_incl, days_overdue, debtor_name').eq('status', 'vervallen').order('days_overdue', { ascending: false }).limit(20),
      supabase.from('fin_incasso_cases').select('*').eq('status', 'actief').limit(10),
      supabase.from('osil_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(15),
      supabase.from('mail_messages').select('subject, sender, classification, received_at').eq('classification', 'legal').order('received_at', { ascending: false }).limit(10),
    ])

    const overdue = invRes.data ?? []
    const incasso = incassoRes.data ?? []
    const alerts = alertsRes.data ?? []
    const legalMail = mailRes.data ?? []

    const totalOverdue = overdue.reduce((s, i) => s + i.amount_incl, 0)
    const totalIncasso = incasso.reduce((s, c) => s + c.amount_total, 0)
    const criticalOverdue = overdue.filter(i => i.days_overdue > 60)

    const prompt = `Je bent de Recovery & Reputatie Agent van Orlando — expert in cashflow herstel en reputatiebescherming voor Nederlandse bouwbedrijven.

KRITIEKE DATA (${new Date().toLocaleDateString('nl-NL')}):
- Vervallen facturen: €${totalOverdue.toLocaleString('nl-NL')} (${overdue.length} stuks)
- Kritiek >60 dagen: ${criticalOverdue.length} facturen
- Actieve incasso: €${totalIncasso.toLocaleString('nl-NL')} (${incasso.length} dossiers)
- Openstaande OSIL alerts: ${alerts.length}
- Juridische mails ontvangen: ${legalMail.length}

TOP VERVALLEN DEBITEUREN:
${overdue.slice(0, 5).map(i => `- ${i.debtor_name ?? 'Onbekend'}: €${i.amount_incl.toLocaleString('nl-NL')} (${i.days_overdue} dagen)`).join('\n') || 'Geen data'}

INCASSO DOSSIERS:
${incasso.slice(0, 5).map(c => `- Dossier: €${c.amount_total.toLocaleString('nl-NL')} — status: ${c.status}`).join('\n') || 'Geen actieve dossiers'}

Geef een RECOVERY & REPUTATIE ANALYSE:
1. Cashflow Herstelplan (concrete stappen deze week)
2. Reputatierisico's (welke debiteurs vormen gevaar voor relatie)
3. Incasso Prioritering (welke dossiers nu escaleren)
4. Communicatiestrategie (hoe benaderen zonder relatie te beschadigen)
5. 30-dagen herstelprognose

Schrijf als incasso-specialist + relatiemanager. Direct, geen fluff.`

    const { text: analysis } = await generateText({
      model: defaultModel,
      maxOutputTokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    // Save to osil_sessions
    await supabase.from('osil_sessions').insert({
      session_type: 'recovery_analysis',
      title: `Recovery Agent — ${new Date().toLocaleDateString('nl-NL')}`,
      status: 'completed',
      priority: totalOverdue > 50000 ? 'kritiek' : 'hoog',
      triggered_by: 'manual',
      company_ids: ['strkbeheer', 'strkbouw', 'modiwerijo'],
      context_snapshot: { total_overdue: totalOverdue, total_incasso: totalIncasso, critical_count: criticalOverdue.length },
      ai_analysis: analysis,
      ai_recommendations: [],
      executive_summary: analysis.split('\n')[0] ?? '',
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      analysis,
      stats: { totalOverdue, totalIncasso, overdueCount: overdue.length, criticalCount: criticalOverdue.length },
      topDebtors: overdue.slice(0, 5),
    })
  } catch (err) {
    console.error('OSIL recovery error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
