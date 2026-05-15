import Anthropic from '@anthropic-ai/sdk'
import { MailMessage, MailContact } from '../lib/supabase'
import { logger } from '../lib/logger'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type DraftResult = {
  subject: string
  body: string
  reasoning: string
  confidence: number
  suggestedAttachments: string[]
}

const SYSTEM_PROMPT = `Je bent de persoonlijke mail assistent van Orlando Amatiskak, een Nederlandse ondernemer.
Orlando werkt zakelijk, direct en professioneel. Zijn toon is formeel maar niet stijf.
Schrijf altijd in het Nederlands, tenzij de afzender duidelijk in een andere taal schrijft.
Je genereert ALLEEN concept-antwoorden. Orlando keurt altijd goed voor verzending.

Bedrijven van Orlando:
- STRKBEHEER: vastgoedbeheer
- STRKBOUW: bouwprojecten
- BOUWPROFFS: bouwplatform SaaS
- YOUTUBE: contentkanalen
- PRIVÉ: persoonlijk

Schrijf beknopt, zakelijk en to-the-point. Geen overbodige beleefdheidsfrases.`

export class ReplyGenerator {
  async generateReply(
    message: MailMessage,
    contact: MailContact | null,
    recentHistory: MailMessage[]
  ): Promise<DraftResult> {
    const historyContext = recentHistory.length > 0
      ? '\n\nRecente mailhistorie met deze afzender:\n' +
        recentHistory
          .slice(0, 5)
          .map(m => `- ${m.received_at ? new Date(m.received_at).toLocaleDateString('nl-NL') : 'onbekend'}: ${m.subject ?? '(geen onderwerp)'} — ${m.ai_summary ?? ''}`)
          .join('\n')
      : ''

    const contactContext = contact
      ? `\n\nAfzender: ${contact.name ?? message.from_email}, type: ${contact.contact_type ?? 'onbekend'}, sentiment: ${contact.sentiment ?? 'neutraal'}`
      : ''

    const userPrompt = `Schrijf een concept-antwoord op deze mail.

Afzender: ${message.from_name ?? message.from_email} <${message.from_email}>
Onderwerp: ${message.subject ?? '(geen onderwerp)'}
Ontvangen: ${message.received_at ? new Date(message.received_at).toLocaleDateString('nl-NL') : 'onbekend'}
Categorie: ${message.category ?? 'onbekend'}
Bedrijf: ${message.company ?? 'onbekend'}
AI samenvatting: ${message.ai_summary ?? 'n.v.t.'}
Actie suggestie: ${message.ai_action_suggestion ?? 'n.v.t.'}

Mailinhoud:
${(message.body_text ?? '').substring(0, 3000)}${contactContext}${historyContext}

Geef exact dit JSON-formaat terug:
{
  "subject": "<onderwerp inclusief Re:>",
  "body": "<volledige antwoord tekst>",
  "reasoning": "<waarom dit antwoord, max 200 tekens>",
  "confidence": <0.0-1.0>,
  "suggestedAttachments": ["<bestand1>", "<bestand2>"]
}`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')

      const parsed = JSON.parse(jsonMatch[0]) as DraftResult
      return parsed
    } catch (err) {
      logger.error('Reply generation failed', { err, messageId: message.id })
      return {
        subject: `Re: ${message.subject ?? ''}`,
        body: '',
        reasoning: 'Generatie mislukt — handmatig invullen',
        confidence: 0,
        suggestedAttachments: [],
      }
    }
  }
}
