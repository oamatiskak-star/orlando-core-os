import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { claude } from '@/lib/ai/client'

export const revalidate = 0
export const maxDuration = 60

// Offer Engine — PROPOSE ONLY.
// 1) Deterministische bron (altijd werkt): propose_offer_candidates() rangschikt
//    eigen aanbod op demand × marge over echte niche-signalen.
// 2) AI verrijkt optioneel titel/omschrijving (propose-only, geen auto-live).
//    Bij ontbrekende provider of AI-fout → deterministisch blijft staan, de exacte
//    reden wordt vastgelegd in offer_engine_runs.fallback_reason (geen credit-aanname).
type Cand = { id: string; niche: string; offer_type: string; est_price_eur: number; demand_signal: number }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const enrich: boolean = body?.enrich !== false // standaard proberen te verrijken

  // deterministische propose (idempotent — bestaande beslissingen blijven)
  const { data: proposedCount, error: rpcErr } = await supabase.rpc('propose_offer_candidates')
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  const proposed = typeof proposedCount === 'number' ? proposedCount : 0

  let status: 'ok' | 'deterministic_fallback' = 'ok'
  let model: string | null = null
  let fallbackReason: string | null = null
  let enriched = 0

  const providerReady = !!(
    process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  )

  // verrijk alleen kandidaten die nog deterministisch zijn (geen handmatige beslissing overschrijven)
  if (enrich && providerReady) {
    const { data: toEnrich } = await supabase
      .from('offer_candidates')
      .select('id,niche,offer_type,est_price_eur,demand_signal')
      .eq('status', 'proposed').eq('source', 'deterministic')
      .order('score', { ascending: false }).limit(12)
    const cands = (toEnrich ?? []) as Cand[]

    if (cands.length > 0) {
      try {
        const list = cands.map((c, i) =>
          `${i}. type=${c.offer_type} niche=${c.niche} prijs=€${c.est_price_eur} demand=${c.demand_signal}`).join('\n')
        const prompt =
`Je bent een offer-strateeg voor een NL finance/vastgoed media-netwerk. Voor elk voorgesteld
aanbod hieronder: schrijf een verkoopbare NL titel (max 9 woorden) en één zin omschrijving die
de koper-waarde benoemt. Antwoord UITSLUITEND met JSON, exact dit schema, geen extra tekst:
{"offers":[{"index":0,"title":"...","description":"..."}]}

Aanbod:
${list}`
        const { text } = await generateText({
          // Goedkoopste model: titel/omschrijving-verrijking is een simpele taak → Haiku.
          model: claude.haiku, maxOutputTokens: 1400,
          messages: [{ role: 'user', content: prompt }],
        })
        const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
        for (const o of json.offers ?? []) {
          const c = cands[o.index]
          if (!c || !o.title) continue
          await supabase.from('offer_candidates').update({
            title: String(o.title).slice(0, 160),
            description: o.description ? String(o.description).slice(0, 400) : null,
            source: 'ai', updated_at: new Date().toISOString(),
          }).eq('id', c.id).eq('status', 'proposed') // nooit een besliste kandidaat aanraken
          enriched++
        }
        model = 'claude-haiku-4-5-20251001'
      } catch (e) {
        status = 'deterministic_fallback'
        fallbackReason = (e instanceof Error ? e.message : String(e)).slice(0, 200)
      }
    }
  } else if (enrich) {
    status = 'deterministic_fallback'
    fallbackReason = 'no_provider_configured'
  }

  await supabase.from('offer_engine_runs').insert({
    status, source: enriched > 0 ? 'ai' : 'deterministic', model, fallback_reason: fallbackReason,
    proposed, enriched, detail: { enrich, provider_ready: providerReady },
  })

  return NextResponse.json({
    status, proposed, enriched, model, fallback_reason: fallbackReason,
    note: status === 'deterministic_fallback'
      ? `Deterministische voorstellen aangemaakt (propose-only). AI-verrijking overgeslagen: ${fallbackReason ?? 'onbekend'}.`
      : `Voorstellen aangemaakt (${proposed} nieuw, ${enriched} AI-verrijkt). Propose-only — mens beslist.`,
  })
}
