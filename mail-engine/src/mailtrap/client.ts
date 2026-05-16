import { logger } from '../lib/logger'

const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN ?? '360151baa7208d6f5b50738857c6f93c'
const MAILTRAP_ACCOUNT_ID = process.env.MAILTRAP_ACCOUNT_ID ?? '2723945'
const MAILTRAP_INBOX_ID = process.env.MAILTRAP_INBOX_ID ?? '4632149'

type MailtrapAddress = { email: string; name?: string }

type MailtrapSendPayload = {
  from: MailtrapAddress
  to: MailtrapAddress[]
  cc?: MailtrapAddress[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{ filename: string; content: string; type: string; disposition: string }>
}

type MailtrapSendResult = {
  success: boolean
  message_ids?: string[]
  error?: string
}

export class MailtrapClient {
  private async post(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILTRAP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  // Send to Mailtrap sandbox (safe testing — never reaches real recipients)
  async sendToSandbox(payload: MailtrapSendPayload): Promise<MailtrapSendResult> {
    try {
      const res = await this.post(
        `https://sandbox.api.mailtrap.io/api/send/${MAILTRAP_INBOX_ID}`,
        payload
      )
      const data = await res.json() as { success: boolean; message_ids?: string[]; errors?: string[] }

      if (!data.success) {
        logger.error('Mailtrap sandbox send failed', { errors: data.errors })
        return { success: false, error: data.errors?.join(', ') }
      }

      logger.info('Sent to Mailtrap sandbox', { message_ids: data.message_ids })
      return { success: true, message_ids: data.message_ids }
    } catch (err) {
      logger.error('Mailtrap sandbox error', { err })
      return { success: false, error: String(err) }
    }
  }

  // Send live via Mailtrap Email Sending (real delivery)
  async sendLive(payload: MailtrapSendPayload): Promise<MailtrapSendResult> {
    try {
      const res = await this.post('https://send.api.mailtrap.io/api/send', payload)
      const data = await res.json() as { success: boolean; message_ids?: string[]; errors?: string[] }

      if (!data.success) {
        logger.error('Mailtrap live send failed', { errors: data.errors })
        return { success: false, error: data.errors?.join(', ') }
      }

      logger.info('Sent live via Mailtrap', { message_ids: data.message_ids })
      return { success: true, message_ids: data.message_ids }
    } catch (err) {
      logger.error('Mailtrap live error', { err })
      return { success: false, error: String(err) }
    }
  }

  // Fetch messages from sandbox inbox (for preview/approval)
  async getSandboxMessages(): Promise<unknown[]> {
    try {
      const res = await fetch(
        `https://mailtrap.io/api/accounts/${MAILTRAP_ACCOUNT_ID}/inboxes/${MAILTRAP_INBOX_ID}/messages`,
        { headers: { 'Api-Token': MAILTRAP_API_TOKEN } }
      )
      const data = await res.json() as unknown[]
      return Array.isArray(data) ? data : []
    } catch (err) {
      logger.error('Failed to fetch sandbox messages', { err })
      return []
    }
  }

  // Delete message from sandbox after approval/rejection
  async deleteSandboxMessage(messageId: string): Promise<void> {
    try {
      await fetch(
        `https://mailtrap.io/api/accounts/${MAILTRAP_ACCOUNT_ID}/inboxes/${MAILTRAP_INBOX_ID}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: { 'Api-Token': MAILTRAP_API_TOKEN },
        }
      )
    } catch (err) {
      logger.error('Failed to delete sandbox message', { err, messageId })
    }
  }
}
