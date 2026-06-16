/**
 * Affiliate approval-watcher (Mail Agent).
 *
 * Scant het Gmail-account op goedkeurings-/afwijzingsmails van broker-/affiliate-
 * netwerken (Impact, Webull, M1, Robinhood, …) en acteert:
 *  - GOEDGEKEURD → affiliate_programs.account_status='active' + approval_status='approved'.
 *    Dat vuurt de bestaande affiliate_go_live()-trigger (link-generatie + ranking + recs),
 *    waarna de upload-worker de link automatisch in de beschrijvingen injecteert.
 *  - AFGEWEZEN   → approval_status='rejected' (zichtbaar in v_affiliate_activation_center).
 *
 * Idempotent: reeds approved/rejected/active programma's worden overgeslagen, dus dezelfde
 * mail triggert nooit dubbel. Best-effort: fouten breken de mail-cyclus niet.
 */
import { supabase, MailAccount } from '../lib/supabase'
import { GmailClient } from '../gmail/client'
import { logger } from '../lib/logger'

const ACCOUNT_EMAIL = process.env.GMAIL_LABEL_ACCOUNT ?? 'o.amatiskak@gmail.com'
const gmail = new GmailClient()

const APPROVE = /(approved|accepted|welcome aboard|congratulations|you'?re in|you have been approved|application[^.]{0,40}(approved|accepted)|approved to (join|promote)|partnership.{0,20}(active|live))/i
const REJECT = /(declined|rejected|not approved|unfortunately|unable to approve|application[^.]{0,40}(declined|rejected|denied)|we'?re unable to)/i

// Beperk de scan tot relevante afzenders/onderwerpen (laatste 45 dagen).
const SEARCH_Q = "newer_than:45d (from:impact.com OR from:webull OR from:webullapp.com OR from:m1.com OR from:m1finance.com OR from:robinhood.com OR subject:affiliate OR subject:partner OR subject:application)"

function header(msg: { payload?: { headers?: { name?: string; value?: string }[] } }, name: string): string {
  const h = (msg?.payload?.headers ?? []).find((x) => (x.name || '').toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

// Token per programma uit de naam (eerste betekenisvolle woord): "M1 Finance Affiliate" -> "m1".
function tokenOf(name: string): string {
  return String(name).toLowerCase().replace(/affiliate.*|partner.*|program.*/g, '').trim().split(/\s+/)[0] ?? ''
}

export async function watchAffiliateApprovals(): Promise<{ approved: number; rejected: number; scanned: number }> {
  const { data: acc } = await supabase
    .from('mail_accounts').select('*')
    .eq('email', ACCOUNT_EMAIL).not('gmail_refresh_token', 'is', null).maybeSingle()
  const account = acc as MailAccount | null
  if (!account) { logger.warn(`approval-watcher: geen gmail-account voor ${ACCOUNT_EMAIL}`); return { approved: 0, rejected: 0, scanned: 0 } }

  const { data: progs } = await supabase
    .from('affiliate_programs').select('id, name, approval_status, account_status')
  const pending = (progs ?? []).filter((p: { approval_status?: string; account_status?: string }) => {
    const a = String(p.approval_status || '').toLowerCase()
    const s = String(p.account_status || '').toLowerCase()
    return a !== 'approved' && a !== 'rejected' && s !== 'active'
  }) as { id: string; name: string }[]
  if (pending.length === 0) return { approved: 0, rejected: 0, scanned: 0 }

  let msgs: { snippet?: string; payload?: { headers?: { name?: string; value?: string }[] } }[] = []
  try { msgs = await gmail.fetchMessages(account, 40, SEARCH_Q) }
  catch (e) { logger.error('approval-watcher: gmail-fetch faalde', { e: String(e) }); return { approved: 0, rejected: 0, scanned: 0 } }

  let approved = 0, rejected = 0
  for (const msg of msgs) {
    const blob = `${header(msg, 'From')} ${header(msg, 'Subject')} ${msg.snippet ?? ''}`.toLowerCase()
    const isApp = APPROVE.test(blob), isRej = REJECT.test(blob)
    if (!isApp && !isRej) continue
    const prog = pending.find((p) => { const t = tokenOf(p.name); return t.length >= 2 && blob.includes(t) })
    if (!prog) continue
    try {
      if (isApp && !isRej) {
        await supabase.from('affiliate_programs').update({ approval_status: 'approved', account_status: 'active', updated_at: new Date().toISOString() }).eq('id', prog.id)
        logger.info(`approval-watcher: ${prog.name} GOEDGEKEURD → go-live`, { subject: header(msg, 'Subject') })
        approved++
      } else {
        await supabase.from('affiliate_programs').update({ approval_status: 'rejected', updated_at: new Date().toISOString() }).eq('id', prog.id)
        logger.info(`approval-watcher: ${prog.name} AFGEWEZEN`, { subject: header(msg, 'Subject') })
        rejected++
      }
      pending.splice(pending.indexOf(prog), 1) // niet dubbel verwerken binnen dezelfde run
    } catch (e) { logger.error(`approval-watcher: update ${prog.name} faalde`, { e: String(e) }) }
  }
  if (approved || rejected) logger.info(`approval-watcher: ${approved} goedgekeurd, ${rejected} afgewezen (gescand: ${msgs.length})`)
  return { approved, rejected, scanned: msgs.length }
}
