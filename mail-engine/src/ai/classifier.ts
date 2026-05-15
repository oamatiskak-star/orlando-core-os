import Anthropic from '@anthropic-ai/sdk'
import { MailContact } from '../lib/supabase'
import { logger } from '../lib/logger'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type ClassificationResult = {
  category: string
  priority: string
  company: string
  summary: string
  actionSuggestion: string
  confidence: number
  isInvoice: boolean
  isLegalNotice: boolean
  hasAgendaRequest: boolean
  proposedDateTime?: string
  proposedDuration?: number
}

const SYSTEM_PROMPT = `Je bent een mail operations specialist voor Orlando, een Nederlandse ondernemer actief in:
- STRKBEHEER: vastgoedbeheer en verhuur
- STRKBOUW: bouwprojecten en aanneming
- BOUWPROFFS: bouwplatform en SaaS
- YOUTUBE: AI-gedreven YouTube kanalen (VermogenTv, SpaarTv, VastgoedTv, CryptoVermogen, BeleggingsTv)
- PRIVÉ: persoonlijke zaken

Classificeer elke mail nauwkeurig. Geef altijd geldig JSON terug.

Categorieën: leverancier | klant | incasso | factuur | belasting | advocaat | privé | vastgoed | support | automatisering | spam
Prioriteit: urgent | high | normal | low | spam
Bedrijf: STRKBEHEER | STRKBOUW | BOUWPROFFS | YOUTUBE | PRIVÉ`

export class AiClassifier {
  async classify(
    subject: string,
    from: string,
    body: string,
    existingContact?: MailContact | null
  ): Promise<ClassificationResult> {
    const contactContext = existingContact
      ? `\n\nBekende afzender: ${existingContact.name ?? from}, type: ${existingContact.contact_type ?? 'onbekend'}, sentiment: ${existingContact.sentiment ?? 'onbekend'}, openstaande acties: ${existingContact.open_actions}`
      : ''

    const userPrompt = `Analyseer deze mail en geef een JSON-object terug:

Van: ${from}
Onderwerp: ${subject}
Inhoud (eerste 2000 tekens):
${body.substring(0, 2000)}${contactContext}

Geef exact dit JSON-formaat terug:
{
  "category": "<categorie>",
  "priority": "<prioriteit>",
  "company": "<bedrijf>",
  "summary": "<samenvatting max 100 tekens>",
  "actionSuggestion": "<concrete actie max 150 tekens>",
  "confidence": <0.0-1.0>,
  "isInvoice": <true|false>,
  "isLegalNotice": <true|false>,
  "hasAgendaRequest": <true|false>,
  "proposedDateTime": "<ISO8601 of null>",
  "proposedDuration": <minuten of null>
}`

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')

      const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult
      return parsed
    } catch (err) {
      logger.error('Classification failed', { err, subject, from })
      return {
        category: 'support',
        priority: 'normal',
        company: 'PRIVÉ',
        summary: subject.substring(0, 100),
        actionSuggestion: 'Handmatig controleren',
        confidence: 0,
        isInvoice: false,
        isLegalNotice: false,
        hasAgendaRequest: false,
      }
    }
  }
}
