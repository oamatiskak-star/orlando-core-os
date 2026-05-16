/**
 * cleanup.ts
 * 1. Verwijdert spam van IMAP + DB
 * 2. Markeert niet-belangrijke mail als gelezen (IMAP + DB)
 *
 * Niet-belangrijk: automatisering, support, overig, privé
 * Spam: verwijderen
 * Belangrijk (onaangeroerd): factuur, incasso, advocaat, belasting, leverancier, klant, intern
 */
import 'dotenv/config'
import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { ImapClient } from '../imap/client'
import { logger } from '../lib/logger'

const imap = new ImapClient()

const UNIMPORTANT_CATEGORIES = new Set(['automatisering', 'support', 'overig', 'privé', 'prive'])
const SPAM_CATEGORY = 'spam'

async function getImapAccounts(): Promise<MailAccount[]> {
  const { data, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .not('imap_host', 'is', null)
    .not('imap_pass_encrypted', 'is', null)
  if (error) throw error
  return (data ?? []) as MailAccount[]
}

async function getMessagesToClean(accountId: string): Promise<MailMessage[]> {
  const { data, error } = await supabase
    .from('mail_messages')
    .select('*')
    .eq('account_id', accountId)
    .or(`category.eq.${SPAM_CATEGORY},and(is_read.eq.false,category.in.(${[...UNIMPORTANT_CATEGORIES].join(',')}))`)
    .not('imap_uid', 'is', null)
    .not('imap_folder', 'is', null)
  if (error) throw error
  return (data ?? []) as MailMessage[]
}

async function markAsReadInDb(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return
  await supabase
    .from('mail_messages')
    .update({ is_read: true })
    .in('id', messageIds)
}

async function deleteFromDb(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return
  await supabase
    .from('mail_messages')
    .delete()
    .in('id', messageIds)
}

async function cleanAccount(account: MailAccount): Promise<void> {
  const messages = await getMessagesToClean(account.id)
  if (messages.length === 0) {
    console.log(`  → ${account.email}: niets te doen`)
    return
  }

  const spam = messages.filter(m => m.category === SPAM_CATEGORY)
  const unimportant = messages.filter(m => m.category !== SPAM_CATEGORY)

  console.log(`  → ${account.email}: ${spam.length} spam te verwijderen, ${unimportant.length} als gelezen markeren`)

  let deletedOk = 0
  let markedOk = 0
  let errors = 0

  // Spam: verwijderen van IMAP + DB
  for (const msg of spam) {
    try {
      await imap.deleteFromFolder(account, msg.imap_uid!, msg.imap_folder!)
      deletedOk++
    } catch (err) {
      logger.warn('cleanup: spam delete failed', { messageId: msg.id, err })
      errors++
    }
    if ((deletedOk + errors) % 10 === 0) {
      process.stdout.write(`\r    spam: ${deletedOk} verwijderd, ${errors} fouten...`)
    }
  }
  if (spam.length > 0) {
    await deleteFromDb(spam.map(m => m.id))
    console.log(`\n  ✓ ${deletedOk} spam berichten verwijderd`)
  }

  // Niet-belangrijk: gelezen markeren op IMAP + DB
  const markedIds: string[] = []
  for (const msg of unimportant) {
    try {
      await imap.markReadInFolder(account, msg.imap_uid!, msg.imap_folder!)
      markedIds.push(msg.id)
      markedOk++
    } catch (err) {
      logger.warn('cleanup: mark read failed', { messageId: msg.id, err })
      errors++
    }
    if ((markedOk + errors) % 10 === 0) {
      process.stdout.write(`\r    gelezen: ${markedOk} gemarkeerd, ${errors} fouten...`)
    }
  }
  if (markedIds.length > 0) {
    await markAsReadInDb(markedIds)
    console.log(`\n  ✓ ${markedOk} berichten als gelezen gemarkeerd`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  ORLANDO MAIL — Cleanup')
  console.log('  Spam verwijderen + niet-belangrijk gelezen')
  console.log('═══════════════════════════════════════════\n')

  const accounts = await getImapAccounts()
  if (accounts.length === 0) {
    console.log('Geen IMAP accounts gevonden.')
    process.exit(0)
  }

  console.log(`Accounts: ${accounts.map(a => a.email).join(', ')}\n`)

  let totalSpam = 0
  let totalMarked = 0

  for (const account of accounts) {
    const before = await supabase
      .from('mail_messages')
      .select('category, count', { count: 'exact', head: false })
      .eq('account_id', account.id)
      .or(`category.eq.spam,and(is_read.eq.false,category.in.(automatisering,support,overig,privé,prive))`)

    const spamCount = (before.data ?? []).filter((r: any) => r.category === 'spam').length
    totalSpam += spamCount

    try {
      await cleanAccount(account)
    } catch (err) {
      console.error(`  ✗ Fout bij ${account.email}:`, err)
    }
  }

  console.log('\n─────────────────────────────────────────')

  const { count: remaining } = await supabase
    .from('mail_messages')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  console.log(`Ongelezen berichten resterend: ${remaining ?? 0}`)
  console.log('─────────────────────────────────────────\n')
  console.log('✅ Cleanup klaar\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatale fout:', err)
  process.exit(1)
})
