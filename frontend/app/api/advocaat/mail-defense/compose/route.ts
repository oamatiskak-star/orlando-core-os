import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Document search helper ───────────────────────────────────────────────────

async function searchDocuments(supabase: Awaited<ReturnType<typeof createClient>>, keywords: string[], limit = 8) {
  if (keywords.length === 0) return []

  const query = keywords.slice(0, 3).join(' | ')
  const { data } = await supabase
    .from('advocaat_documenten')
    .select('id, title, document_type, content_label, raw_text, source_filename, is_evidence, evidence_strength, ai_risk_flags, document_date')
    .or(keywords.map(k => `title.ilike.%${k}%,raw_text.ilike.%${k}%,source_filename.ilike.%${k}%`).join(','))
    .eq('is_evidence', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Vul aan met niet-bewijs docs als minder dan limit
  if ((data?.length ?? 0) < limit) {
    const { data: more } = await supabase
      .from('advocaat_documenten')
      .select('id, title, document_type, content_label, raw_text, source_filename, is_evidence, evidence_strength, ai_risk_flags, document_date')
      .or(keywords.map(k => `title.ilike.%${k}%,raw_text.ilike.%${k}%`).join(','))
      .order('created_at', { ascending: false })
      .limit(limit - (data?.length ?? 0))
    return [...(data ?? []), ...(more ?? [])]
  }

  return data ?? []
}

// ── Keywords extraheren uit mail tekst ───────────────────────────────────────

function extractKeywords(text: string): string[] {
  const LEGAL = [
    'curator','faillissement','dagvaarding','vonnis','ingebrekestelling',
    'sommatie','aansprakelijk','pauliana','boedel','schulden','rechtbank',
    'incasso','bestuursverbod','hoger beroep','beslag','dwangsom',
    'rekening courant','overdracht','lening','krediet',
  ]
  const lower = text.toLowerCase()
  return LEGAL.filter(k => lower.includes(k))
}

// ── POST /api/advocaat/mail-defense/compose ───────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    mail_id,
    body_text,
    subject,
    from_address,
    from_name,
    dossier_id,
    tone = 'zakelijk',
  } = await req.json()

  if (!body_text) {
    return NextResponse.json({ error: 'body_text vereist' }, { status: 400 })
  }

  // 1. Laad relevant geheugen (dossier + globaal)
  const memoriesQ = supabase
    .from('advocaat_geheugen')
    .select('type, subject, content, confidence, tags')
    .eq('is_active', true)
    .order('last_used_at', { ascending: false })
    .limit(20)

  const globalMem   = memoriesQ
  const dossierMem  = dossier_id
    ? supabase
        .from('advocaat_geheugen')
        .select('type, subject, content, confidence, tags')
        .eq('is_active', true)
        .eq('dossier_id', dossier_id)
        .order('last_used_at', { ascending: false })
        .limit(30)
    : null

  const [{ data: globalMemories }, dossierResult] = await Promise.all([
    globalMem,
    dossierMem ?? Promise.resolve({ data: [] }),
  ])

  const allMemories = [
    ...(dossierResult?.data ?? []),
    ...(globalMemories ?? []).filter(m =>
      !(dossierResult?.data ?? []).some((d: { subject: string }) => d.subject === m.subject)
    ),
  ].slice(0, 25)

  // 2. Laad dossier info
  let dossierInfo = ''
  if (dossier_id) {
    const { data: dossier } = await supabase
      .from('advocaat_dossiers')
      .select('title, dossier_type, status, wederpartij, risk_score, ai_summary, ai_risk_analysis')
      .eq('id', dossier_id)
      .single()
    if (dossier) {
      dossierInfo = `Titel: ${dossier.title}\nType: ${dossier.dossier_type}\nStatus: ${dossier.status}\nWederpartij: ${dossier.wederpartij ?? 'onbekend'}\nRisicoscore: ${dossier.risk_score}/100\nSamenvatting: ${dossier.ai_summary ?? 'nog geen'}`
    }
  }

  // 3. Zoek relevante documenten op basis van trefwoorden in mail
  const keywords = extractKeywords(body_text + ' ' + (subject ?? ''))
  const documents = await searchDocuments(supabase, keywords.length > 0 ? keywords : ['curator','faillissement','aansprakelijk'])

  // 4. Bouw context op voor Claude
  const memoriesText = allMemories.length > 0
    ? allMemories.map(m =>
        `[${m.type.toUpperCase()}] ${m.subject} (betrouwbaarheid: ${Math.round((m.confidence ?? 0.8) * 100)}%)\n${m.content}`
      ).join('\n\n')
    : 'Geen geheugen beschikbaar.'

  const docsText = documents.length > 0
    ? documents.map(d =>
        `📄 ${d.title} (${d.document_type}, ${d.content_label}${d.is_evidence ? ', BEWIJS' : ''})\n` +
        (d.raw_text ? d.raw_text.slice(0, 600) + (d.raw_text.length > 600 ? '...' : '') : '[geen tekst geëxtraheerd]')
      ).join('\n\n---\n\n')
    : 'Geen relevante documenten gevonden.'

  const systemPrompt = `Je bent de AI Advocaat OS van Orlando Amatiskak, een Nederlandse ondernemer verwikkeld in juridische procedures rond het faillissement van Bouwproffs Nederland BV. Je helpt hem juridisch onderbouwde conceptantwoorden te schrijven.

STRIKTE REGELS:
- Schrijf ALTIJD in het Nederlands
- Verzin NOOIT feiten, data, bedragen of namen
- Baseer je ALLEEN op de aangeleverde context
- Geef ALTIJD duidelijk aan wat FEIT is vs INTERPRETATIE vs RISICO
- Geef een confidence score (0-100%) voor het antwoord
- NOOIT automatisch verzenden — dit is altijd een CONCEPT
- Gebruik zakelijke, juridisch correcte taal
- Vermeld relevante wetsartikelen alleen als je 100% zeker bent`

  const userPrompt = `INKOMENDE MAIL:
Afzender: ${from_name ?? ''} <${from_address ?? ''}>
Onderwerp: ${subject ?? '(geen onderwerp)'}
Inhoud:
${body_text}

---

DOSSIERCONTEXT:
${dossierInfo || 'Geen dossier geselecteerd.'}

---

STRATEGISCH GEHEUGEN (${allMemories.length} items):
${memoriesText}

---

RELEVANTE DOCUMENTEN UIT BEWIJS-ARCHIEF (${documents.length} gevonden):
${docsText}

---

Schrijf nu een juridisch onderbouwd conceptantwoord op de bovenstaande mail. Structureer je antwoord als volgt:

1. CONCEPT ANTWOORD (kant-en-klaar, toon: ${tone})
2. JURIDISCHE ONDERBOUWING (welke feiten/documenten/strategie gebruikt)
3. RISICO'S VAN DIT ANTWOORD
4. AANBEVOLEN BIJLAGEN (welke documenten meesturen — uit de lijst hierboven)
5. CONFIDENCE SCORE (0-100%) + REDEN

Gebruik [FEIT], [INTERPRETATIE] of [RISICO] tags waar relevant.`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 3000,
      messages:   [{ role: 'user', content: userPrompt }],
      system:     systemPrompt,
    })

    const aiDraft = message.content[0].type === 'text' ? message.content[0].text : ''

    // 5. Sla draft op in mail_defense record + document IDs
    const suggestedDocIds = documents.slice(0, 5).map(d => d.id)

    if (mail_id) {
      await supabase
        .from('advocaat_mail_defense')
        .update({
          ai_draft:         aiDraft,
          draft_created_at: new Date().toISOString(),
          suggested_doc_ids: suggestedDocIds,
          processed:        false,
        })
        .eq('id', mail_id)
    }

    // 6. Sla strategisch inzicht op in geheugen
    if (dossier_id && aiDraft.length > 100) {
      await supabase.from('advocaat_geheugen').insert({
        dossier_id,
        type:    'strategie',
        subject: `Antwoord op mail: ${(subject ?? '').slice(0, 80)}`,
        content: aiDraft.slice(0, 1500),
        confidence: 0.75,
        tags: ['mail_antwoord', ...keywords.slice(0, 3)],
      }).select()
    }

    return NextResponse.json({
      draft:              aiDraft,
      suggested_doc_ids:  suggestedDocIds,
      suggested_docs:     documents.slice(0, 5).map(d => ({
        id:            d.id,
        title:         d.title,
        document_type: d.document_type,
        is_evidence:   d.is_evidence,
        content_label: d.content_label,
      })),
      memories_used:  allMemories.length,
      docs_searched:  documents.length,
      keywords_found: keywords,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
