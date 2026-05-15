import { simpleParser } from 'mailparser'
import { supabase, MailAccount, MailMessage, MailContact } from '../lib/supabase'
import { GmailClient, GmailMessage } from '../gmail/client'
import { AiClassifier } from '../ai/classifier'
import { ReplyGenerator } from '../ai/reply-generator'
import { AttachmentAnalyzer } from '../ai/attachment-analyzer'
import { SpamDetector } from '../spam/detector'
import { RelationshipMemory } from '../memory/relationship'
import { LabelBuilder } from '../labels/builder'
import { MoneybirdIntegration } from '../moneybird/integration'
import { logger } from '../lib/logger'

const gmailClient = new GmailClient()
const classifier = new AiClassifier()
const replyGenerator = new ReplyGenerator()
const attachmentAnalyzer = new AttachmentAnalyzer()
const spamDetector = new SpamDetector()
const relationshipMemory = new RelationshipMemory()
const labelBuilder = new LabelBuilder()
const moneybird = new MoneybirdIntegration()

function detectCompany(toEmails: string[], subject: string): string {
  const allText = [...toEmails, subject].join(' ').toLowerCase()
  if (allText.includes('strkbeheer') || allText.includes('beheer')) return 'STRKBEHEER'
  if (allText.includes('strkbouw') || allText.includes('bouw')) return 'STRKBOUW'
  if (allText.includes('bouwproffs')) return 'BOUWPROFFS'
  if (allText.includes('youtube') || allText.includes('vermogen') || allText.includes('spaar')) return 'YOUTUBE'
  return 'PRIVÉ'
}

function getHeaderValue(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractBodyFromPayload(payload: GmailMessage['payload']): { text: string; html: string } {
  let text = ''
  let html = ''

  if (payload.mimeType === 'text/plain' && payload.body.data) {
    text = decodeBase64(payload.body.data)
  } else if (payload.mimeType === 'text/html' && payload.body.data) {
    html = decodeBase64(payload.body.data)
  }

  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body.data) {
      text = decodeBase64(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body.data) {
      html = decodeBase64(part.body.data)
    }
  }

  return { text, html }
}

export class IntakeProcessor {
  async processIncomingMessage(
    account: MailAccount,
    gmailMessage: GmailMessage
  ): Promise<void> {
    const gmailMessageId = gmailMessage.id

    const { data: existing } = await supabase
      .from('mail_messages')
      .select('id')
      .eq('gmail_message_id', gmailMessageId)
      .single()

    if (existing) return

    const headers = gmailMessage.payload.headers
    const subject = getHeaderValue(headers, 'Subject')
    const fromRaw = getHeaderValue(headers, 'From')
    const toRaw = getHeaderValue(headers, 'To')
    const ccRaw = getHeaderValue(headers, 'Cc')
    const dateRaw = getHeaderValue(headers, 'Date')

    const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s+)?<(.+)>$/)
    const fromName = fromMatch?.[1]?.trim() ?? null
    const fromEmail = fromMatch?.[2]?.trim() ?? fromRaw.trim()

    const toEmails = toRaw.split(',').map(e => e.trim()).filter(Boolean)
    const ccEmails = ccRaw ? ccRaw.split(',').map(e => e.trim()).filter(Boolean) : []

    const receivedAt = dateRaw
      ? new Date(dateRaw).toISOString()
      : new Date(parseInt(gmailMessage.internalDate)).toISOString()

    const { text: bodyText, html: bodyHtml } = extractBodyFromPayload(gmailMessage.payload)

    const company = detectCompany(toEmails, subject)

    const existingContact = await relationshipMemory.getContact(fromEmail)

    const [classification, spamResult] = await Promise.all([
      classifier.classify(subject, fromEmail, bodyText, existingContact),
      spamDetector.analyze(
        fromEmail,
        subject,
        bodyText,
        (gmailMessage.payload.parts ?? [])
          .filter(p => p.filename)
          .map(p => ({ filename: p.filename!, mimeType: p.mimeType, size: p.body.size }))
      ),
    ])

    const { data: inserted, error: insertError } = await supabase
      .from('mail_messages')
      .insert({
        account_id: account.id,
        gmail_message_id: gmailMessageId,
        gmail_thread_id: gmailMessage.threadId,
        subject,
        from_email: fromEmail,
        from_name: fromName,
        to_emails: toEmails,
        cc_emails: ccEmails,
        body_text: bodyText,
        body_html: bodyHtml,
        received_at: receivedAt,
        is_read: !gmailMessage.labelIds.includes('UNREAD'),
        company: classification.company || company,
        category: classification.category,
        priority: spamResult.isThreat ? 'spam' : classification.priority,
        ai_summary: classification.summary,
        ai_action_suggestion: classification.actionSuggestion,
        ai_confidence: classification.confidence,
        spam_score: spamResult.score,
        threat_detected: spamResult.isThreat,
        threat_reason: spamResult.reason,
        moneybird_status: classification.isInvoice ? 'pending' : 'n_a',
        processed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError || !inserted) {
      logger.error('Failed to insert mail message', { err: insertError, gmailMessageId })
      return
    }

    const message = inserted as MailMessage

    const attachmentParts = (gmailMessage.payload.parts ?? []).filter(
      p => p.filename && p.body.attachmentId
    )

    const processedAttachments: Array<{ id: string; analysis: import('../ai/attachment-analyzer').AttachmentAnalysis }> = []

    for (const part of attachmentParts) {
      try {
        const { data: gmailAuth } = await supabase
          .from('mail_accounts')
          .select('*')
          .eq('id', account.id)
          .single()

        if (!gmailAuth) continue

        const auth = await gmailClient.getAuthClient(account)
        const { google } = await import('googleapis')
        const gmail = google.gmail({ version: 'v1', auth })

        const attachmentData = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: gmailMessageId,
          id: part.body.attachmentId!,
        })

        const buffer = Buffer.from(
          (attachmentData.data.data ?? '').replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        )

        const analysis = await attachmentAnalyzer.analyzeAttachment(
          buffer,
          part.mimeType,
          part.filename!
        )

        const { data: attachmentRow, error: attErr } = await supabase
          .from('mail_attachments')
          .insert({
            message_id: message.id,
            filename: part.filename,
            mime_type: part.mimeType,
            size_bytes: part.body.size,
            document_type: analysis.documentType,
            ai_extracted_data: analysis.extractedData,
          })
          .select('id')
          .single()

        if (!attErr && attachmentRow) {
          processedAttachments.push({ id: attachmentRow.id as string, analysis })
        }
      } catch (err) {
        logger.error('Attachment processing failed', { err, filename: part.filename })
      }
    }

    const contact = await relationshipMemory.upsertContact(fromEmail, fromName ?? fromEmail, {
      company: classification.company,
      contact_type: classification.category === 'leverancier'
        ? 'leverancier'
        : classification.category === 'klant'
          ? 'klant'
          : existingContact?.contact_type ?? undefined,
    })

    await relationshipMemory.addInteraction(
      contact.id,
      message.id,
      'inbound',
      classification.summary
    )

    if (!spamResult.isThreat) {
      const history = await relationshipMemory.getContactHistory(fromEmail, 10)
      const draft = await replyGenerator.generateReply(message, contact, history)

      if (draft.confidence > 0.3) {
        await supabase.from('mail_drafts').insert({
          message_id: message.id,
          to_email: fromEmail,
          subject: draft.subject,
          body: draft.body,
          status: 'pending',
          ai_reasoning: draft.reasoning,
          ai_confidence: draft.confidence,
        })
      }
    }

    if (classification.hasAgendaRequest && classification.proposedDateTime) {
      await supabase.from('mail_agenda_suggestions').insert({
        message_id: message.id,
        proposed_at: classification.proposedDateTime,
        duration_minutes: classification.proposedDuration ?? 60,
        title: subject,
        description: classification.summary,
      })
    }

    if (classification.isInvoice && processedAttachments.length > 0) {
      for (const att of processedAttachments) {
        if (att.analysis.documentType === 'factuur') {
          await supabase.from('mail_moneybird_queue').insert({
            message_id: message.id,
            attachment_id: att.id,
            status: 'pending',
          })
        }
      }
    }

    await labelBuilder.buildSmartLabels(message, classification)

    await supabase.from('mail_audit_log').insert({
      message_id: message.id,
      action: 'intake_processed',
      actor: 'ai',
      detail: {
        classification,
        spam_score: spamResult.score,
        threat: spamResult.isThreat,
        attachments: processedAttachments.length,
      },
      ai_confidence: classification.confidence,
    })

    logger.info(`Processed message ${gmailMessageId}`, {
      from: fromEmail,
      subject,
      priority: classification.priority,
      company: classification.company,
    })
  }
}
