import { supabase } from '../lib/supabase'
import { AttachmentAnalysis } from '../ai/attachment-analyzer'
import { logger } from '../lib/logger'

const MB_BASE = 'https://moneybird.com/api/v2'

export class MoneybirdIntegration {
  private get token(): string {
    return process.env.MONEYBIRD_API_TOKEN!
  }

  private get administrationId(): string {
    return process.env.MONEYBIRD_ADMINISTRATION_ID!
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${MB_BASE}/${this.administrationId}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Moneybird ${method} ${path} → ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  async getAdministrations(): Promise<unknown[]> {
    const res = await fetch(`${MB_BASE}/administrations`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) throw new Error(`Moneybird administrations → ${res.status}`)
    return res.json() as Promise<unknown[]>
  }

  async processInvoice(
    messageId: string,
    attachmentId: string,
    extractedData: AttachmentAnalysis
  ): Promise<void> {
    const { data: queueEntry } = await supabase
      .from('mail_moneybird_queue')
      .select('id, retry_count')
      .eq('message_id', messageId)
      .eq('attachment_id', attachmentId)
      .single()

    const queueId = queueEntry?.id

    try {
      if (queueId) {
        await supabase
          .from('mail_moneybird_queue')
          .update({ status: 'processing' })
          .eq('id', queueId)
      }

      const { supplier, amount, date, vatNumber, invoiceNumber, description } =
        extractedData.extractedData

      const payload = {
        external_invoice: {
          contact: { company_name: supplier ?? 'Onbekend' },
          reference: invoiceNumber ?? '',
          date: date ?? new Date().toISOString().split('T')[0],
          due_date: null,
          currency: 'EUR',
          prices_are_incl_tax: true,
          details: [
            {
              description: description ?? 'Factuur',
              amount: 1,
              price: amount ?? 0,
            },
          ],
          notes: `BTW: ${vatNumber ?? 'onbekend'}`,
        },
      }

      const result = await this.request<{ id: string }>('POST', 'external_sales_invoices', payload)
      const moneybirdId = result.id

      await supabase
        .from('mail_messages')
        .update({
          moneybird_status: 'uploaded',
          moneybird_document_id: moneybirdId,
        })
        .eq('id', messageId)

      if (queueId) {
        await supabase
          .from('mail_moneybird_queue')
          .update({ status: 'uploaded', moneybird_id: moneybirdId })
          .eq('id', queueId)
      }

      await supabase.from('mail_audit_log').insert({
        message_id: messageId,
        action: 'moneybird_upload',
        actor: 'ai',
        detail: { moneybird_id: moneybirdId, attachment_id: attachmentId },
        ai_confidence: extractedData.confidence,
      })

      logger.info(`Moneybird upload success`, { messageId, moneybirdId })
    } catch (err) {
      logger.error('Moneybird upload failed', { err, messageId, attachmentId })

      await supabase
        .from('mail_messages')
        .update({ moneybird_status: 'error' })
        .eq('id', messageId)

      if (queueId) {
        const retryCount = (queueEntry?.retry_count ?? 0) + 1
        const nextRetry = new Date(Date.now() + retryCount * 5 * 60 * 1000).toISOString()

        await supabase
          .from('mail_moneybird_queue')
          .update({
            status: 'error',
            error_text: String(err),
            retry_count: retryCount,
            next_retry_at: nextRetry,
          })
          .eq('id', queueId)
      }

      throw err
    }
  }
}
