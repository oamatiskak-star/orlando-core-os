import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { defaultModel, claude } from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

const SYSTEM = `Je bent Orlando AI — de persoonlijke AI-assistent van Orlando, een Nederlandse vastgoedontwikkelaar, aannemer en SaaS-builder.

Bedrijven: STRKBEHEER BV, STRKBOUW BV, BOUWPROFFS BV, MODIWERIJO FINANCIAL MANAGEMENT BV

Werkgebied: vastgoed, bouw, calculaties (STABU), SaaS-platformen, AI-automatisering, financiële verwerking, YouTube-netwerk.

Communicatiestijl: direct, technisch, zakelijk, exact. Geen fluff. Schrijf in het Nederlands tenzij anders gevraagd.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { messages, model: modelKey } = body

  if (!messages?.length) return new Response('messages vereist', { status: 400 })

  const model = modelKey === 'opus'   ? claude.opus
              : modelKey === 'haiku'  ? claude.haiku
              : defaultModel

  const result = streamText({
    model,
    system: SYSTEM,
    messages,
    maxOutputTokens: 4096,
  })

  return result.toTextStreamResponse()
}
