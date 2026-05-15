import { supabase, MailAccount } from '../lib/supabase'
import { GmailClient } from '../gmail/client'
import { IntakeProcessor } from '../intake/processor'
import { logger } from '../lib/logger'

const gmailClient = new GmailClient()
const intakeProcessor = new IntakeProcessor()

export async function syncAllAccounts(): Promise<void> {
  const { data: accounts, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .eq('provider', 'gmail')
    .neq('sync_status', 'syncing')

  if (error) {
    logger.error('Failed to fetch mail accounts', { err: error })
    return
  }

  if (!accounts || accounts.length === 0) {
    logger.info('No Gmail accounts configured')
    return
  }

  for (const account of accounts as MailAccount[]) {
    await syncAccount(account)
  }
}

async function syncAccount(account: MailAccount): Promise<void> {
  logger.info(`Syncing account ${account.email}`)

  await supabase
    .from('mail_accounts')
    .update({ sync_status: 'syncing' })
    .eq('id', account.id)

  try {
    const messages = await gmailClient.fetchMessages(account, 50)
    logger.info(`Fetched ${messages.length} messages for ${account.email}`)

    let processed = 0
    let errors = 0

    for (const msg of messages) {
      try {
        await intakeProcessor.processIncomingMessage(account, msg)
        processed++
      } catch (err) {
        errors++
        logger.error('Failed to process message', { err, messageId: msg.id, account: account.email })
      }
    }

    await supabase
      .from('mail_accounts')
      .update({
        sync_status: 'idle',
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', account.id)

    logger.info(`Sync complete for ${account.email}`, { processed, errors })
  } catch (err) {
    logger.error(`Sync failed for ${account.email}`, { err })

    await supabase
      .from('mail_accounts')
      .update({ sync_status: 'error' })
      .eq('id', account.id)
  }
}
