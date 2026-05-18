import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { defaultModel } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>
type Params = { params: Promise<{ id: string }> }

type ExpertRole = {
  id: string
  label: string
  short: string
  system: string
}

const ROLES: Record<string, ExpertRole> = {
  curator: {
    id: 'curator',
    label: 'Curator-advocaat (faillissementsrecht)',
    short: 'Curator',
    system: `Je BENT de gespecialiseerde faillissementsadvocaat van de cliënt (Orlando). 30+ jaar Nederlandse faillissementspraktijk, Pauliana-procedures, bestuurdersaansprakelijkheid, schuldeisersbelangen.
Analyseer vanuit verdediging tegen een curator. Focus op:
- Pauliana-risico's (art. 42-47 Fw): welke transacties zijn aanvechtbaar?
- Bestuurdersaansprakelijkheid (art. 2:138/2:248 BW): mogelijke verwijten en weerlegging
- Boedelpositie: wat raakt de boedel, wat blijft eigen vermogen
- Verifieer-vraagstukken bij schuldeisersvergadering
- Concrete verweren, jurisprudentie waar relevant, deadlines`,
  },
  fiscalist: {
    id: 'fiscalist',
    label: 'Fiscalist',
    short: 'Fiscalist',
    system: `Je BENT de in-house fiscalist van de cliënt (Orlando). Specialisme: Nederlandse vennootschapsbelasting, BTW, IB-ondernemers, vastgoed-fiscaliteit, DGA-positie.
Analyseer dossier op:
- Fiscale risico's en mogelijke naheffingen
- BTW-implicaties (vooraftrek, herziening, overdrachten)
- Vpb / IB gevolgen van transacties
- Fiscale planning-opties die nog mogelijk zijn
- Belastingdienst-risico's en termijnen (bezwaar, beroep, ambtshalve)`,
  },
  vastgoedjurist: {
    id: 'vastgoedjurist',
    label: 'Vastgoedjurist',
    short: 'Vastgoedjurist',
    system: `Je BENT de in-house vastgoedjurist van Orlando (ondernemer in vastgoedontwikkeling/bouw).
Analyseer vanuit huur-, koop-, eigendoms-, bestuurs- en omgevingsrecht. Focus op:
- Eigendomspositie / hypotheek / pandrechten
- Huur- en koopovereenkomsten en mogelijke ontbinding/wanprestatie
- Omgevingsvergunning, bestemmingsplan, gemeentelijk beleid
- Erfpacht, opstal, mandeligheid, kettingbedingen
- Bouwrecht: UAV, oplevering, verborgen gebreken, NEN`,
  },
  bestuurdersaansprakelijkheid: {
    id: 'bestuurdersaansprakelijkheid',
    label: 'Bestuurdersaansprakelijkheid specialist',
    short: 'Bestuurder',
    system: `Je BENT de bestuurdersaansprakelijkheidsadvocaat van Orlando. Specialisme: art. 2:9, 2:138, 2:248 BW, deponeringsplicht, kennelijk onbehoorlijk bestuur, verzaak boekhoudplicht.
Analyseer:
- Persoonlijke aansprakelijkheidsrisico's voor Orlando als bestuurder
- Verwijten van kennelijk onbehoorlijk bestuur en hun feitelijke basis
- Status deponering jaarrekeningen, gevolgen art. 2:248 lid 2 BW
- Vrijwaring en disculpatie-argumenten
- Persoonlijke vermogenspositie afschermen`,
  },
  contractenrecht: {
    id: 'contractenrecht',
    label: 'Contractenrecht specialist',
    short: 'Contracten',
    system: `Je BENT de contractenrecht specialist. Focus op de contractuele verhoudingen in dit dossier.
Analyseer:
- Aanwezige overeenkomsten en hun rechtsgeldigheid
- Wanprestatie, opzegging, ontbinding, schadevergoeding
- Algemene voorwaarden van toepassing? Vernietigbaar? art. 6:233 BW?
- Termijnen (verjaring, klachtplicht art. 6:89 BW, redelijke termijn)
- Bewijspositie: welk document staaft welk standpunt?`,
  },
}

const COMMON_BRIEF = `KERNREGELS (geldt voor alle rollen):
- Je spreekt vanuit "wij" (verdediging) en "de wederpartij" / "de curator" etc.
- VERBODEN frasen: "raadpleeg een specialist", "raadpleeg uw advocaat", "deze analyse vervangt geen juridisch advies", "DISCLAIMER", "geen rechtsgeldigheid". Geen slotdisclaimer.
- Onderscheid expliciet: FEIT (uit documenten/mail/briefing) / INTERPRETATIE / RISICO / VERMOEDEN.
- Citeer specifieke documenten, mails, tijdlijn-events, briefing-items waar je conclusies op steunen.
- Geef confidence (0-100%) per onderdeel.
- Wees direct, zakelijk, precies. Geen academisch geleuter.`

async function loadDossierContext(supabase: SupabaseServer, dossier_id: string) {
  const [dossierRes, risicoRes, documentRes, tijdlijnRes, memoryRes] = await Promise.all([
    supabase.from('advocaat_dossiers').select('*').eq('id', dossier_id).single(),
    supabase.from('advocaat_risicos').select('*').eq('dossier_id', dossier_id).eq('is_resolved', false),
    supabase.from('advocaat_documenten').select('id, title, document_type, document_date, ai_summary, classification').eq('dossier_id', dossier_id).limit(50),
    supabase.from('advocaat_tijdlijn').select('*').eq('dossier_id', dossier_id).order('event_date').limit(100),
    supabase.from('advocaat_geheugen').select('type, subject, content, tags').eq('dossier_id', dossier_id).eq('is_active', true).order('last_used_at', { ascending: false }).limit(50),
  ])
  return {
    dossier: dossierRes.data,
    error: dossierRes.error?.message,
    risicos: risicoRes.data ?? [],
    documenten: documentRes.data ?? [],
    tijdlijn: tijdlijnRes.data ?? [],
    memory: memoryRes.data ?? [],
  }
}

function buildContextBlock(ctx: Awaited<ReturnType<typeof loadDossierContext>>): string {
  const { dossier, risicos, documenten, tijdlijn, memory } = ctx
  if (!dossier) return ''

  const userNotes = memory.filter((m: any) => (m.tags ?? []).includes('user_input') || (m.tags ?? []).includes('chat_note'))
  const autoNotes = memory.filter((m: any) => !((m.tags ?? []).includes('user_input') || (m.tags ?? []).includes('chat_note')))

  return `
DOSSIER: ${dossier.title}
Type: ${dossier.dossier_type}
Wederpartij: ${dossier.wederpartij ?? 'Onbekend'} ${dossier.wederpartij_email ? `(${dossier.wederpartij_email})` : ''}
Status: ${dossier.status} | Inzet: ${dossier.inzet_bedrag ? `€${dossier.inzet_bedrag}` : 'Onbekend'}
Zaaknummer: ${dossier.zaaknummer ?? '—'} | Rechtbank: ${dossier.rechtbank ?? '—'}
Volgende deadline: ${dossier.next_deadline ?? 'Geen'}

OPEN RISICO'S (${risicos.length}):
${risicos.map((r: any) => `- [${r.severity}] ${r.title}: ${r.description}`).join('\n') || 'Geen'}

DOCUMENTEN (${documenten.length}):
${documenten.map((d: any) => `- ${d.title} (${d.document_type}, ${d.document_date ?? '?'})${d.ai_summary ? `\n  Samenvatting: ${(d.ai_summary as string).replace(/\s+/g, ' ').slice(0, 400)}` : ''}`).join('\n') || 'Geen'}

TIJDLIJN (${tijdlijn.length}, laatste 20):
${tijdlijn.slice(-20).map((t: any) => `- ${t.event_date}: [${t.source}] ${t.title}`).join('\n') || 'Geen'}

${userNotes.length > 0 ? `DIRECTE BRIEFING VAN ORLANDO (hoge betrouwbaarheid — info die NIET in documenten staat):
${userNotes.map((m: any) => `[${m.type.toUpperCase()}] ${m.subject}\n  ${(m.content as string).slice(0, 600)}`).join('\n\n')}` : ''}

${autoNotes.length > 0 ? `EERDER GEëXTRAHEERD GEHEUGEN (${autoNotes.length} items):
${autoNotes.map((m: any) => `[${m.type.toUpperCase()}] ${m.subject}: ${(m.content as string).slice(0, 200)}`).join('\n')}` : ''}
`.trim()
}

function sse(event: string, data: any): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET() {
  return new Response(JSON.stringify({
    roles: Object.values(ROLES).map(r => ({ id: r.id, label: r.label, short: r.short })),
  }), { headers: { 'content-type': 'application/json' } })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: dossierId } = await params
  const { roles, question } = await req.json() as { roles?: string[]; question?: string }

  const selected = (roles ?? Object.keys(ROLES)).filter(id => ROLES[id])
  if (selected.length === 0) {
    return new Response(JSON.stringify({ error: 'geen geldige rollen geselecteerd' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = await createClient()
  const ctx = await loadDossierContext(supabase, dossierId)
  if (ctx.error || !ctx.dossier) {
    return new Response(JSON.stringify({ error: ctx.error ?? 'dossier niet gevonden' }), {
      status: 404, headers: { 'content-type': 'application/json' },
    })
  }

  const contextBlock = buildContextBlock(ctx)
  const userQuestion = (question && question.trim()) ||
    'Geef je vakgebied-specifieke analyse van dit dossier: positie, risico\'s, sterke punten, aanbevolen acties, en slagingskans (0-100%).'

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse('start', {
        roles: selected.map(id => ({ id, label: ROLES[id].label, short: ROLES[id].short })),
        question: userQuestion,
      }))

      const fullTexts: Record<string, string> = {}
      selected.forEach(id => { fullTexts[id] = '' })

      async function runRole(roleId: string): Promise<void> {
        const role = ROLES[roleId]
        const sys = `${role.system}\n\n${COMMON_BRIEF}\n\nROL: ${role.label}`
        try {
          const result = streamText({
            model: defaultModel,
            maxOutputTokens: 2500,
            system: sys,
            messages: [{
              role: 'user',
              content: `Onderstaand dossier-overzicht.\n\n${contextBlock}\n\nVraag van Orlando: ${userQuestion}\n\nGeef je analyse vanuit jouw vakgebied. Geen disclaimer. Sluit af met confidence-score.`,
            }],
          })
          for await (const chunk of result.textStream) {
            fullTexts[roleId] += chunk
            controller.enqueue(sse('chunk', { role: roleId, text: chunk }))
          }
          controller.enqueue(sse('role-done', { role: roleId, length: fullTexts[roleId].length }))
        } catch (err) {
          controller.enqueue(sse('role-error', { role: roleId, error: (err as Error).message }))
        }
      }

      try {
        await Promise.all(selected.map(runRole))
        await supabase.from('advocaat_audit_log').insert({
          dossier_id: dossierId,
          action: 'expert_panel_run',
          actor: 'ai_systeem',
          description: `Expert panel: ${selected.join(', ')}`,
          metadata: { question: userQuestion, models: { ...Object.fromEntries(selected.map(id => [id, CLAUDE_MODEL])) } },
        })
        await supabase.from('advocaat_strategie').insert({
          dossier_id: dossierId,
          analyse_type: `expert_panel_${selected.join('_')}`,
          aanbevolen_strategie: Object.entries(fullTexts).map(([id, text]) => `## ${ROLES[id].label}\n\n${text}`).join('\n\n---\n\n'),
          ai_model: CLAUDE_MODEL,
          bronnen_gebruikt: ctx.documenten.map((d: any) => d.id),
        })
        controller.enqueue(sse('done', {
          totals: Object.fromEntries(Object.entries(fullTexts).map(([id, t]) => [id, t.length])),
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
