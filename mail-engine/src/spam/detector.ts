import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type ParsedAttachment = {
  filename: string
  mimeType: string
  size: number
}

export type SpamResult = {
  score: number
  isThreat: boolean
  threatType: string | null
  reason: string | null
}

const PHISHING_DOMAINS = [
  'mailtrack.io',
  'sendgrid-mail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getairmail.com',
  'sharklasers.com',
]

const URGENCY_KEYWORDS = [
  'dringend betalen',
  'laatste waarschuwing',
  'uw rekening is geblokkeerd',
  'bevestig uw gegevens',
  'klik hier onmiddellijk',
  'dreiging',
  'gerechtelijk',
  'deurwaarder',
  'incassobureau',
  'beslag',
]

const FRAUD_PATTERNS = [
  /IBAN[:\s]+NL\d{2}[A-Z]{4}\d{10}/i,
  /betaal\s+binnen\s+\d+\s+uur/i,
  /€\s*\d{4,}/i,
]

export class SpamDetector {
  async analyze(
    from: string,
    subject: string,
    body: string,
    attachments: ParsedAttachment[]
  ): Promise<SpamResult> {
    let score = 0
    const reasons: string[] = []

    const domain = from.split('@')[1]?.toLowerCase() ?? ''
    if (PHISHING_DOMAINS.some(d => domain.includes(d))) {
      score += 0.6
      reasons.push(`Verdacht domein: ${domain}`)
    }

    const fullText = `${subject} ${body}`.toLowerCase()
    const urgencyMatches = URGENCY_KEYWORDS.filter(kw => fullText.includes(kw))
    if (urgencyMatches.length > 0) {
      score += Math.min(0.3, urgencyMatches.length * 0.1)
      reasons.push(`Urgentiesleutelwoorden: ${urgencyMatches.join(', ')}`)
    }

    for (const pattern of FRAUD_PATTERNS) {
      if (pattern.test(body)) {
        score += 0.2
        reasons.push('Verdacht betalingspatroon gedetecteerd')
        break
      }
    }

    if (attachments.length > 3) {
      score += 0.1
      reasons.push(`Ongebruikelijk aantal bijlagen: ${attachments.length}`)
    }

    const suspiciousExts = attachments.filter(a =>
      a.filename.match(/\.(exe|zip|rar|js|vbs|bat|cmd|scr|pif)$/i)
    )
    if (suspiciousExts.length > 0) {
      score += 0.4
      reasons.push(`Verdachte bijlagen: ${suspiciousExts.map(a => a.filename).join(', ')}`)
    }

    const { data: duplicates } = await supabase
      .from('mail_messages')
      .select('id')
      .eq('subject', subject)
      .eq('from_email', from)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(3)

    if ((duplicates?.length ?? 0) >= 2) {
      score += 0.25
      reasons.push('Dubbele factuur/bericht gedetecteerd')
    }

    if (score < 0.4) {
      const aiResult = await this.aiAnalyze(from, subject, body)
      score = Math.min(1, score + aiResult.score * 0.3)
      if (aiResult.reason) reasons.push(aiResult.reason)
    }

    const finalScore = Math.min(1, score)
    const isThreat = finalScore >= 0.5
    const threatType = isThreat ? this.determineThreatType(reasons) : null

    return {
      score: finalScore,
      isThreat,
      threatType,
      reason: reasons.length > 0 ? reasons.join('; ') : null,
    }
  }

  private async aiAnalyze(
    from: string,
    subject: string,
    body: string
  ): Promise<{ score: number; reason: string | null }> {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Analyseer deze mail op spam/phishing/fraude voor een Nederlandse ondernemer.

Van: ${from}
Onderwerp: ${subject}
Inhoud: ${body.substring(0, 1000)}

Geef JSON: {"score": <0.0-1.0>, "reason": "<reden of null>"}`,
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return { score: 0, reason: null }

      const parsed = JSON.parse(jsonMatch[0]) as { score: number; reason: string | null }
      return parsed
    } catch (err) {
      logger.error('AI spam analysis failed', { err })
      return { score: 0, reason: null }
    }
  }

  private determineThreatType(reasons: string[]): string {
    const joined = reasons.join(' ').toLowerCase()
    if (joined.includes('domein') || joined.includes('bijlagen')) return 'phishing'
    if (joined.includes('factuur') || joined.includes('betalings')) return 'invoice_fraud'
    if (joined.includes('urgentie') || joined.includes('blokkeerd')) return 'social_engineering'
    return 'spam'
  }
}
