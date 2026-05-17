import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic  = 'force-dynamic'
export const maxDuration = 60

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

// Laad bestaand geheugen voor het dossier
async function loadMemory(supabase: Awaited<ReturnType<typeof createClient>>, dossier_id: string) {
  const { data } = await supabase
    .from('advocaat_geheugen')
    .select('type, subject, content, confidence')
    .eq('dossier_id', dossier_id)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false })
    .limit(20)
  return data ?? []
}

// Sla inzichten op als geheugen na analyse
async function saveInsightsToMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dossier_id: string,
  analyse: string,
  analyse_type: string,
  doc_ids: string[]
) {
  const memories = []

  // Extracteer strategie-samenvatting
  const strategieLine = analyse.match(/aanbevolen strategie[:\s]+([^\n]+(?:\n[^\n]+){0,3})/i)
  if (strategieLine?.[1]) {
    memories.push({
      dossier_id, type: 'strategie',
      subject: `Strategie uit ${analyse_type} analyse`,
      content: strategieLine[1].slice(0, 800),
      confidence: 0.80, source_document_ids: doc_ids.slice(0, 5),
      tags: ['auto_analyse', analyse_type],
    })
  }

  // Extracteer risico's
  const risicoMatch = analyse.match(/kwetsbaar[^\n]*\n((?:[-•\d][^\n]+\n?){1,5})/i)
  if (risicoMatch?.[1]) {
    memories.push({
      dossier_id, type: 'risico',
      subject: 'Kwetsbaarheden vastgesteld in analyse',
      content: risicoMatch[1].slice(0, 600),
      confidence: 0.75, source_document_ids: [],
      tags: ['auto_analyse', 'kwetsbaarheden'],
    })
  }

  // Extracteer sterke punten
  const sterkMatch = analyse.match(/sterk(?:ste)? punt[^\n]*\n((?:[-•\d][^\n]+\n?){1,5})/i)
  if (sterkMatch?.[1]) {
    memories.push({
      dossier_id, type: 'juridisch_standpunt',
      subject: 'Sterke verdedigingspunten',
      content: sterkMatch[1].slice(0, 600),
      confidence: 0.80, source_document_ids: [],
      tags: ['auto_analyse', 'verdediging'],
    })
  }

  // Sla op — upsert op subject+type+dossier
  for (const mem of memories) {
    const { data: existing } = await supabase
      .from('advocaat_geheugen')
      .select('id, times_used')
      .eq('type', mem.type)
      .eq('subject', mem.subject)
      .eq('dossier_id', dossier_id)
      .maybeSingle()

    if (existing) {
      await supabase.from('advocaat_geheugen').update({
        content: mem.content, confidence: mem.confidence,
        last_used_at: new Date().toISOString(),
        times_used: existing.times_used + 1,
      }).eq('id', existing.id)
    } else {
      await supabase.from('advocaat_geheugen').insert(mem)
    }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { dossier_id, analyse_type = 'volledig' } = await req.json()

  if (!dossier_id) return NextResponse.json({ error: 'dossier_id vereist' }, { status: 400 })

  const [dossierRes, risicoRes, documentRes, tijdlijnRes, memory] = await Promise.all([
    supabase.from('advocaat_dossiers').select('*').eq('id', dossier_id).single(),
    supabase.from('advocaat_risicos').select('*').eq('dossier_id', dossier_id).eq('is_resolved', false),
    supabase.from('advocaat_documenten').select('id, title, document_type, document_date, ai_summary, content_label, is_evidence').eq('dossier_id', dossier_id).limit(50),
    supabase.from('advocaat_tijdlijn').select('*').eq('dossier_id', dossier_id).order('event_date').limit(100),
    loadMemory(supabase, dossier_id),
  ])

  if (dossierRes.error) return NextResponse.json({ error: dossierRes.error.message }, { status: 500 })

  const dossier    = dossierRes.data
  const risicos    = risicoRes.data   ?? []
  const documenten = documentRes.data ?? []
  const tijdlijn   = tijdlijnRes.data ?? []

  const memoryBlok = memory.length > 0
    ? `\nBESTAAND GEHEUGEN (${memory.length} items):\n` +
      memory.map(m => `[${m.type.toUpperCase()}] ${m.subject}: ${m.content.slice(0, 200)}`).join('\n')
    : ''

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
${memoryBlok}`

  const systemPrompt = `Je bent een elite juridisch analist met 25+ jaar ervaring in faillissementsrecht, ondernemingsrecht, vastgoedrecht en aansprakelijkheidsrecht.

KERNREGELS:
1. NOOIT juridisch advies verzinnen of speculeren zonder basis in de feiten
2. Maak altijd onderscheid: FEIT / INTERPRETATIE / RISICO / VERMOEDEN
3. Geef altijd een confidence score (0-100%) bij elke analyse
4. Wees direct, zakelijk en precies
5. Benoem sterke én zwakke punten eerlijk
6. Geef concrete actie-items met deadlines
7. Gebruik bestaand geheugen als context maar wees kritisch

ANALYSE TYPE: ${analyse_type}`

  const userPrompt = `Analyseer onderstaand juridisch dossier volledig:\n\n${contextBlok}\n\nGeef:\n1. Samenvatting situatie\n2. Top 3 sterkste punten voor verdediging\n3. Top 3 kwetsbaarste punten\n4. Aanbevolen strategie\n5. Directe actie-items (gesorteerd op urgentie)\n6. Juridische basis voor elke stelling\n7. Schatting slagingskans verdediging (0-100%)`

  const analyse = await callClaude(systemPrompt, userPrompt)
  const docIds   = documenten.map((d: Record<string, unknown>) => d.id as string)

  // Sla strategie op + sla inzichten in geheugen (parallel)
  const [strategieResult] = await Promise.all([
    supabase.from('advocaat_strategie').insert({
      dossier_id,
      analyse_type,
      aanbevolen_strategie: analyse,
      ai_model: CLAUDE_MODEL,
      bronnen_gebruikt: docIds,
    }).select().single(),
    saveInsightsToMemory(supabase, dossier_id, analyse, analyse_type, docIds),
    supabase.from('advocaat_audit_log').insert({
      dossier_id,
      action: 'strategie_analyse',
      actor: 'ai_systeem',
      description: `AI strategieanalyse (type: ${analyse_type}), geheugen bijgewerkt`,
      metadata: { model: CLAUDE_MODEL, document_count: documenten.length, memory_items: memory.length },
    }),
  ])

  return NextResponse.json({ strategie: strategieResult.data, analyse })
}
