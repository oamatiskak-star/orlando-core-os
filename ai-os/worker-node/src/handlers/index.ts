import { complete } from '../router-client.js'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export type TaskHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>

const handlers: Record<string, TaskHandler> = {
  // ── AI inference passthrough ────────────────────────────────────────────
  'ai.complete': async payload => {
    const r = await complete({
      tier: payload.tier as string | undefined,
      model: payload.model as string | undefined,
      provider: payload.provider as string | undefined,
      messages: (payload.messages as { role: 'user' | 'system' | 'assistant'; content: string }[]) ?? [],
      system: payload.system as string | undefined,
      maxTokens: payload.maxTokens as number | undefined,
      temperature: payload.temperature as number | undefined,
      jsonMode: Boolean(payload.jsonMode),
      caller: (payload.caller as string) ?? 'worker',
    })
    return { ...r }
  },

  // ── Bulk text classification ────────────────────────────────────────────
  'classify.text': async payload => {
    const text = String(payload.text ?? '')
    const labels = (payload.labels as string[]) ?? []
    if (labels.length === 0) throw new Error('labels required')
    const r = await complete({
      tier: 'classification',
      localOnly: true,
      jsonMode: true,
      messages: [
        {
          role: 'user',
          content:
            `Classify the text below. Choose exactly ONE label from: ${JSON.stringify(labels)}.\n` +
            `Respond as JSON: {"label":"...","confidence":0-1}\n\nTEXT:\n${text}`,
        },
      ],
      caller: 'classify.text',
    })
    return { result: JSON.parse(r.text) }
  },

  // ── Mail triage (local-first, Llama) ────────────────────────────────────
  'mail.triage': async payload => {
    const subject = String(payload.subject ?? '')
    const body = String(payload.body ?? '').slice(0, 8000)
    const r = await complete({
      tier: 'classification',
      localOnly: true,
      jsonMode: true,
      messages: [
        {
          role: 'user',
          content:
            'Triage this email. Respond JSON: ' +
            '{"category":"invoice|legal|customer|spam|internal|other","priority":"low|medium|high","summary":"one line"}\n\n' +
            `SUBJECT: ${subject}\nBODY:\n${body}`,
        },
      ],
      caller: 'mail.triage',
    })
    return { triage: JSON.parse(r.text) }
  },

  // ── Code refactor (local DeepSeek-R1 preferred) ─────────────────────────
  'code.refactor': async payload => {
    const code = String(payload.code ?? '')
    const goal = String(payload.goal ?? 'clean up and document this code')
    const r = await complete({
      tier: 'coding',
      messages: [
        { role: 'system', content: 'You are a senior software engineer. Refactor the given code to meet the goal. Return only the new code, no commentary.' },
        { role: 'user', content: `GOAL: ${goal}\n\nCODE:\n${code}` },
      ],
      maxTokens: 4096,
      caller: 'code.refactor',
    })
    return { code: r.text, model: r.model, provider: r.provider }
  },

  // ── Document summarization ──────────────────────────────────────────────
  'doc.summarize': async payload => {
    const text = String(payload.text ?? '').slice(0, 32000)
    const r = await complete({
      tier: 'general',
      messages: [
        { role: 'system', content: 'Summarize the document in 5 concise bullet points and one one-line tldr. Dutch language.' },
        { role: 'user', content: text },
      ],
      maxTokens: 800,
      caller: 'doc.summarize',
    })
    return { summary: r.text, tokens: r.outputTokens }
  },

  // ── Finance: Mail document classificatie ────────────────────────────────
  'finance.mail.classify': async payload => {
    const subject     = String(payload.subject ?? '')
    const body        = String(payload.body ?? '').slice(0, 3000)
    const senderEmail = String(payload.sender_email ?? '')
    const senderName  = String(payload.sender_name  ?? '')

    const prompt = `Je bent een Nederlandse boekhouder. Analyseer dit e-mailbericht en extraheer financiële informatie.

AFZENDER: ${senderName} <${senderEmail}>
ONDERWERP: ${subject}
INHOUD: ${body}

Geef uitsluitend geldige JSON:
{"supplier":"naam","invoice_total":0,"vat":0,"category":"AI Software|Hosting|Bouwmaterialen|Marketing|Abonnement|Overig","confidence":85,"company":"STRKBEHEER|STRKBOUW|BOUWPROFFS|MODIWERIJO|ONBEKEND","is_duplicate":false,"is_subscription":false,"ubl_detected":false,"payment_reminder":false,"contract_detected":false}`

    const r = await complete({
      tier:     'general',
      jsonMode: true,
      messages: [{ role: 'user', content: prompt }],
      caller:   'finance.mail.classify',
    })

    let doc: Record<string, unknown>
    try { doc = JSON.parse(r.text) } catch { doc = { confidence: 0 } }

    // Sla op als mail_finance_intake als confidence hoog genoeg
    if ((doc.confidence as number) >= 60 && payload.message_id) {
      await supabaseAdmin.from('mail_messages').update({
        category:          'factuur',
        moneybird_status:  'pending',
        ai_confidence:     doc.confidence,
        ai_summary:        `${doc.supplier}: €${doc.invoice_total} (${doc.category})`,
      }).eq('id', payload.message_id as string)
    }

    return { document: doc, model: r.model }
  },

  // ── Finance: Moneybird sync trigger ─────────────────────────────────────
  'finance.moneybird.sync': async payload => {
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? ''
    const companyId = String(payload.company_id ?? 'STRKBEHEER')
    const syncType  = String(payload.sync_type  ?? 'volledig')

    const res = await fetch(`${baseUrl}/api/finance/moneybird/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company_id: companyId, sync_type: syncType }),
    })

    const result = await res.json()
    return { success: res.ok, ...result }
  },

  // ── Finance: CFO dagelijkse analyse ─────────────────────────────────────
  'finance.cfo.analyze': async payload => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? ''
    const now     = new Date()

    const res = await fetch(`${baseUrl}/api/finance/cfo/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        period_year:     payload.year  ?? now.getFullYear(),
        period_month:    payload.month ?? now.getMonth() + 1,
        generate_report: payload.generate_report ?? false,
      }),
    })

    const result = await res.json()
    return { success: res.ok, ...result }
  },

  // ── Finance: Belasting deadline check ───────────────────────────────────
  'finance.tax.check': async payload => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? ''
    const companyIds = (payload.company_ids as string[]) ?? ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO']

    const { data: taxRows } = await supabaseAdmin
      .from('cfo_tax_reservations')
      .select('*')
      .in('company_id', companyIds)
      .in('status', ['open', 'gereserveerd'])
      .not('deadline', 'is', null)

    const today  = new Date()
    const alerts = []

    for (const row of taxRows ?? []) {
      const deadline = new Date(row.deadline)
      const days     = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const gap      = row.amount_required - row.amount_reserved

      if (days <= 14 || (deadline < today)) {
        alerts.push({
          company_id: row.company_id,
          tax_type:   row.tax_type,
          deadline:   row.deadline,
          days_left:  days,
          gap,
          severity:   deadline < today ? 'critical' : days <= 7 ? 'high' : 'medium',
        })
      }
    }

    // Sla alerts op
    if (alerts.length > 0) {
      await supabaseAdmin.from('cfo_risk_alerts').insert(
        alerts.map(a => ({
          company_id:    a.company_id,
          alert_type:    `${a.tax_type}_deadline`,
          severity:      a.severity,
          title:         `${a.tax_type.toUpperCase()} deadline ${a.days_left < 0 ? 'VERSTREKEN' : `over ${a.days_left} dagen`}`,
          message:       `Reserveringstekort: €${a.gap.toFixed(0)}. Deadline: ${a.deadline}.`,
          current_value: a.gap,
          is_resolved:   false,
        }))
      )
    }

    return { alerts_created: alerts.length, alerts }
  },

  // ── Finance: Maandrapport genereren ─────────────────────────────────────
  'finance.report.generate': async payload => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? ''
    const now     = new Date()

    const res = await fetch(`${baseUrl}/api/finance/cfo/report/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        period_year:  payload.year  ?? now.getFullYear(),
        period_month: payload.month ?? now.getMonth() + 1,
      }),
    })

    const result = await res.json()
    return { success: res.ok, ...result }
  },

  // ── Finance: Abonnement detectie ────────────────────────────────────────
  'finance.subscriptions.detect': async payload => {
    const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? ''
    const companyIds = (payload.company_ids as string[]) ?? ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS']
    const results    = []

    for (const cid of companyIds) {
      // Groepeer transacties per leverancier laatste 90 dagen
      const since = new Date()
      since.setDate(since.getDate() - 90)

      const { data: txs } = await supabaseAdmin
        .from('cfo_transactions')
        .select('supplier_id, amount_incl, transaction_date')
        .eq('company_id', cid)
        .eq('direction', 'debet')
        .gte('transaction_date', since.toISOString().split('T')[0])
        .not('supplier_id', 'is', null)

      const bySupplier: Record<string, number[]> = {}
      for (const tx of txs ?? []) {
        const sid = tx.supplier_id as string
        if (!bySupplier[sid]) bySupplier[sid] = []
        bySupplier[sid].push(tx.amount_incl)
      }

      let detected = 0
      for (const [supplierId, amounts] of Object.entries(bySupplier)) {
        if (amounts.length < 2) continue
        const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length
        const allSimilar = amounts.every(a => Math.abs(a - avg) / avg < 0.15)
        if (allSimilar) {
          await supabaseAdmin.from('cfo_subscriptions').upsert({
            company_id:    cid,
            supplier_id:   supplierId,
            name:          `Abonnement ${supplierId.slice(0, 8)}`,
            category:      'software',
            amount_monthly: avg,
            billing_cycle: 'maandelijks',
            is_active:     true,
            ai_detected:   true,
            ai_confidence: Math.min(95, 55 + amounts.length * 10),
            updated_at:    new Date().toISOString(),
          }, { onConflict: 'company_id,supplier_id' })
          detected++
        }
      }
      results.push({ company: cid, detected })
    }

    return { results, total_detected: results.reduce((s, r) => s + r.detected, 0) }
  },

  // ── Generic HTTP webhook handler (used by workflows) ────────────────────
  'http.request': async payload => {
    const res = await fetch(payload.url as string, {
      method: (payload.method as string) ?? 'GET',
      headers: (payload.headers as Record<string, string>) ?? {},
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    })
    const text = await res.text()
    return { status: res.status, body: text }
  },
}

export function getHandler(kind: string): TaskHandler | null {
  return handlers[kind] ?? null
}

export function registerHandler(kind: string, fn: TaskHandler): void {
  handlers[kind] = fn
}

export function listKinds(): string[] {
  return Object.keys(handlers)
}
