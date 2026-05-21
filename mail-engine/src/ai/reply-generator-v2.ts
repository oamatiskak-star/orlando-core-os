import Anthropic from '@anthropic-ai/sdk'

interface MailContext {
  from_email: string
  subject: string
  body: string
  company?: string | null
  category?: string | null
  priority?: string
  contact_sentiment?: string
  prior_interactions?: number
}

interface ReplyGeneratorResult {
  subject: string
  body: string
  reasoning: string
  confidence: number
  suggestedTemplateId?: string
  suggestedTemplate?: {
    name: string
    category: string
    placeholders?: Record<string, string>
  }
}

const client = new Anthropic()

export async function generateReplyV2(
  context: MailContext,
  availableTemplates?: any[]
): Promise<ReplyGeneratorResult> {
  const templatesInfo = availableTemplates
    ? `
Available templates to potentially use:
${availableTemplates.map(t => `
- Template: "${t.name}" (${t.category})
  Category: ${t.category}
  Placeholders needed: ${Object.keys(t.placeholder_hints || {}).join(', ')}
`).join('\n')}
`
    : ''

  const systemPrompt = `You are Orlando Amatiskak's email assistant, helping generate professional Dutch business email responses.

Context about Orlando's businesses:
- STRKBEHEER BV: Property management and real estate deals
- STRKBOUW BV: Construction company (100% subsidiary of STRKBEHEER)
- Bouwproffs BV: SaaS platform

Your task is to generate professional, context-aware email responses in Dutch.

${templatesInfo}

Instructions:
1. Analyze the incoming email context
2. Determine the appropriate response tone (formal for legal/financial, friendly for suppliers)
3. If a template fits the situation, suggest it and provide placeholder values
4. If no template fits perfectly, write an original response that follows similar patterns
5. Keep responses concise (3-4 paragraphs max)
6. Always maintain professional tone unless the contact has been friendly
7. Include appropriate greeting and closing
8. Sign responses as "Orlando Amatiskak" with relevant company

Output format (JSON):
{
  "subject": "Email subject",
  "body": "Email body text",
  "reasoning": "Why this response is appropriate (max 200 chars)",
  "confidence": 0.0-1.0 (how sure you are this is the right response),
  "suggestedTemplate": {
    "name": "Template name if one fits",
    "category": "Template category",
    "placeholders": {"{{placeholder}}": "suggested value"}
  }
}`

  const userPrompt = `Generate a response to this incoming email:

From: ${context.from_email}
Subject: ${context.subject}
Company/Contact: ${context.company || 'Unknown'}
Category: ${context.category || 'general'}
Priority: ${context.priority || 'normal'}
Contact sentiment: ${context.contact_sentiment || 'neutral'}
Prior interactions: ${context.prior_interactions || 0}

Email body:
${context.body}

Generate an appropriate response in Dutch. If a template applies, suggest it with filled-in placeholders.`

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Try to parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        subject: 'Re: ' + context.subject,
        body: content.text,
        reasoning: 'Generated response without template',
        confidence: 0.4,
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      subject: parsed.subject || 'Re: ' + context.subject,
      body: parsed.body || content.text,
      reasoning: parsed.reasoning || 'Generated response',
      confidence: Math.max(0.3, parsed.confidence || 0.5),
      suggestedTemplate: parsed.suggestedTemplate,
    }
  } catch (error) {
    console.error('Error generating reply:', error)
    // Fallback response
    return {
      subject: 'Re: ' + context.subject,
      body: `Beste ${context.from_email.split('@')[0]},

Dank voor uw e-mail. Wij zullen deze nader bekijken en spoedig reageren.

Met vriendelijke groet,
Orlando Amatiskak`,
      reasoning: 'Fallback generic response',
      confidence: 0.2,
    }
  }
}

/**
 * Fill template with actual values
 */
export function fillTemplate(
  template: any,
  placeholders: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject_template
  let body = template.body_template

  // Replace all placeholders
  for (const [placeholder, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\${placeholder}`, 'g')
    subject = subject.replace(regex, String(value))
    body = body.replace(regex, String(value))
  }

  return { subject, body }
}

/**
 * Extract placeholder values from context
 */
export function extractPlaceholdersFromContext(
  context: MailContext,
  placeholderKeys: string[]
): Record<string, string> {
  const placeholders: Record<string, string> = {}

  for (const key of placeholderKeys) {
    switch (key) {
      case '{{contact_name}}':
        placeholders[key] = context.from_email.split('@')[0] || 'There'
        break
      case '{{original_subject}}':
        placeholders[key] = context.subject
        break
      case '{{company_name}}':
        placeholders[key] = context.company || 'Your company'
        break
      case '{{response_timeline}}':
        placeholders[key] = 'within 24 hours'
        break
      case '{{format}}':
        placeholders[key] = 'PDF'
        break
      case '{{mail_date}}':
        placeholders[key] = new Date().toLocaleDateString('nl-NL')
        break
      case '{{legal_timeline}}':
        placeholders[key] = 'within 5 working days'
        break
      case '{{review_timeline}}':
        placeholders[key] = 'within 3 working days'
        break
      case '{{offer_date}}':
        placeholders[key] = new Date().toLocaleDateString('nl-NL')
        break
      // Add more as needed
      default:
        placeholders[key] = '[TO BE FILLED]'
    }
  }

  return placeholders
}
