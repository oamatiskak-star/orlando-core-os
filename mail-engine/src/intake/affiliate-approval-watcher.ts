/**
 * Affiliate approval-watcher (Mail Agent) — IMAP-pad.
 *
 * Leest ongelezen mail via IMAP (onafhankelijk van de Gmail-OAuth, die invalid_request
 * geeft) en acteert op goedkeurings-/afwijzingsmails van broker-/affiliate-netwerken
 * (Impact, Webull, M1, Robinhood, …):
 *  - GOEDGEKEURD → affiliate_programs.account_status='active' + approval_status='approved'.
 *    Dat vuurt de bestaande affiliate_go_live()-trigger (link-generatie + ranking), waarna
 *    de upload-worker de link automatisch in de beschrijvingen injecteert.
 *  - AFGEWEZEN   → approval_status='rejected' (zichtbaar in v_affiliate_activation_center).
 *
 * Idempotent: reeds approved/rejected/active programma's worden overgeslagen, dus dezelfde
 * (ongelezen) mail triggert nooit dubbel. Best-effort: fouten breken de mail-cyclus niet.
 * Markeert niets als gelezen — dat laat ik aan jou/de bestaande mailsync.
 */
import { supabase, MailAccount } from '../lib/supabase'
import { ImapClient } from '../imap/client'
import { logger } from '../lib/logger'

const ACCOUNT_EMAIL = process.env.GMAIL_LABEL_ACCOUNT ?? 'o.amatiskak@gmail.com'
const imap = new ImapClient()

const APPROVE = /(approved|accepted|welcome aboard|congratulations|you'?re in|you have been approved|application[^.]{0,40}(approved|accepted)|approved to (join|promote)|partnership.{0,20}(active|live))/i
const REJECT = /(declined|rejected|not approved|unfortunately|unable to approve|application[^.]{0,40}(declined|rejected|denied)|we'?re unable to)/i

// Afzender-/onderwerp-hint dat een mail relevant is (broker/affiliate). Houdt de scan goedkoop.
const RELEVANT = /(impact|webull|m1 ?finance|m1\.com|robinhood|affiliate|partner|application|payout)/i

// Token per programma uit de naam (eerste betekenisvolle woord): "M1 Finance Affiliate" -> "m1".
function tokenOf(name: string): string {
  return String(name).toLowerCase().replace(/affiliate.*|partner.*|program.*/g, '').trim().split(/\s+/)[0] ?? ''
}

export async function watchAffiliateApprovals(): Promise<{ approved: number; rejected: number; scanned: number }> {
  const { data: acc } = await supabase
    .from('mail_accounts').select('*')
    .eq('email', ACCOUNT_EMAIL).not('imap_host', 'is', null).maybeSingle()
  const account = acc as MailAccount | null
  if (!account) { logger.warn(`approval-watcher: geen IMAP-account voor ${ACCOUNT_EMAIL}`); return { approved: 0, rejected: 0, scanned: 0 } }

  const { data: progs } = await supabase
    .from('affiliate_programs').select('id, name, approval_status, account_status')
  const pending = (progs ?? []).filter((p: { approval_status?: string; account_status?: string }) => {
    const a = String(p.approval_status || '').toLowerCase()
    const s = String(p.account_status || '').toLowerCase()
    return a !== 'approved' && a !== 'rejected' && s !== 'active'
  }) as { id: string; name: string }[]
  if (pending.length === 0) return { approved: 0, rejected: 0, scanned: 0 }

  let msgs: { parsedMail: { from?: { text?: string }; subject?: string; text?: string } }[] = []
  try { msgs = await imap.fetchUnread(account, 60) }
  catch (e) { logger.error('approval-watcher: IMAP-fetch faalde', { e: String(e) }); return { approved: 0, rejected: 0, scanned: 0 } }

  let approved = 0, rejected = 0
  for (const msg of msgs) {
    const pm = msg.parsedMail ?? {}
    const from = pm.from?.text ?? ''
    const subject = pm.subject ?? ''
    const blob = `${from} ${subject} ${(pm.text ?? '').slice(0, 600)}`.toLowerCase()
    if (!RELEVANT.test(blob)) continue
    const isApp = APPROVE.test(blob), isRej = REJECT.test(blob)
    if (!isApp && !isRej) continue
    const prog = pending.find((p) => { const t = tokenOf(p.name); return t.length >= 2 && blob.includes(t) })
    if (!prog) continue
    try {
      if (isApp && !isRej) {
        await supabase.from('affiliate_programs').update({ approval_status: 'approved', account_status: 'active', updated_at: new Date().toISOString() }).eq('id', prog.id)
        logger.info(`approval-watcher: ${prog.name} GOEDGEKEURD → go-live`, { subject })
        approved++
      } else {
        await supabase.from('affiliate_programs').update({ approval_status: 'rejected', updated_at: new Date().toISOString() }).eq('id', prog.id)
        logger.info(`approval-watcher: ${prog.name} AFGEWEZEN`, { subject })
        rejected++
      }
      pending.splice(pending.indexOf(prog), 1) // niet dubbel binnen dezelfde run
    } catch (e) { logger.error(`approval-watcher: update ${prog.name} faalde`, { e: String(e) }) }
  }
  if (approved || rejected) logger.info(`approval-watcher: ${approved} goedgekeurd, ${rejected} afgewezen (gescand: ${msgs.length})`)
  return { approved, rejected, scanned: msgs.length }
}
