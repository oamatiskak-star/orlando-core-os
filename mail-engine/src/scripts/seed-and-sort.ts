/**
 * seed-and-sort.ts
 * 1. Maakt IMAP-mappenstructuur aan voor alle accounts
 * 2. Sorteert alle bestaande berichten naar de juiste map
 */
import 'dotenv/config'
import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { MappingAgent } from '../ai/mapping-agent'
import { ClassificationResult } from '../ai/classifier'
import { logger } from '../lib/logger'

const mappingAgent = new MappingAgent()

const CATEGORY_FROM_DB: Record<string, string> = {
  factuur: 'factuur', incasso: 'incasso', advocaat: 'advocaat',
  belasting: 'belasting', leverancier: 'leverancier', klant: 'klant',
  intern: 'intern', support: 'support', spam: 'spam', overig: 'overig',
}

function classificationFromMessage(msg: MailMessage): ClassificationResult {
  return {
    company:         msg.company ?? 'PRIVE',
    category:        CATEGORY_FROM_DB[msg.category ?? ''] ?? 'overig',
    priority:        msg.priority ?? 'normal',
    isInvoice:       msg.category === 'factuur',
    isLegalNotice:   msg.category === 'advocaat' || msg.category === 'incasso',
    summary:         msg.ai_summary ?? '',
    actionSuggestion: '',
    confidence:      msg.ai_confidence ?? 0.8,
    hasAgendaRequest: false,
  }
}

async function getImapAccounts(): Promise<MailAccount[]> {
  const { data, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .not('imap_host', 'is', null)
    .not('imap_pass_encrypted', 'is', null)

  if (error) throw error
  return (data ?? []) as MailAccount[]
}

async function getAllMessages(accountId: string): Promise<MailMessage[]> {
  const { data, error } = await supabase
    .from('mail_messages')
    .select('*')
    .eq('account_id', accountId)
    .order('received_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MailMessage[]
}

async function seedFoldersForAllAccounts(accounts: MailAccount[]) {
  console.log(`\n📁 STAP 1: Mappen aanmaken voor ${accounts.length} IMAP account(s)\n`)

  for (const account of accounts) {
    console.log(`  → ${account.email} (${account.imap_host})`)
    try {
      await mappingAgent.seedFolders(account)
      console.log(`  ✓ Mappen aangemaakt voor ${account.email}`)
    } catch (err) {
      console.error(`  ✗ Fout bij ${account.email}:`, err)
    }
  }
}

async function sortAllMessages(accounts: MailAccount[]) {
  console.log(`\n📨 STAP 2: Berichten sorteren\n`)

  let totalMoved = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const account of accounts) {
    const messages = await getAllMessages(account.id)
    console.log(`  → ${account.email}: ${messages.length} berichten`)

    let moved = 0
    let skipped = 0
    let errors = 0

    for (const message of messages) {
      const classification = classificationFromMessage(message)
      const company = (message.company ?? classification.company ?? 'Overig').normalize('NFD').replace(/[̀-ͯ]/g, '')
      const categoryKey = message.category ?? 'overig'
      const categoryFolder: Record<string, string> = {
        factuur: 'Facturen', incasso: 'Incasso', advocaat: 'Juridisch',
        belasting: 'Belasting', leverancier: 'Leveranciers', klant: 'Klanten',
        intern: 'Intern', support: 'Support', spam: 'Spam', overig: 'Overig',
      }
      const year = new Date(message.received_at ?? Date.now()).getFullYear().toString()
      const targetFolder = `${company}/${categoryFolder[categoryKey] ?? 'Overig'}/${year}`

      // Skip als al in de juiste map
      if (message.imap_folder === targetFolder) {
        skipped++
        continue
      }

      // Skip als geen IMAP UID (Gmail of onbekend)
      if (!message.imap_uid) {
        skipped++
        continue
      }

      try {
        await mappingAgent.map(account, message, classification)
        moved++

        // Progress elke 10 berichten
        if ((moved + errors) % 10 === 0) {
          process.stdout.write(`\r    ${moved} verplaatst, ${errors} fouten, ${skipped} overgeslagen...`)
        }
      } catch (err) {
        errors++
        logger.warn('Sort failed', { messageId: message.id, err })
      }
    }

    console.log(`\n  ✓ ${account.email}: ${moved} verplaatst, ${skipped} overgeslagen, ${errors} fouten`)
    totalMoved += moved
    totalSkipped += skipped
    totalErrors += errors
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`Totaal verplaatst : ${totalMoved}`)
  console.log(`Overgeslagen      : ${totalSkipped}`)
  console.log(`Fouten            : ${totalErrors}`)
  console.log(`─────────────────────────────────────────\n`)
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  ORLANDO MAIL — Folder Seed & Sort')
  console.log('═══════════════════════════════════════════')

  const accounts = await getImapAccounts()

  if (accounts.length === 0) {
    console.log('Geen IMAP accounts gevonden.')
    process.exit(0)
  }

  console.log(`\nAccounts gevonden: ${accounts.map(a => a.email).join(', ')}`)

  await seedFoldersForAllAccounts(accounts)
  await sortAllMessages(accounts)

  console.log('✅ Klaar\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatale fout:', err)
  process.exit(1)
})
