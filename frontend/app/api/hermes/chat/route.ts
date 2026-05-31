import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { company_id, message, conversation_history } = await request.json()

    if (!company_id || !message) {
      return NextResponse.json(
        { error: 'Missing company_id or message' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get company context
    const { data: company } = await supabase
      .from('public.companies')
      .select('name, description')
      .eq('id', company_id)
      .single()

    // Get recent system status
    const { data: alerts } = await supabase
      .from('hermes.proactive_alerts')
      .select('alert_type, severity, description')
      .eq('company_id', company_id)
      .is('resolved_at', null)
      .limit(5)

    // Get current projects/tasks
    const { data: buildStatus } = await supabase
      .from('hermes.build_status')
      .select('project_name, status, progress')
      .eq('company_id', company_id)
      .limit(5)

    const systemPrompt = `Je bent Hermes, de AI CEO-assistent van ${company?.name || 'dit bedrijf'}.
Je doel is om Orlando (de CEO) te helpen met strategische beslissingen, operationele inzichten, en proactieve aanbevelingen.

HUIDIGE CONTEXT:
- Actieve alerts: ${alerts?.length || 0} (${alerts?.map(a => a.alert_type).join(', ') || 'geen'})
- Actieve projecten: ${buildStatus?.length || 0}

Je reacties moeten:
1. Specifiek en actionable zijn (niet generiek)
2. Gegrond zijn in de huidige bedrijfscontext
3. Proactief problemen identificeren (niet alleen reactief antwoorden)
4. Korte, snelle antwoorden geven (geen essays)
5. Nederlands spreken (zoals Orlando)

Wanneer iemand "onthoud" zegt, bevestig dat je het hebt opgeslagen.
Wanneer iemand "status" vraagt, geef een samenvatting van de huidige situatie.
Bij andere vragen: geef praktisch advies gebaseerd op de bedrijfscontext.`

    const messages = [
      ...conversation_history,
      { role: 'user' as const, content: message },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages,
    })

    const hermesResponse = response.content[0].type === 'text' ? response.content[0].text : 'Ik kon geen antwoord genereren.'

    return NextResponse.json({ response: hermesResponse })
  } catch (error) {
    console.error('Error in Hermes chat:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
