/**
 * ingest-important.ts
 * Haalt berichten op uit INBOX per account (laatste 60 dagen),
 * klasseert via AI en slaat op in DB — geen IMAP-verplaatsingen.
 * Daarna: concept-antwoorden voor zakelijk belangrijke categorieën.
 */
import 'dotenv/config'
import { supabase, MailAccount, MailMessage } from '../lib/supabase'
import { ImapClient } from '../imap/client'
import { AiClassifier } from '../ai/classifier'
import { SpamDetector } from '../spam/detector'
import { RelationshipMemory } from '../memory/relationship'
import { ReplyGenerator } from '../ai/reply-generator'
import { logger } from '../lib/logger'

const imapClient = new ImapClient()
const classifier = new AiClassifier()
const spamDet    = new SpamDetector()
const relMem     = new RelationshipMemory()
const replyGen   = new ReplyGenerator()

const IMPORTANT_CATEGORIES = ['factuur', 'incasso', 'advocaat', 'belasting', 'leverancier', 'klant', 'intern']
const SINCE_DAYS  = 60
const ACCOUNT_TIMEOUT_MS         = 90_000  // 1.5 min — Plesk/Gmail
const ACCOUNT_TIMEOUT_ICLOUD_MS  = 300_000 // 5 min  — iCloud SINCE queries zijn traag

function detectCompany(toEmails: string[], accountEmail: string): string {
  const text = [...toEmails, accountEmail].join(' ').toLowerCase()
  if (text.includes('strkbeheer'))   return 'STRKBEHEER'
  if (text.includes('strkbouw'))     return 'STRKBOUW'
  if (text.includes('bouwproffs'))   return 'BOUWPROFFS'
  if (text.includes('modiwerijo'))   return 'MODIWERIJO'
  if (text.includes('aquier'))       return 'INTELLIGENCE'
  if (text.includes('youtube') || text.includes('vermogen')) return 'YOUTUBE'
  return 'PRIVÉ'
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout na ${ms}ms — ${label}`)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) }
    )
  })
}

async function ingestAccount(account: MailAccount): Promise<{ fetched: number; ingested: number }> {
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 3600 * 1000)
  let totalFetched = 0, totalIngested = 0

  const host = account.imap_host ?? ''
  const isIcloud = host.includes('icloud') || host.includes('me.com')

  let messages: Awaited<ReturnType<typeof imapClient.fetchAllFromFolder>>

  if (isIcloud) {
    // iCloud: full-body fetch hangs — use two-pass: headers first, then body only for recent ones
    let headers: Awaited<ReturnType<typeof imapClient.fetchHeadersFromFolder>>
    try {
      headers = await withTimeout(
        imapClient.fetchHeadersFromFolder(account, 'INBOX', 100),
        ACCOUNT_TIMEOUT_ICLOUD_MS,
        `${account.email} (headers)`
      )
    } catch (err) {
      console.log(`  ⚠ ${(err as Error).message}`)
      return { fetched: 0, ingested: 0 }
    }

    // Filter to last 60 days in JS
    const recentHeaders = headers.filter(h => !h.date || h.date >= since)
    if (recentHeaders.length === 0) {
      console.log('  Geen recente berichten in INBOX (laatste 60 dagen)')
      return { fetched: 0, ingested: 0 }
    }

    console.log(`  INBOX: ${headers.length} totaal, ${recentHeaders.length} in laatste ${SINCE_DAYS} dagen`)

    // Full body only for recent messages
    const recentUids = recentHeaders.map(h => h.uid)
    try {
      messages = await withTimeout(
        imapClient.fetchMessageBodies(account, 'INBOX', recentUids),
        ACCOUNT_TIMEOUT_ICLOUD_MS,
        `${account.email} (bodies)`
      )
    } catch (err) {
      console.log(`  ⚠ ${(err as Error).message}`)
      return { fetched: 0, ingested: 0 }
    }
  } else {
    // Gmail/Plesk: direct SINCE-filtered fetch
    try {
      messages = await withTimeout(
        imapClient.fetchAllFromFolder(account, 'INBOX', since, 300),
        ACCOUNT_TIMEOUT_MS,
        account.email
      )
    } catch (err) {
      console.log(`  ⚠ ${(err as Error).message}`)
      return { fetched: 0, ingested: 0 }
    }
  }

  if (messages.length === 0) {
    if (!isIcloud) console.log('  Geen berichten in INBOX (laatste 60 dagen)')
    return { fetched: 0, ingested: 0 }
  }

  totalFetched = messages.length
  if (!isIcloud) console.log(`  INBOX: ${messages.length} berichten gevonden`)

  for (const { uid, parsedMail } of messages) {
    try {
      const { data: existing } = await supabase
        .from('mail_messages')
        .select('id')
        .eq('account_id', account.id)
        .eq('imap_uid', uid)
        .eq('imap_folder', 'INBOX')
        .maybeSingle()
      if (existing) continue

      const subject    = parsedMail.subject ?? ''
      const fromEmail  = parsedMail.from?.value?.[0]?.address ?? ''
      const fromName   = parsedMail.from?.value?.[0]?.name ?? null
      const toEmails   = (parsedMail.to
        ? Array.isArray(parsedMail.to) ? parsedMail.to : [parsedMail.to]
        : []
      ).flatMap(a => a.value.map(v => v.address ?? '')).filter(Boolean)
      const bodyText   = parsedMail.text ?? ''
      const receivedAt = parsedMail.date?.toISOString() ?? new Date().toISOString()

      const [cls, spam] = await Promise.all([
        classifier.classify(subject, fromEmail, bodyText),
        spamDet.analyze(fromEmail, subject, bodyText,
          (parsedMail.attachments ?? []).map(a => ({
            filename: a.filename ?? 'att',
            mimeType: a.contentType,
            size: a.size ?? 0,
          }))
        ),
      ])

      const finalCategory = cls.category
      const finalCompany  = cls.company || detectCompany(toEmails, account.email)
      const finalPriority = spam.isThreat ? 'spam' : cls.priority

      const { error: insErr } = await supabase
        .from('mail_messages')
        .insert({
          account_id:           account.id,
          imap_uid:             uid,
          imap_folder:          'INBOX',
          provider:             account.provider,
          subject,
          from_email:           fromEmail,
          from_name:            fromName,
          to_emails:            toEmails,
          cc_emails:            [],
          body_text:            bodyText,
          body_html:            parsedMail.html || '',
          received_at:          receivedAt,
          is_read:              true,
          company:              finalCompany,
          category:             finalCategory,
          priority:             finalPriority,
          ai_summary:           cls.summary,
          ai_action_suggestion: cls.actionSuggestion,
          ai_confidence:        cls.confidence,
          spam_score:           spam.score,
          threat_detected:      spam.isThreat,
          threat_reason:        spam.reason ?? null,
          moneybird_status:     cls.isInvoice ? 'pending' : 'n_a',
          processed_at:         new Date().toISOString(),
        })

      if (!insErr) {
        totalIngested++
        if (IMPORTANT_CATEGORIES.includes(finalCategory)) {
          console.log(`    ★ [${finalCategory}] ${fromName ?? fromEmail} — ${subject.substring(0, 55)}`)
        }
      }
    } catch (err) {
      logger.warn('ingest: msg error', { uid, err })
    }
  }

  return { fetched: totalFetched, ingested: totalIngested }
}

async function generateMissingDrafts(): Promise<number> {
  const { data: messages } = await supabase
    .from('mail_messages')
    .select('*')
    .in('category', IMPORTANT_CATEGORIES)
    .not('from_email', 'is', null)
    .order('received_at', { ascending: false })
    .limit(100)

  if (!messages || messages.length === 0) {
    console.log('  Geen belangrijke berichten in DB.\n')
    return 0
  }

  const messageIds = (messages as MailMessage[]).map(m => m.id)
  const { data: existingDrafts } = await supabase
    .from('mail_drafts')
    .select('message_id')
    .in('message_id', messageIds)

  const draftedIds = new Set((existingDrafts ?? []).map((d: { message_id: string }) => d.message_id))
  const needsDraft = (messages as MailMessage[]).filter(m => !draftedIds.has(m.id))

  if (needsDraft.length === 0) {
    console.log('  Alle belangrijke berichten hebben al een concept.\n')
    return 0
  }

  console.log(`  ${needsDraft.length} berichten zonder concept:\n`)
  let generated = 0

  for (const msg of needsDraft) {
    try {
      const contact = await relMem.getContact(msg.from_email!)
      const history = await relMem.getContactHistory(msg.from_email!, 5)
      const draft   = await replyGen.generateReply(msg, contact, history)

      if (draft.confidence > 0.2) {
        await supabase.from('mail_drafts').insert({
          message_id:    msg.id,
          to_email:      msg.from_email,
          from_email:    msg.to_emails?.[0] ?? null,
          subject:       draft.subject,
          body:          draft.body,
          status:        'pending',
          ai_reasoning:  draft.reasoning,
          ai_confidence: draft.confidence,
          send_via:      'mailtrap_live',
        })

        const date = msg.received_at ? new Date(msg.received_at).toLocaleDateString('nl-NL') : '?'
        console.log(`  ✓ [${(msg.category ?? '').toUpperCase()}] ${date} — ${msg.from_name ?? msg.from_email}`)
        console.log(`    Onderwerp: ${(msg.subject ?? '').substring(0, 70)}`)
        console.log(`    Samenvatting: ${msg.ai_summary ?? 'n.v.t.'}`)
        console.log(`    Actie: ${msg.ai_action_suggestion ?? 'n.v.t.'}`)
        console.log()
        console.log(`    CONCEPT:`)
        console.log(`    Onderwerp: ${draft.subject}`)
        console.log(`    ──────────────────────────────────────────`)
        console.log(draft.body.split('\n').map(l => `    ${l}`).join('\n'))
        console.log(`    ──────────────────────────────────────────`)
        if (draft.suggestedAttachments.length > 0) {
          console.log(`    Bijlagen: ${draft.suggestedAttachments.join(', ')}`)
        }
        console.log()
        generated++
      }
    } catch (err) {
      logger.warn('draft gen failed', { messageId: msg.id, err })
    }
  }

  return generated
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  ORLANDO MAIL — Ingest Belangrijke Mails')
  console.log(`  Periode: laatste ${SINCE_DAYS} dagen | INBOX-only | Snel`)
  console.log('═══════════════════════════════════════════\n')

  const accounts = await getImapAccounts()
  console.log(`Accounts: ${accounts.map(a => a.email).join(', ')}\n`)

  console.log('── Stap 1: INBOX ophalen + classificeren ──')
  let totalFetched = 0, totalIngested = 0

  for (const account of accounts) {
    console.log(`\n→ ${account.email}`)
    try {
      const r = await ingestAccount(account)
      totalFetched  += r.fetched
      totalIngested += r.ingested
      console.log(`  Totaal: ${r.fetched} opgehaald, ${r.ingested} nieuw ingested`)
    } catch (err) {
      console.error(`  ✗ Fout:`, (err as Error).message)
    }
  }

  console.log(`\nTotaal alle accounts: ${totalFetched} opgehaald, ${totalIngested} nieuw ingested\n`)

  // DB-categorieoverzicht
  const { data: allMsgs } = await supabase.from('mail_messages').select('category')
  if (allMsgs) {
    const counts: Record<string, number> = {}
    for (const { category } of allMsgs) {
      const c = category ?? 'onbekend'
      counts[c] = (counts[c] ?? 0) + 1
    }
    console.log('── DB-overzicht categorieën ──')
    for (const [cat, cnt] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      const mark = IMPORTANT_CATEGORIES.includes(cat) ? ' ← ACTIE VEREIST' : ''
      console.log(`  ${cnt.toString().padStart(3)} ${cat}${mark}`)
    }
    console.log()
  }

  console.log('── Stap 2: Concept-antwoorden genereren ──')
  const generated = await generateMissingDrafts()

  const { count } = await supabase
    .from('mail_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  console.log(`─────────────────────────────────────────`)
  console.log(`Nieuwe concepten aangemaakt: ${generated}`)
  console.log(`Totaal openstaande concepten: ${count ?? 0}`)
  console.log(`─────────────────────────────────────────\n`)
  console.log('✅ Klaar\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatale fout:', err)
  process.exit(1)
})
