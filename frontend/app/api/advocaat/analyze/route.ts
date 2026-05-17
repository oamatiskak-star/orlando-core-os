import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL   = 'claude-opus-4-7'

async function callClaude(systemPrompt: string, userContent: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return 'ANTHROPIC_API_KEY niet geconfigureerd'

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) return `Claude API fout: ${res.status}`
  const json = await res.json()
  return json.content?.[0]?.text ?? 'Geen respons'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { dossier_id, analyse_type = 'volledig' } = await req.json()

  if (!dossier_id) return NextResponse.json({ error: 'dossier_id vereist' }, { status: 400 })

  const [dossierRes, risicoRes, documentRes, tijdlijnRes] = await Promise.all([
    supabase.from('advocaat_dossiers').select('*').eq('id', dossier_id).single(),
    supabase.from('advocaat_risicos').select('*').eq('dossier_id', dossier_id).eq('is_resolved', false),
    supabase.from('advocaat_documenten').select('id, title, document_type, document_date, ai_summary, content_label, is_evidence').eq('dossier_id', dossier_id).limit(50),
    supabase.from('advocaat_tijdlijn').select('*').eq('dossier_id', dossier_id).order('event_date').limit(100),
  ])

  if (dossierRes.error) return NextResponse.json({ error: dossierRes.error.message }, { status: 500 })

  const dossier   = dossierRes.data
  const risicos   = risicoRes.data ?? []
  const documenten = documentRes.data ?? []
  const tijdlijn  = tijdlijnRes.data ?? []

  const contextBlok = `
DOSSIER: ${dossier.title}
Type: ${dossier.dossier_type}
Wederpartij: ${dossier.wederpartij ?? 'Onbekend'}
Status: ${dossier.status}
Inzet: ${dossier.inzet_bedrag ? `€${dossier.inzet_bedrag}` : 'Onbekend'}
Volgende deadline: ${dossier.next_deadline ?? 'Geen'}

OPEN RISICO'S (${risicos.length}):
${risicos.map((r: Record<string, unknown>) => `- [${r.severity}] ${r.title}: ${r.description}`).join('\n') || 'Geen'}

DOCUMENTEN (${documenten.length}):
${documenten.map((d: Record<string, unknown>) => `- ${d.title} (${d.document_type}, ${d.document_date ?? 'datum onbekend'})`).join('\n') || 'Geen'}

TIJDLIJN EVENTS (${tijdlijn.length}):
${tijdlijn.slice(-20).map((t: Record<string, unknown>) => `- ${t.event_date}: [${t.source}] ${t.title}`).join('\n') || 'Geen'}
`

  const systemPrompt = `Je bent een elite juridisch analist met 25+ jaar ervaring in faillissementsrecht, ondernemingsrecht, vastgoedrecht en aansprakelijkheidsrecht.

KERNREGELS:
1. NOOIT juridisch advies verzinnen of speculeren zonder basis in de feiten
2. Maak altijd onderscheid: FEIT / INTERPRETATIE / RISICO / VERMOEDEN
3. Geef altijd een confidence score (0-100%) bij elke analyse
4. Wees direct, zakelijk en precies
5. Benoem sterke én zwakke punten eerlijk
6. Geef concrete actie-items met deadlines

ANALYSE TYPE: ${analyse_type}`

  const userPrompt = `Analyseer onderstaand juridisch dossier volledig:\n\n${contextBlok}\n\nGeef:\n1. Samenvatting situatie\n2. Top 3 sterkste punten voor verdediging\n3. Top 3 kwetsbaarste punten\n4. Concrete aanbevolen strategie\n5. Directe actie-items (gesorteerd op urgentie)\n6. Juridische basis voor elke stelling\n7. Schatting slagingskans verdediging (0-100%)`

  const analyse = await callClaude(systemPrompt, userPrompt)

  const { data: strategieData } = await supabase.from('advocaat_strategie').insert({
    dossier_id,
    analyse_type,
    aanbevolen_strategie: analyse,
    ai_model: CLAUDE_MODEL,
    bronnen_gebruikt: documenten.map((d: Record<string, unknown>) => d.id),
  }).select().single()

  await supabase.from('advocaat_audit_log').insert({
    dossier_id,
    action: 'strategie_analyse',
    actor: 'ai_systeem',
    description: `AI strategieanalyse uitgevoerd (type: ${analyse_type})`,
    metadata: { model: CLAUDE_MODEL, document_count: documenten.length },
  })

  return NextResponse.json({ strategie: strategieData, analyse })
}
