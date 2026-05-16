import 'dotenv/config'
import { supabase } from '../lib/supabase'
import { ImapClient } from '../imap/client'

async function main() {
  const imap = new ImapClient()

  const { data: accounts } = await supabase
    .from('mail_accounts')
    .select('*')
    .not('imap_host', 'is', null)
    .not('imap_pass_encrypted', 'is', null)
    .limit(1)

  const account = accounts?.[0] as any
  if (!account) { console.log('Geen accounts'); return }

  console.log(`Account  : ${account.email} (${account.imap_host})`)
  const info = await imap.getServerInfo(account)
  console.log(`Delimiter: "${info.delimiter}"`)
  console.log(`Prefix   : "${info.prefix}"`)
  console.log(`Mappen   : ${info.folders.join(', ')}`)

  console.log('\nTest: INBOX.Orlando.Facturen aanmaken...')
  await imap.ensureFolder(account, 'Orlando/Facturen')
  const after = await imap.listFolders(account)
  console.log('Na aanmaak:', after.join(', '))

  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
