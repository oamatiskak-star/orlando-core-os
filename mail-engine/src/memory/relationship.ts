import { supabase, MailContact, MailMessage } from '../lib/supabase'
import { logger } from '../lib/logger'

export class RelationshipMemory {
  async getContact(email: string): Promise<MailContact | null> {
    const { data, error } = await supabase
      .from('mail_contacts')
      .select('*')
      .eq('email', email)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to get contact', { err: error, email })
    }

    return data ?? null
  }

  async upsertContact(
    email: string,
    name: string,
    data: Partial<MailContact>
  ): Promise<MailContact> {
    const existing = await this.getContact(email)

    if (existing) {
      const { data: updated, error } = await supabase
        .from('mail_contacts')
        .update({
          name: name || existing.name,
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return updated as MailContact
    }

    const { data: created, error } = await supabase
      .from('mail_contacts')
      .insert({
        email,
        name,
        ...data,
      })
      .select()
      .single()

    if (error) throw error
    return created as MailContact
  }

  async addInteraction(
    contactId: string,
    messageId: string,
    direction: 'inbound' | 'outbound',
    summary: string
  ): Promise<void> {
    const { error: interactionError } = await supabase
      .from('mail_contact_interactions')
      .insert({ contact_id: contactId, message_id: messageId, direction, summary })

    if (interactionError) {
      logger.error('Failed to add interaction', { err: interactionError, contactId, messageId })
    }

    const { error: countError } = await supabase
      .from('mail_contacts')
      .update({
        total_interactions: supabase.rpc as unknown as number,
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (countError) {
      await supabase.rpc('increment_contact_interactions', { contact_id: contactId })
    }
  }

  async getContactHistory(email: string, limit = 10): Promise<MailMessage[]> {
    const contact = await this.getContact(email)
    if (!contact) return []

    const { data, error } = await supabase
      .from('mail_contact_interactions')
      .select('message_id, mail_messages(*)')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Failed to get contact history', { err: error, email })
      return []
    }

    return (data ?? [])
      .map((row: Record<string, unknown>) => row['mail_messages'])
      .filter(Boolean) as MailMessage[]
  }

  async updateContactSentiment(contactId: string, sentiment: string): Promise<void> {
    const { error } = await supabase
      .from('mail_contacts')
      .update({ sentiment, updated_at: new Date().toISOString() })
      .eq('id', contactId)

    if (error) logger.error('Failed to update sentiment', { err: error, contactId })
  }

  async incrementOpenActions(contactId: string): Promise<void> {
    const { data } = await supabase
      .from('mail_contacts')
      .select('open_actions')
      .eq('id', contactId)
      .single()

    const current = (data as { open_actions: number } | null)?.open_actions ?? 0

    await supabase
      .from('mail_contacts')
      .update({ open_actions: current + 1, updated_at: new Date().toISOString() })
      .eq('id', contactId)
  }

  async decrementOpenActions(contactId: string): Promise<void> {
    const { data } = await supabase
      .from('mail_contacts')
      .select('open_actions')
      .eq('id', contactId)
      .single()

    const current = (data as { open_actions: number } | null)?.open_actions ?? 0

    await supabase
      .from('mail_contacts')
      .update({
        open_actions: Math.max(0, current - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
  }
}
