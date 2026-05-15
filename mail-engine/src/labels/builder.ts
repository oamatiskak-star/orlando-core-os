import { supabase } from '../lib/supabase'
import { MailMessage } from '../lib/supabase'
import { ClassificationResult } from '../ai/classifier'
import { logger } from '../lib/logger'

export type MailLabel = {
  id: string
  name: string
  parent_label: string | null
  color: string | null
  icon: string | null
  auto_rule: Record<string, unknown>
  created_at: string
}

const LABEL_TREE: Record<string, string[]> = {
  STRKBEHEER: ['Vastgoed', 'Huurders', 'Leveranciers', 'Belasting', 'Bank', 'Incasso'],
  STRKBOUW: ['Leveranciers', 'Klanten', 'Offertes', 'Facturen', 'Materialen', 'UTA'],
  BOUWPROFFS: ['Support', 'SaaS', 'Facturen', 'Integraties'],
  YOUTUBE: ['Partners', 'Sponsoring', 'Copyright', 'Automatisering'],
  PRIVÉ: ['Familie', 'Bankzaken', 'Overig'],
  Status: ['Ingeboekt', 'Te-verwerken', 'Afgehandeld', 'Urgent'],
}

export class LabelBuilder {
  async ensureLabel(name: string, parent?: string): Promise<MailLabel> {
    const { data: existing } = await supabase
      .from('mail_labels')
      .select('*')
      .eq('name', parent ? `${parent}/${name}` : name)
      .single()

    if (existing) return existing as MailLabel

    const fullName = parent ? `${parent}/${name}` : name
    const { data, error } = await supabase
      .from('mail_labels')
      .insert({
        name: fullName,
        parent_label: parent ?? null,
        color: this.colorForLabel(name),
        icon: null,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create label', { err: error, name: fullName })
      throw error
    }

    return data as MailLabel
  }

  async applyLabelToMessage(messageId: string, labelName: string): Promise<void> {
    const { data: label } = await supabase
      .from('mail_labels')
      .select('id')
      .eq('name', labelName)
      .single()

    if (!label) {
      logger.warn('Label not found', { labelName })
      return
    }

    const { error } = await supabase
      .from('mail_message_labels')
      .upsert({ message_id: messageId, label_id: label.id })

    if (error) logger.error('Failed to apply label', { err: error, messageId, labelName })
  }

  async buildSmartLabels(
    message: MailMessage,
    classification: ClassificationResult
  ): Promise<void> {
    const labelsToApply: string[] = []

    if (classification.company && LABEL_TREE[classification.company]) {
      const parentLabel = await this.ensureLabel(classification.company)
      labelsToApply.push(parentLabel.name)

      const categoryToChild = this.mapCategoryToChild(classification.category)
      if (categoryToChild && LABEL_TREE[classification.company]?.includes(categoryToChild)) {
        const childLabel = await this.ensureLabel(categoryToChild, classification.company)
        labelsToApply.push(childLabel.name)
      }
    }

    if (classification.priority === 'urgent' || classification.priority === 'high') {
      const urgentLabel = await this.ensureLabel('Urgent', 'Status')
      labelsToApply.push(urgentLabel.name)
    }

    if (classification.isInvoice) {
      const invoiceLabel = await this.ensureLabel('Te-verwerken', 'Status')
      labelsToApply.push(invoiceLabel.name)
    }

    for (const labelName of labelsToApply) {
      if (message.id) {
        await this.applyLabelToMessage(message.id, labelName)
      }
    }
  }

  private mapCategoryToChild(category: string | null): string | null {
    const mapping: Record<string, string> = {
      leverancier: 'Leveranciers',
      klant: 'Klanten',
      factuur: 'Facturen',
      belasting: 'Belasting',
      incasso: 'Incasso',
      vastgoed: 'Vastgoed',
      support: 'Support',
      automatisering: 'Automatisering',
    }
    return category ? (mapping[category] ?? null) : null
  }

  private colorForLabel(name: string): string {
    const colors: Record<string, string> = {
      STRKBEHEER: '#6366f1',
      STRKBOUW: '#f59e0b',
      BOUWPROFFS: '#10b981',
      YOUTUBE: '#ef4444',
      PRIVÉ: '#8b5cf6',
      Urgent: '#ef4444',
      Facturen: '#f59e0b',
      Leveranciers: '#3b82f6',
    }
    return colors[name] ?? '#6b7280'
  }
}
