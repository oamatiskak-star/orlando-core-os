import Anthropic from '@anthropic-ai/sdk'
import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { logger } from '../lib/logger'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type LegalAnalysis = {
  legalType: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  partyName: string
  partyDomain: string
  reference: string
  legalBasis: string
  claimAmount: number | null
  deadlines: Array<{ title: string; date: string; type: string }>
  analysis: string
  strategy: string
  responseRequired: boolean
  responseDraft: string
  confidence: number
}

const LEGAL_SYSTEM_PROMPT = `Je bent een zeer ervaren Nederlandse juridische expert met 20+ jaar ervaring in:
- Civiel procesrecht (Wetboek van Burgerlijke Rechtsvordering)
- Insolventierecht (Faillissementswet)
- Verbintenissenrecht (Burgerlijk Wetboek Boek 6)
- Incassorecht en deurwaarderspraktijk
- Vastgoedrecht en huurrecht
- Ondernemingsrecht

Je analyseert juridische post voor Orlando, eigenaar van:
- STRKBEHEER BV (vastgoedbeheer en verhuur)
- STRKBOUW BV (bouwprojecten en aanneming)
- BOUWPROFFS BV (SaaS platform bouw)
- MODIWERIJO FINANCIAL MANAGEMENT BV (holding/financieel)

KERNPRINCIPES:
1. Identificeer ALTIJD exacte wettelijke termijnen (reactietermijn, beroepstermijn)
2. Beoordeel de juridische grondslag en kansen
3. Adviseer proactief — bescherming gaat vóór reactie
4. Wijs op verzuim, verjaring, nietigheid waar van toepassing
5. Maak onderscheid tussen spoedeisend (conservatoir beslag, faillissement) en normaal

GEEF ALTIJD GELDIG JSON TERUG.`

export class LegalAgent {
  async analyze(
    account: MailAccount,
    message: MailMessage,
    attachmentTexts: string[] = []
  ): Promise<LegalAnalysis> {
    const history = await this.getPriorCorrespondence(message.from_email ?? '', message.company ?? '')
    const attachmentContext = attachmentTexts.length > 0
      ? `\n\nBijlagen inhoud:\n${attachmentTexts.join('\n---\n').substring(0, 3000)}`
      : ''

    const historyContext = history.length > 0
      ? `\n\nEerdere correspondentie met ${message.from_email} (${history.length} berichten):\n${
          history.map(h => `- ${h.received_at?.substring(0, 10)}: ${h.subject} (${h.category})`).join('\n')
        }`
      : ''

    const prompt = `Analyseer deze juridische correspondentie volledig:

VAN: ${message.from_email ?? 'onbekend'} (${message.from_name ?? ''})
AAN: ${account.email} (${message.company ?? 'onbekend bedrijf'})
ONDERWERP: ${message.subject ?? ''}
ONTVANGEN: ${message.received_at ?? new Date().toISOString()}

INHOUD:
${(message.body_text ?? '').substring(0, 4000)}${attachmentContext}${historyContext}

Geef een volledig juridisch advies als JSON:
{
  "legalType": "<dagvaarding|sommatiebrief|ingebrekestelling|faillissement|curator|incasso|bezwaar|vonnis|hoger_beroep|overig>",
  "riskLevel": "<low|medium|high|critical>",
  "partyName": "<naam wederpartij / curator / advocatenkantoor>",
  "partyDomain": "<emaildomein afzender>",
  "reference": "<zaaknummer of referentie indien aanwezig, anders leeg>",
  "legalBasis": "<wetsartikelen / grondslag, bijv. 'Art. 6:162 BW (onrechtmatige daad)'>",
  "claimAmount": <bedrag als getal of null>,
  "deadlines": [
    { "title": "<omschrijving>", "date": "<ISO8601>", "type": "<reactietermijn|beroepstermijn|betalingstermijn|zitting|overig>" }
  ],
  "analysis": "<gedetailleerde juridische analyse in NL, min 200 woorden: wat is de juridische positie, risico's, precedenten>",
  "strategy": "<aanbevolen strategie in NL: concrete stappen, volgorde, wat NIET te doen>",
  "responseRequired": <true|false>,
  "responseDraft": "<concept reactie in formeel NL, compleet en direct bruikbaar, of leeg string als niet nodig>",
  "confidence": <0.0-1.0>
}`

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        system: LEGAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in legal response')

      const parsed = JSON.parse(jsonMatch[0]) as LegalAnalysis
      logger.info('Legal analysis complete', {
        from: message.from_email,
        riskLevel: parsed.riskLevel,
        legalType: parsed.legalType,
        deadlines: parsed.deadlines.length,
      })
      return parsed
    } catch (err) {
      logger.error('Legal agent failed', { err, messageId: message.id })
      return {
        legalType: 'overig',
        riskLevel: 'high',
        partyName: message.from_name ?? message.from_email ?? 'onbekend',
        partyDomain: message.from_email?.split('@')[1] ?? '',
        reference: '',
        legalBasis: 'Nader te bepalen',
        claimAmount: null,
        deadlines: [],
        analysis: 'Automatische analyse mislukt. Handmatige beoordeling vereist.',
        strategy: 'Direct handmatig controleren en juridisch advies inwinnen.',
        responseRequired: true,
        responseDraft: '',
        confidence: 0,
      }
    }
  }

  async createDossier(
    message: MailMessage,
    account: MailAccount,
    analysis: LegalAnalysis
  ): Promise<string | null> {
    const { data: dossier, error } = await supabase
      .from('mail_legal_dossiers')
      .insert({
        message_id:    message.id,
        account_id:    account.id,
        reference:     analysis.reference || null,
        party_name:    analysis.partyName,
        party_domain:  analysis.partyDomain,
        legal_type:    analysis.legalType,
        company:       message.company,
        risk_level:    analysis.riskLevel,
        legal_basis:   analysis.legalBasis,
        claim_amount:  analysis.claimAmount,
        ai_analysis:   analysis.analysis,
        ai_strategy:   analysis.strategy,
        ai_confidence: analysis.confidence,
        status:        'open',
      })
      .select('id')
      .single()

    if (error || !dossier) {
      logger.error('Failed to create legal dossier', { err: error, messageId: message.id })
      return null
    }

    const dossierId = (dossier as { id: string }).id

    // Termijnen opslaan
    if (analysis.deadlines.length > 0) {
      const deadlineRows = analysis.deadlines
        .filter(d => d.date && !isNaN(Date.parse(d.date)))
        .map(d => ({
          dossier_id:  dossierId,
          message_id:  message.id,
          title:       d.title,
          deadline_at: new Date(d.date).toISOString(),
          type:        d.type || 'overig',
          status:      'open',
        }))

      if (deadlineRows.length > 0) {
        await supabase.from('mail_legal_deadlines').insert(deadlineRows)
      }
    }

    // Juridisch concept antwoord aanmaken indien nodig
    if (analysis.responseRequired && analysis.responseDraft) {
      await supabase.from('mail_drafts').insert({
        message_id:    message.id,
        to_email:      message.from_email,
        from_email:    account.email,
        subject:       `Re: ${message.subject ?? ''}`,
        body:          analysis.responseDraft,
        status:        'pending',
        ai_reasoning:  `Juridische analyse: ${analysis.analysis.substring(0, 300)}...`,
        ai_confidence: analysis.confidence,
        send_via:      'mailtrap_live',
      })
    }

    logger.info('Legal dossier created', {
      dossierId,
      legalType: analysis.legalType,
      riskLevel: analysis.riskLevel,
      deadlines: analysis.deadlines.length,
      company: message.company,
    })

    return dossierId
  }

  private async getPriorCorrespondence(fromEmail: string, company: string): Promise<MailMessage[]> {
    if (!fromEmail) return []
    const { data } = await supabase
      .from('mail_messages')
      .select('id, subject, received_at, category, company')
      .eq('from_email', fromEmail)
      .order('received_at', { ascending: false })
      .limit(10)
    return (data ?? []) as unknown as MailMessage[]
  }
}
