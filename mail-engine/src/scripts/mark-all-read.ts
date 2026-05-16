/**
 * mark-all-read.ts
 * Markeert ALLE ongelezen berichten als gelezen op de IMAP-server,
 * in elke map van elk account — rechtstreeks, zonder DB tussenkomst.
 */
import 'dotenv/config'
import { supabase, MailAccount } from '../lib/supabase'
import { ImapClient } from '../imap/client'
import Imap from 'node-imap'

const imap = new ImapClient()

async function getImapAccounts(): Promise<MailAccount[]> {
  const { data, error } = await supabase
    .from('mail_accounts')
    .select('*')
    .not('imap_host', 'is', null)
    .not('imap_pass_encrypted', 'is', null)
  if (error) throw error
  return (data ?? []) as MailAccount[]
}

function getAllFolders(account: MailAccount): Promise<string[]> {
  return new Promise((resolve) => {
    const cfg = {
      host: account.imap_host!,
      port: account.imap_port ?? 993,
      tls: (account.imap_port ?? 993) === 993,
      tlsOptions: { rejectUnauthorized: false },
      user: account.imap_user ?? account.email,
      password: account.imap_pass_encrypted!,
      connTimeout: 15000,
      authTimeout: 10000,
    }
    const conn = new Imap(cfg)
    const folders: string[] = []

    conn.once('ready', () => {
      conn.getBoxes('', (err, boxes) => {
        conn.end()
        if (err) return resolve([])
        function collect(tree: Imap.MailBoxes, prefix = '') {
          for (const [key, box] of Object.entries(tree)) {
            const sep = box.delimiter ?? '.'
            const full = prefix ? `${prefix}${sep}${key}` : key
            folders.push(full)
            if (box.children) collect(box.children, full)
          }
        }
        collect(boxes)
        resolve(folders)
      })
    })

    conn.once('error', () => resolve([]))
    conn.connect()
  })
}

async function processAccount(account: MailAccount): Promise<{ marked: number; folders: number }> {
  const folders = await getAllFolders(account)
  let totalMarked = 0
  let activeFolders = 0

  for (const serverPath of folders) {
    const count = await imap.markAllReadInFolder(account, serverPath)
    if (count > 0) {
      console.log(`    ✓ ${serverPath}: ${count} gelezen`)
      totalMarked += count
      activeFolders++
    }
  }

  return { marked: totalMarked, folders: folders.length }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  ORLANDO MAIL — Mark All Read')
  console.log('  Alle IMAP-mappen, alle accounts')
  console.log('═══════════════════════════════════════════\n')

  const accounts = await getImapAccounts()
  if (accounts.length === 0) {
    console.log('Geen IMAP accounts gevonden.')
    process.exit(0)
  }

  let grandTotal = 0

  for (const account of accounts) {
    console.log(`\n→ ${account.email} (${account.imap_host})`)
    try {
      const { marked, folders } = await processAccount(account)
      console.log(`  ${folders} mappen gescand, ${marked} berichten als gelezen gemarkeerd`)
      grandTotal += marked
    } catch (err) {
      console.error(`  ✗ Fout:`, err)
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`Totaal als gelezen gemarkeerd: ${grandTotal}`)
  console.log('─────────────────────────────────────────\n')
  console.log('✅ Klaar\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatale fout:', err)
  process.exit(1)
})
