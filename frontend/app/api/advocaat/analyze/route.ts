import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { defaultModel } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

async function loadMemory(supabase: SupabaseServer, dossier_id: string) {
  const { data } = await supabase
    .from('advocaat_geheugen')
    .select('type, subject, content, confidence, tags')
    .eq('dossier_id', dossier_id)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false })
    .limit(50)
  return data ?? []
}

async function saveInsightsToMemory(
  supabase: SupabaseServer,
  dossier_id: string,
  analyse: string,
  analyse_type: string,
  doc_ids: string[]
) {
  const memories: Array<{
    dossier_id: string
    type: string
    subject: string
    content: string
    confidence: number
    source_document_ids: string[]
    tags: string[]
  }> = []

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

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: NextRequest) {
  const { dossier_id, analyse_type = 'volledig' } = await req.json()
  if (!dossier_id) {
    return new Response(JSON.stringify({ error: 'dossier_id vereist' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = await createClient()
  const [dossierRes, risicoRes, documentRes, tijdlijnRes, memory] = await Promise.all([
    supabase.from('advocaat_dossiers').select('*').eq('id', dossier_id).single(),
    supabase.from('advocaat_risicos').select('*').eq('dossier_id', dossier_id).eq('is_resolved', false),
    supabase.from('advocaat_documenten').select('id, title, document_type, document_date, ai_summary, content_label, is_evidence').eq('dossier_id', dossier_id).limit(50),
    supabase.from('advocaat_tijdlijn').select('*').eq('dossier_id', dossier_id).order('event_date').limit(100),
    loadMemory(supabase, dossier_id),
  ])

  if (dossierRes.error) {
    return new Response(JSON.stringify({ error: dossierRes.error.message }), {
      status: 500, headers: { 'content-type': 'application/json' },
    })
  }

  const dossier    = dossierRes.data
  const risicos    = risicoRes.data   ?? []
  const documenten = documentRes.data ?? []
  const tijdlijn   = tijdlijnRes.data ?? []
  const docIds     = documenten.map((d: Record<string, unknown>) => d.id as string)

  const OWNER_EMAILS = ['o.amatiskak@icloud.com', 'orlandoamatiskak@icloud.com']
  const counterpartyEmails = [dossier.wederpartij_email, dossier.advocaat_email].filter(Boolean) as string[]
  const wederpartijName = (dossier.wederpartij as string | null)?.trim() ?? null

  type MailRow = {
    id: string
    subject: string | null
    from_email: string | null
    to_emails: string[] | null
    body_text: string | null
    ai_summary: string | null
    received_at: string | null
  }
  let mails: MailRow[] = []
  if (counterpartyEmails.length > 0 || wederpartijName) {
    const filters: string[] = []
    for (const e of counterpartyEmails) {
      filters.push(`from_email.eq.${e}`)
      filters.push(`to_emails.cs.{${e}}`)
    }
    if (wederpartijName && wederpartijName.length >= 3) {
      filters.push(`subject.ilike.%${wederpartijName}%`)
    }
    const { data } = await supabase
      .from('mail_messages')
      .select('id, subject, from_email, to_emails, body_text, ai_summary, received_at')
      .or(filters.join(','))
      .order('received_at', { ascending: false })
      .limit(30)
    mails = (data as MailRow[] | null) ?? []
  }

  const userNotes = memory.filter((m: any) => (m.tags ?? []).includes('user_input') || (m.tags ?? []).includes('chat_note'))
  const autoNotes = memory.filter((m: any) => !((m.tags ?? []).includes('user_input') || (m.tags ?? []).includes('chat_note')))

  const userNotesBlok = userNotes.length > 0
    ? `\nDIRECTE BRIEFING VAN DE CLIËNT (${userNotes.length} items — hoge betrouwbaarheid, deze info komt rechtstreeks van Orlando en staat NIET in de documenten):\n` +
      userNotes.map(m => `[${m.type.toUpperCase()}] ${m.subject}\n  ${(m.content as string).slice(0, 800)}`).join('\n\n')
    : ''

  const autoMemoryBlok = autoNotes.length > 0
    ? `\nEERDER GEëXTRAHEERD GEHEUGEN (${autoNotes.length} items — automatisch uit eerdere analyses, kritisch te lezen):\n` +
      autoNotes.map(m => `[${m.type.toUpperCase()}] ${m.subject}: ${(m.content as string).slice(0, 200)}`).join('\n')
    : ''

  const memoryBlok = userNotesBlok + autoMemoryBlok

  const mailBlok = mails.length > 0
    ? `\nE-MAILVERKEER (${mails.length} berichten — eigen accounts: ${OWNER_EMAILS.join(', ')}):\n` +
      mails.map(m => {
        const richting = m.from_email && OWNER_EMAILS.includes(m.from_email.toLowerCase()) ? 'UITGAAND' : 'INKOMEND'
        const dt = m.received_at ? m.received_at.slice(0, 10) : 'onbekend'
        const body = (m.ai_summary?.trim() || m.body_text?.trim() || '').replace(/\s+/g, ' ').slice(0, 600)
        return `[${dt}] [${richting}] van ${m.from_email ?? '?'} → ${(m.to_emails ?? []).join(', ')}\n  Onderwerp: ${m.subject ?? '(geen)'}\n  Inhoud: ${body || '(geen tekst)'}`
      }).join('\n\n')
    : '\nE-MAILVERKEER: 0 berichten gekoppeld aan wederpartij in mail_messages tabel.'

  const contextBlok = `
DOSSIER: ${dossier.title}
Type: ${dossier.dossier_type}
Wederpartij: ${dossier.wederpartij ?? 'Onbekend'} ${dossier.wederpartij_email ? `(${dossier.wederpartij_email})` : ''}
Tegenadvocaat: ${dossier.advocaat_naam ?? 'Onbekend'} ${dossier.advocaat_email ? `(${dossier.advocaat_email})` : ''}
Status: ${dossier.status}
Inzet: ${dossier.inzet_bedrag ? `€${dossier.inzet_bedrag}` : 'Onbekend'}
Volgende deadline: ${dossier.next_deadline ?? 'Geen'}
Zaaknummer: ${dossier.zaaknummer ?? '—'} | Rechtbank: ${dossier.rechtbank ?? '—'}

OPEN RISICO'S (${risicos.length}):
${risicos.map((r: Record<string, unknown>) => `- [${r.severity}] ${r.title}: ${r.description}`).join('\n') || 'Geen'}

DOCUMENTEN (${documenten.length}):
${documenten.map((d: Record<string, unknown>) => {
  const samenvatting = (d.ai_summary as string | null)?.trim()
  const evidence = d.is_evidence ? ' [BEWIJS]' : ''
  return `- ${d.title} (${d.document_type}, ${d.document_date ?? 'datum onbekend'})${evidence}${samenvatting ? `\n    Samenvatting: ${samenvatting.replace(/\s+/g, ' ').slice(0, 500)}` : ''}`
}).join('\n') || 'Geen'}

TIJDLIJN EVENTS (${tijdlijn.length}):
${tijdlijn.slice(-20).map((t: Record<string, unknown>) => `- ${t.event_date}: [${t.source}] ${t.title}`).join('\n') || 'Geen'}
${mailBlok}
${memoryBlok}`

  const systemPrompt = `Je BENT de in-house elite advocaat van de cliënt (Orlando, vastgoedontwikkelaar/ondernemer). 25+ jaar ervaring in faillissementsrecht, ondernemingsrecht, vastgoedrecht, bestuurdersaansprakelijkheid en contractrecht. Je werkt in een interne strategiesessie — niet in een publiekelijke publicatie.

ROL & LEVERING:
- Spreek vanuit "wij" (de verdediging) en "de wederpartij" (tegenpartij).
- Geef je definitieve juridisch oordeel met onderbouwing. De cliënt vraagt JOU als specialist — verwijs hem niet door naar een andere advocaat.
- VERBODEN frasen: "raadpleeg een specialist", "raadpleeg uw advocaat", "deze analyse vervangt geen juridisch advies", "geen rechtsgeldigheid", "DISCLAIMER", "verifieer dit met een professional", "consulteer", "voor specifieke vragen", "let op:", "voorbehoud:". Vermijd elke vorm van CYA-disclaimer.
- Voeg GEEN slotparagraaf met waarschuwingen of disclaimers toe. De analyse eindigt met de slagingskans-inschatting, klaar.
- Citeer specifieke documenten, mails (met datum), tijdlijn-events en geheugen-items waarop je conclusies steunen.

KWALITEIT:
- Onderscheid expliciet: FEIT (uit documenten/mail/tijdlijn) / INTERPRETATIE (jouw juridische duiding) / RISICO (concrete dreiging) / VERMOEDEN (niet onderbouwd, te verifiëren).
- Geef per onderdeel een confidence (0-100%).
- Benoem sterke EN zwakke punten — geen wensdenken.
- Concrete actie-items met deadlines en eigenaar.
- Wees direct, zakelijk, precies. Geen academisch geleuter.
- Als documenten alleen titels zijn (geen inhoud beschikbaar), wijs erop wat ontbreekt voor steviger advies — maar geef WEL het beste advies op basis van wat er IS, zonder de hele analyse te diskrediteren.

ANALYSE TYPE: ${analyse_type}`

  const userPrompt = `Analyseer onderstaand dossier en lever de strategie. Sluit AF na onderdeel 7 — geen disclaimer, geen waarschuwing, geen verwijzing naar een externe advocaat.\n\n${contextBlok}\n\nLever in deze structuur:\n1. Samenvatting situatie (max 6 zinnen, met datums en bedragen)\n2. Top 3 sterkste punten voor verdediging — elk met citaat uit document/mail/tijdlijn\n3. Top 3 kwetsbaarste punten — elk met concreet risicoscenario\n4. Aanbevolen strategie (hoofdroute + 1 alternatief)\n5. Directe actie-items (gesorteerd op urgentie, met deadline en eigenaar)\n6. Juridische basis voor elke stelling (wetsartikelen, jurisprudentie waar relevant)\n7. Schatting slagingskans verdediging (0-100%) met onderbouwing`

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      try {
        const result = streamText({
          model: defaultModel,
          maxOutputTokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const chunk of result.textStream) {
          fullText += chunk
          controller.enqueue(sse('chunk', { text: chunk }))
        }

        const [strategieResult] = await Promise.all([
          supabase.from('advocaat_strategie').insert({
            dossier_id,
            analyse_type,
            aanbevolen_strategie: fullText,
            ai_model: CLAUDE_MODEL,
            bronnen_gebruikt: docIds,
          }).select().single(),
          saveInsightsToMemory(supabase, dossier_id, fullText, analyse_type, docIds),
          supabase.from('advocaat_audit_log').insert({
            dossier_id,
            action: 'strategie_analyse',
            actor: 'ai_systeem',
            description: `AI strategieanalyse (type: ${analyse_type}), geheugen bijgewerkt`,
            metadata: { model: CLAUDE_MODEL, document_count: documenten.length, memory_items: memory.length },
          }),
        ])

        controller.enqueue(sse('done', {
          strategieId: strategieResult.data?.id ?? null,
          analyse: fullText,
        }))
      } catch (err) {
        controller.enqueue(sse('error', { error: (err as Error).message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'connection': 'keep-alive',
    },
  })
}
