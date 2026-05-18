import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { defaultModel } from '@/lib/ai/client'

export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !deal) {
    return NextResponse.json({ error: 'Deal niet gevonden' }, { status: 404 })
  }

  const askingPrice = deal.asking_price ?? 0
  const sqm = deal.sqm ?? 100
  const roi = deal.roi_percentage ?? 0
  const profit = deal.potential_profit ?? 0
  const energyLabel = deal.energy_label ?? 'onbekend'
  const ppm = deal.price_per_sqm ?? (sqm > 0 ? Math.round(askingPrice / sqm) : 0)

  const prompt = `Je bent een senior vastgoedanalist in Nederland. Analyseer deze deal en genereer een volledig professioneel investeringsrapport.

DEAL DATA:
- Adres: ${deal.address ?? 'Onbekend'}, ${deal.city ?? ''} ${deal.province ? `(${deal.province})` : ''}
- Vraagprijs: €${askingPrice.toLocaleString('nl-NL')}
- Oppervlak: ${sqm}m²
- Prijs per m²: €${ppm.toLocaleString('nl-NL')}
- Energielabel: ${energyLabel}
- Potentieel winst (geschat): €${profit.toLocaleString('nl-NL')}
- ROI (geschat): ${roi}%
- Deal klasse: ${deal.class ?? 'B'}
- Bron: ${deal.source ?? 'onbekend'}
- Notities: ${deal.notes ?? 'geen'}

Geef ALLEEN geldige JSON terug, geen uitleg, geen markdown code fences:

{
  "dealType": "één van: TRANSFORMATIE / RENOVATIE / SPLITSING / OPTOPPEN / BUY-TO-LET / UITPONDING / NIEUWBOUW",
  "executiveSummary": "2-3 zinnen professionele samenvatting voor institutionele investeerder",
  "whyInteresting": "2-3 zinnen waarom deze deal aantrekkelijk is",
  "totalInvestment": <number: schatting totale investering inclusief alle kosten>,
  "endValue": <number: verwachte eindwaarde na ontwikkeling>,
  "netProfit": <number: netto winst na aftrek alle kosten>,
  "roiPercentage": <number>,
  "timeline": "<x>-<y> maanden",
  "exitStrategy": "exitstrategie in 1 zin",
  "riskScore": "Laag / Gemiddeld / Hoog / Zeer hoog",
  "riskScoreNumeric": <number 1-10>,
  "developmentPlan": {
    "recommendedStrategy": "aanbevolen strategie in 1 zin",
    "steps": ["stap 1", "stap 2", "stap 3", "stap 4", "stap 5"],
    "reasoning": "onderbouwing van strategie in 2-3 zinnen",
    "keyDataPoints": ["feit 1 met getal", "feit 2 met getal", "feit 3 met getal", "feit 4 met getal"]
  },
  "financialAnalysis": {
    "costs": [
      { "label": "Aankoopprijs", "amount": <number> },
      { "label": "Kosten koper (4%)", "amount": <number> },
      { "label": "Bouwkosten & renovatie", "amount": <number> },
      { "label": "Architect & constructeur", "amount": <number> },
      { "label": "Installaties (E+W)", "amount": <number> },
      { "label": "Leges & vergunningen", "amount": <number> },
      { "label": "Financieringskosten (rente)", "amount": <number> },
      { "label": "Verkoopkosten & makelaar", "amount": <number> },
      { "label": "Onvoorzien (10%)", "amount": <number> }
    ],
    "revenues": [
      { "label": "Verwachte verkoopwaarde", "amount": <number> },
      { "label": "Geschatte huurwaarde (jaar)", "amount": <number> },
      { "label": "Herfinanciering na verhuur", "amount": <number> }
    ],
    "kpis": {
      "roi": <number>,
      "roe": <number>,
      "irr": <number>,
      "netProfit": <number>,
      "breakEvenMonths": <number>,
      "profitPerSqm": <number>,
      "riskIndex": <number 1-10>
    }
  },
  "riskAnalysis": [
    {
      "category": "Juridisch",
      "items": [
        { "name": "Vergunningsrisico", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Bestemmingsplan", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "VvE / erfpacht", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" }
      ]
    },
    {
      "category": "Bouwkundig",
      "items": [
        { "name": "Funderingsrisico", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Asbestkans", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Installatierisico", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" }
      ]
    },
    {
      "category": "Financieel",
      "items": [
        { "name": "Margeveiligheid", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Rentegevoeligheid", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Kostenescalatie", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" }
      ]
    },
    {
      "category": "Markt",
      "items": [
        { "name": "Verkoopbaarheid", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Concurrentiedruk", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" },
        { "name": "Markttiming", "level": "Laag/Gemiddeld/Hoog", "description": "toelichting" }
      ]
    }
  ],
  "aiConclusion": "Definitief investeringsadvies in 2-3 zinnen. Benoem de grootste kans én het grootste risico. Eindig met een concrete aanbeveling (ga door / ga door onder voorwaarden / pas op)."
}`

  try {
    const { text } = await generateText({
      model: defaultModel,
      maxOutputTokens: 3500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = text.trim()
    const jsonText = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const report = JSON.parse(jsonText)
    return NextResponse.json({ deal, report })
  } catch (err) {
    console.error('Rapport generatie fout:', err)
    return NextResponse.json({ error: 'Rapport kon niet worden gegenereerd' }, { status: 500 })
  }
}
