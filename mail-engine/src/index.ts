import 'dotenv/config'
import express, { Request, Response } from 'express'
import { syncAllAccounts } from './sync/account-sync'
import { RetryQueue } from './queue/retry'
import { supabase } from './lib/supabase'
import { GmailClient } from './gmail/client'
import { IntakeProcessor } from './intake/processor'
import { logger } from './lib/logger'

const app = express()
app.use(express.json())

const retryQueue = new RetryQueue()
const gmailClient = new GmailClient()
const intakeProcessor = new IntakeProcessor()

const PORT = parseInt(process.env.PORT ?? '3003', 10)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mail-engine', time: new Date().toISOString() })
})

app.post('/sync', async (_req: Request, res: Response) => {
  try {
    res.json({ status: 'started' })
    await syncAllAccounts()
  } catch (err) {
    logger.error('Sync failed', { err })
  }
})

app.post('/process/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params

  const { data: message, error: msgErr } = await supabase
    .from('mail_messages')
    .select('*, mail_accounts(*)')
    .eq('id', messageId)
    .single()

  if (msgErr || !message) {
    res.status(404).json({ error: 'Message not found' })
    return
  }

  const msg = message as Record<string, unknown>
  const account = msg['mail_accounts'] as import('./lib/supabase').MailAccount
  const gmailMessageId = msg['gmail_message_id'] as string | undefined
  if (!gmailMessageId) {
    res.status(400).json({ error: 'No Gmail message ID' })
    return
  }

  try {
    const gmailMessages = await gmailClient.fetchMessages(account, 1)
    const target = gmailMessages.find(m => m.id === gmailMessageId)
    if (!target) {
      res.status(404).json({ error: 'Gmail message not found' })
      return
    }

    await intakeProcessor.processIncomingMessage(account, target)
    res.json({ status: 'processed' })
  } catch (err) {
    logger.error('Manual process failed', { err, messageId })
    res.status(500).json({ error: String(err) })
  }
})

app.post('/approve-draft/:draftId', async (req: Request, res: Response) => {
  const { draftId } = req.params

  const { data: draft, error: draftErr } = await supabase
    .from('mail_drafts')
    .select('*, mail_messages(*, mail_accounts(*))')
    .eq('id', draftId)
    .eq('status', 'approved')
    .single()

  if (draftErr || !draft) {
    res.status(404).json({ error: 'Approved draft not found' })
    return
  }

  const draftData = draft as Record<string, unknown>
  const message = draftData['mail_messages'] as Record<string, unknown>
  const account = message?.['mail_accounts'] as import('./lib/supabase').MailAccount

  if (!account) {
    res.status(400).json({ error: 'No account linked to draft' })
    return
  }

  try {
    const sentId = await gmailClient.sendMessage(
      account,
      draftData['to_email'] as string,
      draftData['subject'] as string,
      draftData['body'] as string,
      message?.['gmail_message_id'] as string | undefined
    )

    await supabase
      .from('mail_drafts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', draftId)

    await supabase.from('mail_audit_log').insert({
      message_id: draftData['message_id'],
      action: 'draft_sent',
      actor: 'user',
      detail: { draft_id: draftId, gmail_sent_id: sentId },
      ai_confidence: draftData['ai_confidence'] as number,
    })

    logger.info('Draft sent', { draftId, sentId })
    res.json({ status: 'sent', gmailMessageId: sentId })
  } catch (err) {
    logger.error('Draft send failed', { err, draftId })
    res.status(500).json({ error: String(err) })
  }
})

app.post('/reject-draft/:draftId', async (req: Request, res: Response) => {
  const { draftId } = req.params

  const { error } = await supabase
    .from('mail_drafts')
    .update({ status: 'rejected' })
    .eq('id', draftId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  await supabase.from('mail_audit_log').insert({
    message_id: null,
    action: 'draft_rejected',
    actor: 'user',
    detail: { draft_id: draftId },
    ai_confidence: 0,
  })

  res.json({ status: 'rejected' })
})

setInterval(() => {
  syncAllAccounts().catch(err => logger.error('Interval sync failed', { err }))
  retryQueue.processQueue().catch(err => logger.error('Retry queue failed', { err }))
}, 5 * 60 * 1000)

app.listen(PORT, () => {
  logger.info(`Mail Engine running on port ${PORT}`)
})
