import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { deal_id, deal_data, scoring_type } = body

  if (!deal_data && !deal_id) {
    return NextResponse.json({ error: 'deal_id or deal_data required' }, { status: 400 })
  }

  let deal = deal_data
  if (!deal && deal_id) {
    const { data } = await supabase.from('acq_deals').select('*').eq('id', deal_id).single()
    deal = data
  }

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const prompt = scoring_type === 'offmarket'
    ? `Analyseer dit off-market vastgoedobject en geef een AI-score (0-100) en ontwikkelscenario:
Adres: ${deal.address || 'onbekend'}, ${deal.city || ''}, ${deal.province || ''}
Type: ${deal.lead_type || 'onbekend'}
Distress signalen: ${Array.isArray(deal.distress_signals) ? deal.distress_signals.join(', ') : 'geen'}
Dagen leegstand: ${deal.days_vacant || 'onbekend'}

Geef als JSON: { "score": number, "reasoning": string, "dev_scenario": string, "roi_prognose": number, "contact_strategy": string }`
    : `Analyseer deze vastgoeddeal en geef een AI-score (0-100) en risicoscore:
Titel: ${deal.title}
Adres: ${deal.address || 'onbekend'}, ${deal.city || ''}, ${deal.province || ''}
Type: ${deal.object_type || 'onbekend'}
Vraagprijs: €${deal.asking_price || 0}
Geschatte waarde: €${deal.estimated_value || 0}
ROI: ${deal.roi_pct || 0}%
Oppervlak: ${deal.area_m2 || 0} m²
Energielabel: ${deal.energy_label || 'onbekend'}
Bouwjaar: ${deal.build_year || 'onbekend'}

Geef als JSON: { "ai_score": number, "risk_score": number, "reasoning": string }`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'No JSON in response' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])

    if (deal_id && scoring_type !== 'offmarket') {
      await supabase.from('acq_deals').update({
        ai_score: result.ai_score,
        risk_score: result.risk_score,
      }).eq('id', deal_id)

      await supabase.from('acq_deal_scores').insert({
        deal_id,
        score: result.ai_score,
        reasoning: result.reasoning,
        model: 'claude-haiku-4-5',
      })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
