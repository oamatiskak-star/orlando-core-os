import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'

export const runtime = 'nodejs'

const CHANNEL_CONTEXT: Record<string, string> = {
  VermogenTv:         'Nederlanders vermogensopbouw, passief inkomen, geld besparen, rijker worden',
  SpaarTv:            'NL spaarrentes vergelijken, ABN/ING/Bunq/Revolut, inflatie, beste spaarrekening',
  VastgoedTv:         'NL vastgoedmarkt 2026, huizenprijzen, verhuur, kopen vs huren, hypotheek',
  CryptoVermogen:     'Bitcoin, Ethereum, crypto NL belasting, altcoins, DCA strategie',
  BeleggingsTv:       'ETF beleggen, VWRL vs IWDA, index funds, beurs, dividend, lange termijn',
  PropertyInvestorTv: 'Dutch property market, buy-to-let Netherlands, rental yields, housing shortage',
  AquierTv:           'Aquier vastgoed platform, Nederlandse makelaars, off-market deals',
  AquierTvEs:         'Mercado inmobiliario Países Bajos, inversión inmobiliaria, plataforma Aquier',
}

type VideoIdea = {
  title:             string
  hook_15s:          string
  thumbnail_concept: string
  viral_trigger:     string
}

export async function POST(req: NextRequest) {
  const { channel_naam } = await req.json()
  if (!channel_naam) return NextResponse.json({ error: 'channel_naam required' }, { status: 400 })

  const context = CHANNEL_CONTEXT[channel_naam]
  if (!context) return NextResponse.json({ error: `Onbekend kanaal: ${channel_naam}` }, { status: 400 })

  const isEnglish = channel_naam === 'PropertyInvestorTv' || channel_naam === 'AquierTvEs'
  const lang = isEnglish ? 'English' : 'Nederlands'

  const prompt = `Je bent een elite YouTube content strateeg voor het kanaal "${channel_naam}".
Kanaal focus: ${context}
Taal van de videos: ${lang}

Genereer 5 video-ideeën die nu viral kunnen gaan. Gebruik actuele externe triggers: ECB rentebesluiten, Nederlandse woningmarkt Q1 2026, inflatie NL maart 2026, ABN/ING rente aanpassingen, Bitcoin koers bewegingen, belastingwijzigingen 2026.

Regels voor elk idee:
- Titel: bevat een concreet getal/bedrag, max 70 tekens, persoonlijk ("jij/je/jouw") of directe uitdaging
- Hook: eerste 15 seconden script — begin met een shock stat of persoonlijk scenario, GEEN kanaalintro
- Thumbnail: beschrijf 3 elementen max — grote tekst + expressie + achtergrond kleur
- Viral trigger: 1 zin waarom dit NU trending is

Geef ALLEEN geldige JSON terug als array van 5 objecten, geen uitleg, geen markdown:

[
  {
    "title": "...",
    "hook_15s": "...",
    "thumbnail_concept": "...",
    "viral_trigger": "..."
  }
]`

  try {
    const { text } = await generateText({
      model:           claude.sonnet,
      maxOutputTokens: 1500,
      messages:        [{ role: 'user', content: prompt }],
    })

    const raw = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const ideas: VideoIdea[] = JSON.parse(raw)

    const admin = createAdminClient()

    // Sla op in youtube_channels.research_ideas
    const { data: ch } = await admin
      .from('youtube_channels')
      .select('id')
      .ilike('naam', channel_naam)
      .maybeSingle()

    if (ch?.id) {
      await admin.from('youtube_channels').update({
        research_ideas: { ideas, generated_at: new Date().toISOString() },
        updated_at:     new Date().toISOString(),
      }).eq('id', ch.id)
    }

    return NextResponse.json({ ok: true, channel_naam, ideas })
  } catch (err) {
    console.error('[research] fout:', err)
    return NextResponse.json({ error: 'Research kon niet worden gegenereerd' }, { status: 500 })
  }
}

// GET — haal opgeslagen ideeën op per kanaal
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channel_naam = searchParams.get('channel_naam')
  if (!channel_naam) return NextResponse.json({ error: 'channel_naam required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ch } = await admin
    .from('youtube_channels')
    .select('id, naam, research_ideas')
    .ilike('naam', channel_naam)
    .maybeSingle()

  if (!ch) return NextResponse.json({ error: 'Kanaal niet gevonden' }, { status: 404 })

  return NextResponse.json({
    channel_naam: ch.naam,
    ideas:        ch.research_ideas?.ideas ?? [],
    generated_at: ch.research_ideas?.generated_at ?? null,
  })
}
