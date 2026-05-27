import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { simpleParser, ParsedMail } from 'mailparser'
import { MailAccount } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

export type GmailMessage = {
  id: string
  threadId: string
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body: { data?: string; size: number }
    parts?: Array<{
      mimeType: string
      body: { data?: string; attachmentId?: string; size: number }
      filename?: string
    }>
    mimeType: string
  }
  internalDate: string
  labelIds: string[]
}

export class GmailClient {
  private createOAuth2Client(): OAuth2Client {
    // render.yaml zet GMAIL_CLIENT_ID/SECRET; accepteer ook GOOGLE_* als alias.
    return new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID!,
      process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET!
    )
  }

  async getAuthClient(account: MailAccount): Promise<OAuth2Client> {
    const oauth2Client = this.createOAuth2Client()

    if (!account.gmail_access_token || !account.gmail_refresh_token) {
      throw new Error(`No Gmail credentials for account ${account.id}`)
    }

    const expiryMs = account.gmail_token_expiry
      ? new Date(account.gmail_token_expiry).getTime()
      : 0

    const nowMs = Date.now()
    let accessToken = account.gmail_access_token

    if (expiryMs - nowMs < 5 * 60 * 1000) {
      accessToken = await this.refreshAccessToken(account)
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: account.gmail_refresh_token,
    })

    return oauth2Client
  }

  private async refreshAccessToken(account: MailAccount): Promise<string> {
    const oauth2Client = this.createOAuth2Client()
    oauth2Client.setCredentials({
      refresh_token: account.gmail_refresh_token!,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    const newAccessToken = credentials.access_token!
    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null

    await supabase
      .from('mail_accounts')
      .update({
        gmail_access_token: newAccessToken,
        gmail_token_expiry: newExpiry,
      })
      .eq('id', account.id)

    logger.info(`Refreshed Gmail token for account ${account.email}`)
    return newAccessToken
  }

  async fetchMessages(account: MailAccount, maxResults = 50): Promise<GmailMessage[]> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:inbox',
    })

    const messages = listRes.data.messages ?? []
    const result: GmailMessage[] = []

    for (const msg of messages) {
      if (!msg.id) continue
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        })
        result.push(full.data as unknown as GmailMessage)
      } catch (err) {
        logger.error(`Failed to fetch message ${msg.id}`, { err })
      }
    }

    return result
  }

  async getMessage(account: MailAccount, messageId: string): Promise<ParsedMail> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    const raw = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'raw',
    })

    const rawData = raw.data.raw ?? ''
    const buffer = Buffer.from(rawData, 'base64url')
    return simpleParser(buffer)
  }

  async sendMessage(
    account: MailAccount,
    to: string,
    subject: string,
    body: string,
    replyToMessageId?: string
  ): Promise<string> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    const headers = [
      `To: ${to}`,
      `From: ${account.email}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ]

    if (replyToMessageId) {
      headers.push(`In-Reply-To: ${replyToMessageId}`)
      headers.push(`References: ${replyToMessageId}`)
    }

    const rawMessage = headers.join('\r\n') + '\r\n\r\n' + body
    const encoded = Buffer.from(rawMessage).toString('base64url')

    let threadId: string | undefined
    if (replyToMessageId) {
      const original = await gmail.users.messages.get({
        userId: 'me',
        id: replyToMessageId,
      })
      threadId = original.data.threadId ?? undefined
    }

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, ...(threadId ? { threadId } : {}) },
    })
    logger.info(`Sent message to ${to}`, { messageId: sent.data.id })
    return sent.data.id ?? ''
  }

  async createLabel(account: MailAccount, name: string): Promise<string> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    const existing = await gmail.users.labels.list({ userId: 'me' })
    const found = (existing.data.labels ?? []).find(l => l.name === name)
    if (found?.id) return found.id

    const created = await gmail.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    })

    return created.data.id ?? ''
  }

  async applyLabel(account: MailAccount, messageId: string, labelId: string): Promise<void> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    })
  }

  async markRead(account: MailAccount, messageId: string): Promise<void> {
    const auth = await this.getAuthClient(account)
    const gmail = google.gmail({ version: 'v1', auth })

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
  }
}
