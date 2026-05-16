import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { ImapClient } from '../imap/client'
import { LabelBuilder } from '../labels/builder'
import { ClassificationResult } from './classifier'
import { logger } from '../lib/logger'

const CATEGORY_FOLDER: Record<string, string> = {
  factuur:       'Facturen',
  incasso:       'Incasso',
  advocaat:      'Juridisch',
  belasting:     'Belasting',
  leverancier:   'Leveranciers',
  klant:         'Klanten',
  intern:        'Intern',
  support:       'Support',
  spam:          'Spam',
  overig:        'Overig',
}

export class MappingAgent {
  private imap = new ImapClient()
  private labels = new LabelBuilder()

  async map(
    account: MailAccount,
    message: MailMessage,
    classification: ClassificationResult
  ): Promise<void> {
    const company = message.company ?? classification.company ?? 'Overig'
    const categoryKey = message.category ?? classification.category ?? 'overig'
    const categoryFolder = CATEGORY_FOLDER[categoryKey] ?? 'Overig'
    const year = new Date(message.received_at ?? Date.now()).getFullYear().toString()

    // IMAP folder path: STRKBEHEER/Facturen/2026
    const targetFolder = `${company}/${categoryFolder}/${year}`

    await Promise.all([
      this.handleImapMapping(account, message, targetFolder),
      this.labels.buildSmartLabels(message, classification),
      this.updateMessageFolder(message.id, targetFolder),
    ])

    logger.info('MappingAgent: message mapped', {
      messageId: message.id,
      targetFolder,
      company,
      category: categoryKey,
    })
  }

  private async handleImapMapping(
    account: MailAccount,
    message: MailMessage,
    targetFolder: string
  ): Promise<void> {
    // Only IMAP accounts can do server-side folder move
    if (!account.imap_host || !account.imap_pass_encrypted) return
    if (!message.imap_uid) return

    const sourceFolder = message.imap_folder ?? 'INBOX'
    if (sourceFolder === targetFolder) return

    try {
      // Ensure all intermediate folders exist
      const parts = targetFolder.split('/')
      for (let i = 1; i <= parts.length; i++) {
        await this.imap.ensureFolder(account, parts.slice(0, i).join('/'))
      }

      await this.imap.moveMessage(account, message.imap_uid, sourceFolder, targetFolder)
    } catch (err) {
      logger.warn('MappingAgent: IMAP move skipped', { err, messageId: message.id })
    }
  }

  private async updateMessageFolder(messageId: string, folder: string): Promise<void> {
    await supabase
      .from('mail_messages')
      .update({ imap_folder: folder })
      .eq('id', messageId)
  }

  // Seed alle benodigde IMAP-mappen voor een account (run bij account setup)
  async seedFolders(account: MailAccount): Promise<void> {
    if (!account.imap_host || !account.imap_pass_encrypted) return

    const companies = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO', 'INTELLIGENCE', 'YOUTUBE', 'PRIVÉ']
    const categories = Object.values(CATEGORY_FOLDER)
    const years = ['2024', '2025', '2026']

    let created = 0
    for (const company of companies) {
      for (const category of categories) {
        for (const year of years) {
          const folder = `${company}/${category}/${year}`
          try {
            await this.imap.ensureFolder(account, folder)
            created++
          } catch {
            // non-fatal
          }
        }
      }
    }

    logger.info('MappingAgent: folder seed complete', {
      email: account.email,
      foldersAttempted: created,
    })
  }

  // Update agent stats in Supabase
  async incrementStats(success: boolean): Promise<void> {
    const { data } = await supabase
      .from('mail_agents')
      .select('stats')
      .eq('agent_type', 'mapper')
      .single()

    if (!data) return

    const stats = (data.stats as { processed?: number; errors?: number; last_run?: string }) ?? {}
    await supabase
      .from('mail_agents')
      .update({
        stats: {
          processed: (stats.processed ?? 0) + (success ? 1 : 0),
          errors: (stats.errors ?? 0) + (success ? 0 : 1),
          last_run: new Date().toISOString(),
        },
      })
      .eq('agent_type', 'mapper')
  }
}
