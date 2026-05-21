import { ParsedMail } from 'mailparser'
import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { GmailClient, GmailMessage } from '../gmail/client'
import { UniversalMessage } from '../connectors/universal'
import { AiClassifier } from '../ai/classifier'
import { ReplyGenerator } from '../ai/reply-generator'
import { generateReplyV2 } from '../ai/reply-generator-v2'
import { AttachmentAnalyzer } from '../ai/attachment-analyzer'
import { SpamDetector } from '../spam/detector'
import { RelationshipMemory } from '../memory/relationship'
import { LabelBuilder } from '../labels/builder'
import { MoneybirdIntegration } from '../moneybird/integration'
import { LegalAgent } from '../ai/legal-agent'
import { MappingAgent } from '../ai/mapping-agent'
import { logger } from '../lib/logger'

async function createOrchestratorTask(opts: {
  title: string
  taskType: string
  workerId: string
  priority: number
  payload: Record<string, unknown>
}) {
  try {
    await supabase.from('orchestrator_tasks').insert({
      title:      opts.title,
      task_type:  opts.taskType,
      objective:  { text: opts.title },
      status:     'open',
      priority:   opts.priority,
      worker_id:  opts.workerId,
      company_id: 'modiwerijo',
      payload:    opts.payload,
    })
  } catch (err) {
    logger.warn('orchestrator_task aanmaken mislukt (non-fatal)', { err })
  }
}

const gmailClient      = new GmailClient()
const classifier       = new AiClassifier()
const replyGenerator   = new ReplyGenerator()
const attachmentAnalyzer = new AttachmentAnalyzer()
const spamDetector     = new SpamDetector()
const relationshipMemory = new RelationshipMemory()
const labelBuilder     = new LabelBuilder()
const moneybird        = new MoneybirdIntegration()
const legalAgent       = new LegalAgent()
const mappingAgent     = new MappingAgent()

function detectCompany(toEmails: string[], subject: string): string {
  const text = [...toEmails, subject].join(' ').toLowerCase()
  if (text.includes('strkbeheer'))                              return 'STRKBEHEER'
  if (text.includes('strkbouw'))                                return 'STRKBOUW'
  if (text.includes('bouwproffs'))                              return 'BOUWPROFFS'
  if (text.includes('modiwerijo') || text.includes('modiwe'))  return 'MODIWERIJO'
  if (text.includes('aquier')     || text.includes('intelligence')) return 'INTELLIGENCE'
  if (text.includes('youtube')    || text.includes('vermogen') || text.includes('spaar')) return 'YOUTUBE'
  return 'PRIVÉ'
}

type RoutingOverride = {
  company?: string
  category?: string
  priority?: string
  isInvoice?: boolean
  isLegalNotice?: boolean
  agentType?: string
}

async function applyRoutingRules(
  fromEmail: string,
  subject: string,
  toAccount: string
): Promise<RoutingOverride> {
  const fromDomain = fromEmail.split('@')[1]?.toLowerCase() ?? ''
  const subjectLower = subject.toLowerCase()

  const { data: rules } = await supabase
    .from('mail_routing_rules')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: false })

  if (!rules) return {}

  for (const rule of rules) {
    const domainMatch  = rule.match_from_domain    && fromDomain.endsWith(rule.match_from_domain.toLowerCase())
    const emailMatch   = rule.match_from_email     && fromEmail.toLowerCase() === rule.match_from_email.toLowerCase()
    const subjectMatch = rule.match_subject_contains && subjectLower.includes(rule.match_subject_contains.toLowerCase())
    const accountMatch = rule.match_to_account     && toAccount.toLowerCase() === rule.match_to_account.toLowerCase()

    const matches = [domainMatch, emailMatch, subjectMatch, accountMatch].filter(Boolean)
    if (matches.length === 0) continue

    const override: RoutingOverride = {}
    if (rule.set_company)         override.company        = rule.set_company
    if (rule.set_category)        override.category       = rule.set_category
    if (rule.set_priority)        override.priority       = rule.set_priority
    if (rule.set_is_invoice       != null) override.isInvoice      = rule.set_is_invoice
    if (rule.set_is_legal_notice  != null) override.isLegalNotice  = rule.set_is_legal_notice
    if (rule.agent_type)          override.agentType      = rule.agent_type
    return override
  }

  return {}
}

async function getAccountCompany(accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from('mail_account_mappings')
    .select('company')
    .eq('account_id', accountId)
    .single()
  return (data as { company: string } | null)?.company ?? null
}

function getHeaderValue(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBodyFromGmail(payload: GmailMessage['payload']): { text: string; html: string } {
  let text = ''
  let html  = ''

  if (payload.mimeType === 'text/plain' && payload.body.data)  text = decodeBase64(payload.body.data)
  if (payload.mimeType === 'text/html'  && payload.body.data)  html = decodeBase64(payload.body.data)

  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body.data) text = decodeBase64(part.body.data)
    if (part.mimeType === 'text/html'  && part.body.data) html = decodeBase64(part.body.data)
  }

  return { text, html }
}

export class IntakeProcessor {
  // Universal entry point — routes to Gmail or IMAP handler
  async processMessage(account: MailAccount, msg: UniversalMessage): Promise<void> {
    if (msg.source === 'gmail') {
      await this.processIncomingMessage(account, msg.raw as GmailMessage)
    } else {
      await this.processImapMessage(account, msg.uid as number, msg.raw as ParsedMail)
    }
  }

  // Gmail message handler (original)
  async processIncomingMessage(account: MailAccount, gmailMessage: GmailMessage): Promise<void> {
    const gmailMessageId = gmailMessage.id

    const { data: existing } = await supabase
      .from('mail_messages')
      .select('id')
      .eq('gmail_message_id', gmailMessageId)
      .single()

    if (existing) return

    const headers    = gmailMessage.payload.headers
    const subject    = getHeaderValue(headers, 'Subject')
    const fromRaw    = getHeaderValue(headers, 'From')
    const toRaw      = getHeaderValue(headers, 'To')
    const ccRaw      = getHeaderValue(headers, 'Cc')
    const dateRaw    = getHeaderValue(headers, 'Date')

    const fromMatch  = fromRaw.match(/^(?:"?(.+?)"?\s+)?<(.+)>$/)
    const fromName   = fromMatch?.[1]?.trim() ?? null
    const fromEmail  = fromMatch?.[2]?.trim() ?? fromRaw.trim()

    const toEmails   = toRaw.split(',').map(e => e.trim()).filter(Boolean)
    const ccEmails   = ccRaw ? ccRaw.split(',').map(e => e.trim()).filter(Boolean) : []
    const receivedAt = dateRaw
      ? new Date(dateRaw).toISOString()
      : new Date(parseInt(gmailMessage.internalDate)).toISOString()

    const { text: bodyText, html: bodyHtml } = extractBodyFromGmail(gmailMessage.payload)
    const baseCompany = detectCompany(toEmails, subject)
    const existingContact = await relationshipMemory.getContact(fromEmail)

    const [classification, spamResult, routingOverride, accountCompany] = await Promise.all([
      classifier.classify(subject, fromEmail, bodyText, existingContact),
      spamDetector.analyze(fromEmail, subject, bodyText,
        (gmailMessage.payload.parts ?? [])
          .filter(p => p.filename)
          .map(p => ({ filename: p.filename!, mimeType: p.mimeType, size: p.body.size }))
      ),
      applyRoutingRules(fromEmail, subject, account.email),
      getAccountCompany(account.id),
    ])

    // Priority: accountMapping > routingRule > AI > detectCompany
    const finalCompany   = accountCompany ?? routingOverride.company ?? (classification.company || baseCompany)
    const finalCategory  = routingOverride.category ?? classification.category
    const finalPriority  = spamResult.isThreat ? 'spam' : (routingOverride.priority ?? classification.priority)
    const finalIsInvoice = routingOverride.isInvoice ?? classification.isInvoice

    const { data: inserted, error: insertError } = await supabase
      .from('mail_messages')
      .insert({
        account_id:          account.id,
        gmail_message_id:    gmailMessageId,
        gmail_thread_id:     gmailMessage.threadId,
        provider:            'gmail',
        subject,
        from_email:          fromEmail,
        from_name:           fromName,
        to_emails:           toEmails,
        cc_emails:           ccEmails,
        body_text:           bodyText,
        body_html:           bodyHtml,
        received_at:         receivedAt,
        is_read:             !gmailMessage.labelIds.includes('UNREAD'),
        company:             finalCompany,
        category:            finalCategory,
        priority:            finalPriority,
        ai_summary:          classification.summary,
        ai_action_suggestion: classification.actionSuggestion,
        ai_confidence:       classification.confidence,
        spam_score:          spamResult.score,
        threat_detected:     spamResult.isThreat,
        threat_reason:       spamResult.reason,
        moneybird_status:    finalIsInvoice ? 'pending' : 'n_a',
        processed_at:        new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !inserted) {
      logger.error('Failed to insert Gmail message', { err: insertError, gmailMessageId })
      return
    }

    await this.postProcess(account, inserted as MailMessage, classification, spamResult, gmailMessage, routingOverride.agentType)
  }

  // IMAP message handler (iCloud, custom domains)
  async processImapMessage(account: MailAccount, uid: number, parsed: ParsedMail, folder = 'INBOX'): Promise<void> {
    // Dedup by account + uid + folder
    const { data: existing } = await supabase
      .from('mail_messages')
      .select('id')
      .eq('account_id', account.id)
      .eq('imap_uid', uid)
      .eq('imap_folder', folder)
      .single()

    if (existing) return

    const subject    = parsed.subject ?? ''
    const fromEmail  = parsed.from?.value?.[0]?.address ?? ''
    const fromName   = parsed.from?.value?.[0]?.name ?? null
    const toEmails   = (parsed.to
      ? Array.isArray(parsed.to) ? parsed.to : [parsed.to]
      : []
    ).flatMap(a => a.value.map(v => v.address ?? '')).filter(Boolean)
    const ccEmails   = (parsed.cc
      ? Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]
      : []
    ).flatMap(a => a.value.map(v => v.address ?? '')).filter(Boolean)

    const bodyText  = parsed.text ?? ''
    const bodyHtml  = parsed.html || ''
    const receivedAt = parsed.date?.toISOString() ?? new Date().toISOString()
    const baseCompany = detectCompany(toEmails, subject)
    const existingContact = await relationshipMemory.getContact(fromEmail)

    const [classification, spamResult, routingOverride, accountCompany] = await Promise.all([
      classifier.classify(subject, fromEmail, bodyText, existingContact),
      spamDetector.analyze(fromEmail, subject, bodyText,
        (parsed.attachments ?? []).map(a => ({
          filename: a.filename ?? 'attachment',
          mimeType: a.contentType,
          size: a.size ?? 0,
        }))
      ),
      applyRoutingRules(fromEmail, subject, account.email),
      getAccountCompany(account.id),
    ])

    const finalCompany   = accountCompany ?? routingOverride.company ?? (classification.company || baseCompany)
    const finalCategory  = routingOverride.category ?? classification.category
    const finalPriority  = spamResult.isThreat ? 'spam' : (routingOverride.priority ?? classification.priority)
    const finalIsInvoice = routingOverride.isInvoice ?? classification.isInvoice

    const { data: inserted, error: insertError } = await supabase
      .from('mail_messages')
      .insert({
        account_id:           account.id,
        imap_uid:             uid,
        imap_folder:          folder,
        provider:             account.provider,
        subject,
        from_email:           fromEmail,
        from_name:            fromName,
        to_emails:            toEmails,
        cc_emails:            ccEmails,
        body_text:            bodyText,
        body_html:            bodyHtml,
        received_at:          receivedAt,
        is_read:              false,
        company:              finalCompany,
        category:             finalCategory,
        priority:             finalPriority,
        ai_summary:           classification.summary,
        ai_action_suggestion: classification.actionSuggestion,
        ai_confidence:        classification.confidence,
        spam_score:           spamResult.score,
        threat_detected:      spamResult.isThreat,
        threat_reason:        spamResult.reason,
        moneybird_status:     finalIsInvoice ? 'pending' : 'n_a',
        processed_at:         new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !inserted) {
      logger.error('Failed to insert IMAP message', { err: insertError, uid })
      return
    }

    await this.postProcessImap(account, inserted as MailMessage, classification, spamResult, parsed, routingOverride.agentType)
  }

  private async postProcess(
    account: MailAccount,
    message: MailMessage,
    classification: Awaited<ReturnType<AiClassifier['classify']>>,
    spamResult: Awaited<ReturnType<SpamDetector['analyze']>>,
    gmailMessage: GmailMessage,
    agentType?: string
  ): Promise<void> {
    const fromEmail  = message.from_email!
    const fromName   = message.from_name ?? fromEmail

    const attachmentParts = (gmailMessage.payload.parts ?? []).filter(
      p => p.filename && p.body.attachmentId
    )

    const processedAttachments: Array<{ id: string; analysis: import('../ai/attachment-analyzer').AttachmentAnalysis }> = []

    for (const part of attachmentParts) {
      try {
        const auth = await gmailClient.getAuthClient(account)
        const { google } = await import('googleapis')
        const gmail = google.gmail({ version: 'v1', auth })

        const attachmentData = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: gmailMessage.id,
          id: part.body.attachmentId!,
        })

        const buffer = Buffer.from(
          (attachmentData.data.data ?? '').replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        )

        const analysis = await attachmentAnalyzer.analyzeAttachment(buffer, part.mimeType, part.filename!)
        const { data: attachmentRow, error: attErr } = await supabase
          .from('mail_attachments')
          .insert({ message_id: message.id, filename: part.filename, mime_type: part.mimeType, size_bytes: part.body.size, document_type: analysis.documentType, ai_extracted_data: analysis.extractedData })
          .select('id')
          .single()

        if (!attErr && attachmentRow) {
          processedAttachments.push({ id: attachmentRow.id as string, analysis })
        }
      } catch (err) {
        logger.error('Attachment processing failed', { err, filename: part.filename })
      }
    }

    await this.sharedPostProcess(account, message, classification, spamResult, fromEmail, fromName, processedAttachments, agentType)
  }

  private async postProcessImap(
    account: MailAccount,
    message: MailMessage,
    classification: Awaited<ReturnType<AiClassifier['classify']>>,
    spamResult: Awaited<ReturnType<SpamDetector['analyze']>>,
    parsed: ParsedMail,
    agentType?: string
  ): Promise<void> {
    const fromEmail = message.from_email!
    const fromName  = message.from_name ?? fromEmail
    const processedAttachments: Array<{ id: string; analysis: import('../ai/attachment-analyzer').AttachmentAnalysis }> = []

    for (const att of parsed.attachments ?? []) {
      try {
        const buffer   = att.content
        const analysis = await attachmentAnalyzer.analyzeAttachment(buffer, att.contentType, att.filename ?? 'attachment')
        const { data: attachmentRow, error: attErr } = await supabase
          .from('mail_attachments')
          .insert({ message_id: message.id, filename: att.filename, mime_type: att.contentType, size_bytes: att.size ?? 0, document_type: analysis.documentType, ai_extracted_data: analysis.extractedData })
          .select('id')
          .single()

        if (!attErr && attachmentRow) {
          processedAttachments.push({ id: attachmentRow.id as string, analysis })
        }
      } catch (err) {
        logger.error('IMAP attachment processing failed', { err, filename: att.filename })
      }
    }

    await this.sharedPostProcess(account, message, classification, spamResult, fromEmail, fromName, processedAttachments, agentType)
  }

  private async sharedPostProcess(
    account: MailAccount,
    message: MailMessage,
    classification: Awaited<ReturnType<AiClassifier['classify']>>,
    spamResult: Awaited<ReturnType<SpamDetector['analyze']>>,
    fromEmail: string,
    fromName: string,
    processedAttachments: Array<{ id: string; analysis: import('../ai/attachment-analyzer').AttachmentAnalysis }>,
    agentType?: string
  ): Promise<void> {
    const existingContact = await relationshipMemory.getContact(fromEmail)

    const contact = await relationshipMemory.upsertContact(fromEmail, fromName, {
      company: classification.company,
      contact_type: classification.category === 'leverancier' ? 'leverancier'
        : classification.category === 'klant' ? 'klant'
        : existingContact?.contact_type ?? undefined,
    })

    await relationshipMemory.addInteraction(contact.id, message.id, 'inbound', classification.summary)

    // ── Legal Agent — juridische bescherming ──────────────────────────────────
    const isLegalMail = agentType === 'legal'
      || classification.isLegalNotice
      || ['advocaat', 'incasso'].includes(classification.category)

    if (isLegalMail && !spamResult.isThreat) {
      try {
        const attachmentTexts = processedAttachments
          .map(a => a.analysis.extractedData?.text as string ?? '')
          .filter(Boolean)

        const legalAnalysis = await legalAgent.analyze(account, message, attachmentTexts)
        await legalAgent.createDossier(message, account, legalAnalysis)

        await supabase.from('mail_audit_log').insert({
          message_id:    message.id,
          action:        'legal_agent_processed',
          actor:         'ai',
          detail:        {
            legal_type:   legalAnalysis.legalType,
            risk_level:   legalAnalysis.riskLevel,
            deadlines:    legalAnalysis.deadlines.length,
            party:        legalAnalysis.partyName,
          },
          ai_confidence: legalAnalysis.confidence,
        })

        logger.info('Legal Agent processed', {
          from:      fromEmail,
          riskLevel: legalAnalysis.riskLevel,
          legalType: legalAnalysis.legalType,
          deadlines: legalAnalysis.deadlines.length,
        })

        // Dispatch naar orchestrator voor high-risk juridische mail
        if (legalAnalysis.riskLevel === 'high' || legalAnalysis.riskLevel === 'critical') {
          await createOrchestratorTask({
            title:    `⚖️ Juridische mail: ${message.subject?.slice(0, 80) ?? fromEmail}`,
            taskType: 'legal_analysis',
            workerId: 'advocaat-engine',
            priority: 9,
            payload:  {
              message_id:  message.id,
              from_email:  fromEmail,
              subject:     message.subject,
              legal_type:  legalAnalysis.legalType,
              risk_level:  legalAnalysis.riskLevel,
              deadlines:   legalAnalysis.deadlines,
              party:       legalAnalysis.partyName,
            },
          })
        }

        // Legal Agent maakt zijn eigen drafts — sla generieke reply over
        return
      } catch (err) {
        logger.error('Legal Agent failed, falling back to generic', { err, messageId: message.id })
      }
    }

    // ── Intelligent reply generator with template suggestions ─────────────────
    if (!spamResult.isThreat) {
      const history = await relationshipMemory.getContactHistory(fromEmail, 10)

      // Fetch available templates for this category/company
      const { data: availableTemplates } = await supabase
        .from('mail_templates')
        .select('*')
        .eq('enabled', true)
        .eq('category', classification.category)
        .order('confidence_min', { ascending: true })

      // Generate reply with template suggestions
      const draft = await generateReplyV2(
        {
          from_email: fromEmail,
          subject: message.subject || '',
          body: message.body_text || '',
          company: classification.company,
          category: classification.category,
          priority: classification.priority,
          contact_sentiment: existingContact?.sentiment ?? undefined,
          prior_interactions: contact.total_interactions,
        },
        availableTemplates || []
      )

      if (draft.confidence > 0.3) {
        // Look up suggested template by name if one was recommended
        let suggestedTemplateId: string | null = null
        if (draft.suggestedTemplate?.name) {
          const { data: templateMatch } = await supabase
            .from('mail_templates')
            .select('id')
            .eq('name', draft.suggestedTemplate.name)
            .eq('category', draft.suggestedTemplate.category)
            .single()
          suggestedTemplateId = templateMatch?.id as string || null
        }

        // Determine status based on confidence level
        let draftStatus: 'approved' | 'pending' | 'escalated' = 'pending'
        if (draft.confidence > 0.8) {
          draftStatus = 'approved'
        } else if (draft.confidence < 0.5) {
          draftStatus = 'escalated'
        }

        const { data: insertedDraft } = await supabase.from('mail_drafts').insert({
          message_id:            message.id,
          to_email:              fromEmail,
          from_email:            message.to_emails?.[0] ?? null,
          subject:               draft.subject,
          body:                  draft.body,
          status:                draftStatus,
          ai_reasoning:          draft.reasoning,
          ai_confidence:         draft.confidence,
          suggested_template_id: suggestedTemplateId,
        }).select('id').single()

        if (insertedDraft && suggestedTemplateId) {
          await supabase.from('mail_template_history').insert({
            template_id:     suggestedTemplateId,
            draft_id:        insertedDraft.id as string,
            approval_status: draftStatus === 'approved' ? 'approved' : 'pending',
          })
        }

        // Escalate low-confidence drafts to orchestrator for manual review
        if (draftStatus === 'escalated') {
          await createOrchestratorTask({
            title:    `⚠️ Low-confidence mail draft: ${draft.subject?.slice(0, 80)}`,
            taskType: 'mail_escalation',
            workerId: 'mail-orchestrator',
            priority: 5,
            payload:  {
              draft_id:        insertedDraft?.id,
              message_id:      message.id,
              from_email:      fromEmail,
              subject:         draft.subject,
              confidence:      draft.confidence,
              reasoning:       draft.reasoning,
              category:        classification.category,
              priority:        classification.priority,
            },
          })
        }

        // Log auto-approval for high-confidence drafts
        if (draftStatus === 'approved') {
          logger.info('Auto-approved high-confidence draft', {
            draftId:   insertedDraft?.id,
            messageId: message.id,
            confidence: draft.confidence,
            subject:   draft.subject,
          })
        }
      }
    }

    if (classification.hasAgendaRequest && classification.proposedDateTime) {
      await supabase.from('mail_agenda_suggestions').insert({
        message_id:       message.id,
        proposed_at:      classification.proposedDateTime,
        duration_minutes: classification.proposedDuration ?? 60,
        title:            message.subject,
        description:      classification.summary,
      })
    }

    if (classification.isInvoice && processedAttachments.length > 0) {
      for (const att of processedAttachments) {
        if (att.analysis.documentType === 'factuur') {
          await supabase.from('mail_moneybird_queue').insert({
            message_id:    message.id,
            attachment_id: att.id,
            status:        'pending',
          })
        }
      }

      // Dispatch naar orchestrator voor facturatie verwerking
      await createOrchestratorTask({
        title:    `🧾 Factuur ontvangen: ${message.subject?.slice(0, 80) ?? fromEmail}`,
        taskType: 'finance_analysis',
        workerId: 'cli-l',
        priority: 6,
        payload:  {
          message_id:   message.id,
          from_email:   fromEmail,
          subject:      message.subject,
          company:      classification.company,
          attachments:  processedAttachments.length,
        },
      })
    }

    // Mapping Agent: IMAP mappen aanmaken + mail verplaatsen + labels
    try {
      await mappingAgent.map(account, message, classification)
      await mappingAgent.incrementStats(true)
    } catch (mapErr) {
      await mappingAgent.incrementStats(false)
      logger.warn('MappingAgent failed (non-fatal)', { err: mapErr, messageId: message.id })
    }

    await supabase.from('mail_audit_log').insert({
      message_id:    message.id,
      action:        'intake_processed',
      actor:         'ai',
      detail:        { classification, spam_score: spamResult.score, threat: spamResult.isThreat, attachments: processedAttachments.length },
      ai_confidence: classification.confidence,
    })

    logger.info('Processed message', {
      from:     fromEmail,
      subject:  message.subject,
      priority: classification.priority,
      company:  classification.company,
      provider: message.provider,
    })
  }
}
