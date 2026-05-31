import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Get company context
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .maybeSingle()

    // Get recent system status
    const { data: alerts } = await supabase
      .from('hermes.proactive_alerts')
      .select('alert_type, severity, description')
      .eq('company_id', company_id)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(5)

    // Get current projects/tasks
    const { data: buildStatus } = await supabase
      .from('build_projects')
      .select('name, status')
      .eq('company_id', company_id)
      .order('updated_at', { ascending: false })
      .limit(5)

    const alertsText = alerts && alerts.length > 0
      ? alerts.map(a => `${a.alert_type} (${a.severity})`).join(', ')
      : 'geen'

    const projectsText = buildStatus && buildStatus.length > 0
      ? buildStatus.map(p => `${p.name}`).join(', ')
      : 'geen'

    const systemPrompt = `Je bent Hermes, de AI CEO-assistent van ${company?.name || 'dit bedrijf'}.
Je helpt Orlando met snelle operationele inzichten en strategische advies.

HUIDIGE SITUATIE:
- Alerts: ${alertsText}
- Actieve projecten: ${projectsText}

INSTRUCTIES:
- Antwoord altijd in Nederlands
- Wees kort en actionable (max 2-3 zinnen)
- Geef praktisch advies gebaseerd op context
- Wees proactief - suggereer wat Orlando kan doen
- Geen lange uitleg, gewoon advies`

    const messages = (conversation_history || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    messages.push({ role: 'user' as const, content: message })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 250,
      system: systemPrompt,
      messages,
    })

    const hermesResponse = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'Ik kon geen antwoord genereren.'

    return NextResponse.json({ response: hermesResponse })
  } catch (error) {
    console.error('Error in Hermes chat:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Details:', errorMsg)
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMsg },
      { status: 500 }
    )
  }
}
