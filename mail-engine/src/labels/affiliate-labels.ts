/**
 * Affiliate-label sync voor de Account Setup Agent.
 *
 * De browser-registration runner (local-agent) kan de Gmail-API niet aanroepen
 * en zet daarom de gewenste labelnaam in `account_setup_runs.payload.gmail_label`
 * (bv. "Affiliates/TradingView Partner Program"). De Mail Agent — die wél een
 * Gmail-OAuth-account heeft — maakt het echte label aan via GmailClient,
 * spiegelt het in de app-registry (mail_labels) en markeert de run als gedaan.
 *
 * Idempotent: GmailClient.createLabel returnt een bestaand label-id zonder te
 * dupliceren; verwerkte runs krijgen payload.gmail_label_created=true.
 */
import { supabase, MailAccount } from '../lib/supabase'
import { GmailClient } from '../gmail/client'
import { LabelBuilder } from './builder'
import { logger } from '../lib/logger'

const PARENT = 'Affiliates'
const LABEL_ACCOUNT_EMAIL = process.env.GMAIL_LABEL_ACCOUNT ?? 'o.amatiskak@gmail.com'

const gmail = new GmailClient()
const labelBuilder = new LabelBuilder()

type PendingRun = { id: string; payload: Record<string, unknown> | null }

async function loadGmailAccount(): Promise<MailAccount | null> {
  // Match op e-mail + aanwezig refresh-token (account kan provider 'gmail' zijn
  // of een met Gmail-OAuth verrijkte 'imap'-rij; Gmail-API werkt zodra er tokens zijn).
  const { data } = await supabase
    .from('mail_accounts')
    .select('*')
    .eq('email', LABEL_ACCOUNT_EMAIL)
    .not('gmail_refresh_token', 'is', null)
    .maybeSingle()
  return (data as MailAccount) ?? null
}

export async function syncAffiliateLabels(): Promise<{ created: number; pending: number }> {
  const { data: runs, error } = await supabase
    .from('account_setup_runs')
    .select('id, payload')
    .eq('run_kind', 'browser_registration')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    logger.error('affiliate-labels: kon runs niet laden', { err: error })
    return { created: 0, pending: 0 }
  }

  const pending = (runs as PendingRun[] ?? []).filter(r => {
    const p = r.payload ?? {}
    return typeof p['gmail_label'] === 'string' && p['gmail_label_created'] !== true
  })
  if (pending.length === 0) return { created: 0, pending: 0 }

  const account = await loadGmailAccount()
  if (!account) {
    logger.warn(`affiliate-labels: geen gmail-account gevonden voor ${LABEL_ACCOUNT_EMAIL}`)
    return { created: 0, pending: pending.length }
  }

  // Parent-label eerst, zodat de children genest worden weergegeven.
  await gmail.createLabel(account, PARENT).catch(err => logger.warn('affiliate-labels: parent faalde', { err: String(err) }))
  await labelBuilder.ensureLabel(PARENT).catch(() => { /* registry-spiegel best-effort */ })

  let created = 0
  for (const run of pending) {
    const full = String((run.payload ?? {})['gmail_label']) // "Affiliates/<programma>"
    try {
      const gmailId = await gmail.createLabel(account, full)
      const childName = full.startsWith(`${PARENT}/`) ? full.slice(PARENT.length + 1) : full
      await labelBuilder.ensureLabel(childName, PARENT).catch(() => { /* registry best-effort */ })

      const newPayload = { ...(run.payload ?? {}), gmail_label_created: true, gmail_label_id: gmailId }
      await supabase.from('account_setup_runs').update({ payload: newPayload }).eq('id', run.id)

      created++
      logger.info('affiliate-labels: label klaar', { full, gmailId })
    } catch (err) {
      logger.error('affiliate-labels: aanmaken faalde', { full, err: String(err) })
    }
  }
  return { created, pending: pending.length }
}
