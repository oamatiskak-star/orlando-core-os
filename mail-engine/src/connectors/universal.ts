import { ParsedMail } from 'mailparser'
import { MailAccount } from '../lib/supabase'
import { GmailClient, GmailMessage } from '../gmail/client'
import { ImapClient, ImapMessage } from '../imap/client'
import { MailtrapClient } from '../mailtrap/client'
import { logger } from '../lib/logger'

export type UniversalMessage =
  | { source: 'gmail'; uid: string; raw: GmailMessage }
  | { source: 'imap';  uid: number; raw: ParsedMail }

type SendOptions = {
  account: MailAccount
  to: string
  subject: string
  text: string
  html?: string
  replyToMessageId?: string
  useSandbox?: boolean
}

export class UniversalMailConnector {
  private gmail = new GmailClient()
  private imap  = new ImapClient()
  private mailtrap = new MailtrapClient()

  async fetchMessages(account: MailAccount, limit = 50): Promise<UniversalMessage[]> {
    switch (account.provider) {
      case 'gmail':
        return this.fetchGmail(account, limit)

      case 'icloud':
      case 'imap':
      case 'custom':
        return this.fetchImap(account, limit)

      case 'outlook':
        logger.warn('Outlook Graph API not yet implemented', { email: account.email })
        return []

      default:
        logger.warn('Unknown provider', { provider: account.provider })
        return []
    }
  }

  private async fetchGmail(account: MailAccount, limit: number): Promise<UniversalMessage[]> {
    try {
      const messages = await this.gmail.fetchMessages(account, limit)
      return messages.map(m => ({ source: 'gmail' as const, uid: m.id, raw: m }))
    } catch (err) {
      logger.error('Gmail fetch failed', { err, email: account.email })
      return []
    }
  }

  private async fetchImap(account: MailAccount, limit: number): Promise<UniversalMessage[]> {
    if (!account.imap_host || !account.imap_pass_encrypted) {
      logger.warn('IMAP credentials missing', { email: account.email })
      return []
    }

    try {
      const messages = await this.imap.fetchUnread(account, limit)
      return messages.map(m => ({ source: 'imap' as const, uid: m.uid, raw: m.parsedMail }))
    } catch (err) {
      logger.error('IMAP fetch failed', { err, email: account.email })
      return []
    }
  }

  async send(options: SendOptions): Promise<string> {
    const { account, to, subject, text, html, replyToMessageId, useSandbox = false } = options

    const fromEmail = account.email
    const fromName = account.display_name ?? account.email

    // Always route through Mailtrap when send_via_mailtrap is enabled
    if (account.send_via_mailtrap || useSandbox) {
      const payload = {
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        text,
        ...(html ? { html } : {}),
      }

      if (useSandbox) {
        const result = await this.mailtrap.sendToSandbox(payload)
        return result.message_ids?.[0] ?? ''
      } else {
        const result = await this.mailtrap.sendLive(payload)
        return result.message_ids?.[0] ?? ''
      }
    }

    // Fallback: send via Gmail API
    if (account.provider === 'gmail') {
      return this.gmail.sendMessage(account, to, subject, text, replyToMessageId)
    }

    logger.warn('No send method available for account', { email: account.email, provider: account.provider })
    throw new Error(`No send method configured for ${account.email}`)
  }

  async markRead(account: MailAccount, message: UniversalMessage): Promise<void> {
    try {
      if (message.source === 'gmail') {
        await this.gmail.markRead(account, message.uid)
      } else if (message.source === 'imap') {
        await this.imap.markRead(account, message.uid)
      }
    } catch (err) {
      logger.error('Mark read failed', { err, email: account.email })
    }
  }
}
