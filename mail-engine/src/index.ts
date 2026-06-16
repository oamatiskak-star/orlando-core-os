import 'dotenv/config'
import express, { Request, Response } from 'express'
import { syncAllAccounts } from './sync/account-sync'
import { RetryQueue } from './queue/retry'
import { supabase } from './lib/supabase'
import { UniversalMailConnector } from './connectors/universal'
import { MailtrapClient } from './mailtrap/client'
import { IntakeProcessor } from './intake/processor'
import { syncAffiliateLabels } from './labels/affiliate-labels'
import { watchAffiliateApprovals } from './intake/affiliate-approval-watcher'
import { logger } from './lib/logger'

const app = express()
app.use(express.json())

const retryQueue  = new RetryQueue()
const connector   = new UniversalMailConnector()
const mailtrap    = new MailtrapClient()
const intakeProcessor = new IntakeProcessor()

const PORT = parseInt(process.env.PORT ?? '3003', 10)

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mail-engine', time: new Date().toISOString() })
})

// ─── Sync ─────────────────────────────────────────────────────────────────────

app.post('/sync', async (_req: Request, res: Response) => {
  try {
    res.json({ status: 'started' })
    await syncAllAccounts()
  } catch (err) {
    logger.error('Sync failed', { err })
  }
})

app.post('/sync/:accountId', async (req: Request, res: Response) => {
  const { accountId } = req.params
  const { data: account, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (error || !account) {
    res.status(404).json({ error: 'Account not found' })
    return
  }

  res.json({ status: 'started', account: account.email })

  try {
    const messages = await connector.fetchMessages(account, 50)
    for (const msg of messages) {
      await intakeProcessor.processMessage(account, msg)
      await connector.markRead(account, msg)
    }
    logger.info(`Manual sync complete for ${account.email}`, { count: messages.length })
  } catch (err) {
    logger.error('Manual account sync failed', { err, accountId })
  }
})

// ─── Draft: Preview in Sandbox ────────────────────────────────────────────────

app.post('/draft/:draftId/preview', async (req: Request, res: Response) => {
  const { draftId } = req.params

  const { data: draft, error } = await supabase
    .from('mail_drafts')
    .select('*, mail_messages(*, mail_accounts(*))')
    .eq('id', draftId)
    .single()

  if (error || !draft) {
    res.status(404).json({ error: 'Draft not found' })
    return
  }

  const d = draft as Record<string, unknown>
  const message = d['mail_messages'] as Record<string, unknown>
  const account = message?.['mail_accounts'] as import('./lib/supabase').MailAccount

  if (!account) {
    res.status(400).json({ error: 'No account linked' })
    return
  }

  try {
    const result = await mailtrap.sendToSandbox({
      from: {
        email: (d['from_email'] as string) || account.email,
        name:  account.display_name ?? account.email,
      },
      to: [{ email: d['to_email'] as string }],
      subject: d['subject'] as string,
      text:    d['body'] as string,
    })

    await supabase
      .from('mail_drafts')
      .update({
        status:               'sandbox',
        mailtrap_sandbox_id:  result.message_ids?.[0] ?? null,
        sandbox_tested_at:    new Date().toISOString(),
      })
      .eq('id', draftId)

    await supabase.from('mail_audit_log').insert({
      message_id:    d['message_id'] as string ?? null,
      action:        'draft_sandbox_preview',
      actor:         'system',
      detail:        { draft_id: draftId, sandbox_id: result.message_ids?.[0] },
      ai_confidence: d['ai_confidence'] as number,
    })

    res.json({ status: 'previewed', sandbox_id: result.message_ids?.[0] })
  } catch (err) {
    logger.error('Sandbox preview failed', { err, draftId })
    res.status(500).json({ error: String(err) })
  }
})

// ─── Draft: Approve + Send Live ───────────────────────────────────────────────

app.post('/approve-draft/:draftId', async (req: Request, res: Response) => {
  const { draftId } = req.params

  const { data: draft, error } = await supabase
    .from('mail_drafts')
    .select('*, mail_messages(*, mail_accounts(*))')
    .eq('id', draftId)
    .in('status', ['pending', 'sandbox', 'approved'])
    .single()

  if (error || !draft) {
    res.status(404).json({ error: 'Draft not found' })
    return
  }

  const d       = draft as Record<string, unknown>
  const message = d['mail_messages'] as Record<string, unknown>
  const account = message?.['mail_accounts'] as import('./lib/supabase').MailAccount

  if (!account) {
    res.status(400).json({ error: 'No account linked to draft' })
    return
  }

  try {
    const sentId = await connector.send({
      account,
      to:             d['to_email'] as string,
      subject:        d['subject'] as string,
      text:           d['body'] as string,
      replyToMessageId: message?.['gmail_message_id'] as string | undefined,
      useSandbox:     false,
    })

    await supabase
      .from('mail_drafts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', draftId)

    await supabase.from('mail_audit_log').insert({
      message_id:    d['message_id'] as string ?? null,
      action:        'draft_sent',
      actor:         'user',
      detail:        { draft_id: draftId, sent_id: sentId },
      ai_confidence: d['ai_confidence'] as number,
    })

    logger.info('Draft approved and sent', { draftId, sentId })
    res.json({ status: 'sent', sentId })
  } catch (err) {
    logger.error('Draft send failed', { err, draftId })
    res.status(500).json({ error: String(err) })
  }
})

// ─── Draft: Reject ────────────────────────────────────────────────────────────

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
    message_id:    null,
    action:        'draft_rejected',
    actor:         'user',
    detail:        { draft_id: draftId },
    ai_confidence: 0,
  })

  res.json({ status: 'rejected' })
})

// ─── Draft: Edit ──────────────────────────────────────────────────────────────

app.patch('/draft/:draftId', async (req: Request, res: Response) => {
  const { draftId } = req.params
  const { subject, body, to_email } = req.body as { subject?: string; body?: string; to_email?: string }

  const { data: current } = await supabase
    .from('mail_drafts')
    .select('version')
    .eq('id', draftId)
    .single()

  const { error } = await supabase
    .from('mail_drafts')
    .update({
      ...(subject  ? { subject }  : {}),
      ...(body     ? { body }     : {}),
      ...(to_email ? { to_email } : {}),
      status:  'pending',
      version: ((current as Record<string, unknown>)?.['version'] as number ?? 0) + 1,
    })
    .eq('id', draftId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ status: 'updated' })
})

// ─── Sandbox: Get pending previews ────────────────────────────────────────────

app.get('/sandbox/messages', async (_req: Request, res: Response) => {
  const messages = await mailtrap.getSandboxMessages()
  res.json({ messages })
})

// ─── Accounts: Register new account ──────────────────────────────────────────

app.post('/accounts', async (req: Request, res: Response) => {
  const body = req.body as {
    provider: string
    email: string
    display_name?: string
    imap_host?: string
    imap_port?: number
    imap_user?: string
    imap_pass?: string
    gmail_access_token?: string
    gmail_refresh_token?: string
    send_via_mailtrap?: boolean
  }

  const { error, data } = await supabase
    .from('mail_accounts')
    .insert({
      provider:             body.provider,
      email:                body.email,
      display_name:         body.display_name ?? null,
      imap_host:            body.imap_host ?? null,
      imap_port:            body.imap_port ?? null,
      imap_user:            body.imap_user ?? null,
      imap_pass_encrypted:  body.imap_pass ?? null,
      gmail_access_token:   body.gmail_access_token ?? null,
      gmail_refresh_token:  body.gmail_refresh_token ?? null,
      smtp_host:            'live.smtp.mailtrap.io',
      smtp_port:            587,
      smtp_user:            'api',
      smtp_pass_encrypted:  process.env.MAILTRAP_API_TOKEN ?? '360151baa7208d6f5b50738857c6f93c',
      send_via_mailtrap:    body.send_via_mailtrap ?? true,
      sync_status:          'idle',
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ status: 'created', account: data })
})

// ─── Affiliate-labels (Account Setup Agent) ─────────────────────────────────────

app.post('/labels/affiliates/sync', async (_req: Request, res: Response) => {
  try {
    const result = await syncAffiliateLabels()
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── Scheduler ────────────────────────────────────────────────────────────────

setInterval(() => {
  syncAllAccounts().catch(err => logger.error('Interval sync failed', { err }))
  retryQueue.processQueue().catch(err => logger.error('Retry queue failed', { err }))
}, 5 * 60 * 1000)

// Affiliate-labels iets vaker dan de mailsync, zodat een nieuwe "Live setup"
// snel een Gmail-label krijgt.
setInterval(() => {
  syncAffiliateLabels().catch(err => logger.error('Affiliate-label sync failed', { err }))
}, 60 * 1000)

// Affiliate approval-watcher: scant broker-/Impact-mails op goedkeuring/afwijzing en
// zet account_status='active' (→ go-live + link) of approval_status='rejected'. Elke 5 min.
setInterval(() => {
  watchAffiliateApprovals().catch(err => logger.error('Affiliate approval-watcher failed', { err }))
}, 5 * 60 * 1000)

app.listen(PORT, () => {
  logger.info(`Mail Engine running on port ${PORT}`)
  logger.info('Universal Mail Layer active: gmail | icloud | imap | outlook')
})
