import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPurchaseInvoices,
  getSalesInvoices,
  getFinancialMutations,
  checkConnection,
} from '@/lib/finance/moneybird-client'
import { suggestLedgerAccount } from '@/lib/finance/cfo-engine'

const ALL_COMPANIES: string[] = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const syncType: string = body.sync_type ?? 'volledig'
  const companyId: string = body.company_id ?? 'STRKBEHEER'
  const updatedSince: string | undefined = body.updated_since

  const supabase = createAdminClient()

  // Log sync start
  const { data: syncLog } = await supabase
    .from('cfo_moneybird_sync_log')
    .insert({
      company_id:     companyId,
      sync_type:      syncType,
      status:         'gestart',
      records_fetched: 0,
      records_new:    0,
      records_updated: 0,
      records_failed:  0,
      started_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  const logId = syncLog?.id

  try {
    const isConnected = await checkConnection()
    if (!isConnected) {
      return NextResponse.json({ error: 'Moneybird niet verbonden' }, { status: 400 })
    }

    let totalFetched = 0
    let totalNew     = 0
    let totalUpdated = 0
    let totalFailed  = 0

    // ── Inkoopfacturen synchroniseren ──────────────────────────────────────
    if (syncType === 'volledig' || syncType === 'facturen') {
      const purchaseInvoices = await getPurchaseInvoices(updatedSince)
      totalFetched += purchaseInvoices.length

      for (const inv of purchaseInvoices) {
        try {
          const amountIncl = parseFloat(inv.total_price_incl_tax ?? '0')
          const amountExcl = parseFloat(inv.total_price_excl_tax ?? '0')
          const amountVat  = parseFloat(inv.total_tax ?? '0')

          // AI grootboek suggestie voor nieuwe transacties
          let ledgerSuggestion = null
          let aiConfidence     = 0
          const contactName    = inv.contact?.company_name ?? 'Onbekend'

          if (!updatedSince) {
            const suggestion = await suggestLedgerAccount(
              contactName,
              inv.reference ?? '',
              amountIncl,
            )
            ledgerSuggestion = suggestion.ledger
            aiConfidence     = suggestion.confidence
          }

          const { error } = await supabase.from('cfo_transactions').upsert({
            company_id:          companyId,
            source:              'moneybird',
            external_id:         inv.id,
            direction:           'debet',
            amount_excl:         amountExcl,
            amount_vat:          amountVat,
            amount_incl:         amountIncl,
            currency:            inv.currency ?? 'EUR',
            description:         inv.reference ?? contactName,
            reference:           inv.reference,
            transaction_date:    inv.date,
            payment_date:        inv.due_date ?? null,
            status:              inv.state === 'paid' ? 'betaald' : 'geboekt',
            ai_ledger_suggestion: ledgerSuggestion,
            ai_confidence:       aiConfidence,
            moneybird_id:        inv.id,
            moneybird_type:      'purchase_invoice',
            raw_data:            inv,
            updated_at:          new Date().toISOString(),
          }, { onConflict: 'company_id,moneybird_id,moneybird_type' })

          if (error) totalFailed++
          else totalNew++
        } catch {
          totalFailed++
        }
      }
    }

    // ── Verkoopfacturen synchroniseren ─────────────────────────────────────
    if (syncType === 'volledig' || syncType === 'facturen') {
      const salesInvoices = await getSalesInvoices(updatedSince)
      totalFetched += salesInvoices.length

      for (const inv of salesInvoices) {
        try {
          const amountIncl = parseFloat(inv.total_price_incl_tax ?? '0')
          const amountExcl = parseFloat(inv.total_price_excl_tax ?? '0')
          const amountVat  = parseFloat(inv.total_tax ?? '0')

          const { error } = await supabase.from('cfo_transactions').upsert({
            company_id:       companyId,
            source:           'moneybird',
            external_id:      inv.id,
            direction:        'credit',
            amount_excl:      amountExcl,
            amount_vat:       amountVat,
            amount_incl:      amountIncl,
            currency:         inv.currency ?? 'EUR',
            description:      inv.invoice_id ?? inv.contact?.company_name ?? 'Verkoopfactuur',
            transaction_date: inv.invoice_date,
            payment_date:     inv.paid_at ?? null,
            status:           inv.state === 'paid' ? 'betaald' : 'geboekt',
            moneybird_id:     inv.id,
            moneybird_type:   'sales_invoice',
            raw_data:         inv,
            updated_at:       new Date().toISOString(),
          }, { onConflict: 'company_id,moneybird_id,moneybird_type' })

          if (error) totalFailed++
          else totalNew++
        } catch {
          totalFailed++
        }
      }
    }

    // ── Bankmutaties synchroniseren ────────────────────────────────────────
    if (syncType === 'volledig' || syncType === 'transacties') {
      const mutations = await getFinancialMutations(updatedSince)
      totalFetched += mutations.length

      for (const mut of mutations) {
        try {
          const amount = parseFloat(mut.amount ?? '0')
          const direction = amount >= 0 ? 'credit' : 'debet'

          const { error } = await supabase.from('cfo_transactions').upsert({
            company_id:       companyId,
            source:           'moneybird',
            external_id:      mut.id,
            direction,
            amount_excl:      Math.abs(amount),
            amount_vat:       0,
            amount_incl:      Math.abs(amount),
            currency:         'EUR',
            description:      mut.message ?? mut.code ?? 'Bankmutatie',
            reference:        mut.account_servicer_transaction_id,
            transaction_date: mut.date,
            status:           'geboekt',
            moneybird_id:     mut.id,
            moneybird_type:   'financial_mutation',
            raw_data:         mut,
            updated_at:       new Date().toISOString(),
          }, { onConflict: 'company_id,moneybird_id,moneybird_type' })

          if (error) totalFailed++
          else totalNew++
        } catch {
          totalFailed++
        }
      }
    }

    // BTW reservering automatisch bijwerken
    if (syncType === 'volledig' || syncType === 'btw') {
      await updateBtwReservations(companyId, supabase)
    }

    // Update sync log
    if (logId) {
      const durationMs = Date.now() - Date.parse(new Date().toISOString())
      await supabase.from('cfo_moneybird_sync_log').update({
        status:          totalFailed > 0 && totalNew === 0 ? 'fout' : totalFailed > 0 ? 'gedeeltelijk' : 'voltooid',
        records_fetched: totalFetched,
        records_new:     totalNew,
        records_updated: totalUpdated,
        records_failed:  totalFailed,
        completed_at:    new Date().toISOString(),
        duration_ms:     Math.abs(durationMs),
      }).eq('id', logId)
    }

    return NextResponse.json({
      success:         true,
      sync_type:       syncType,
      company_id:      companyId,
      records_fetched: totalFetched,
      records_new:     totalNew,
      records_failed:  totalFailed,
      synced_at:       new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    if (logId) {
      await supabase.from('cfo_moneybird_sync_log').update({
        status:        'fout',
        error_message: message,
        completed_at:  new Date().toISOString(),
      }).eq('id', logId)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function updateBtwReservations(
  companyId: string,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const now      = new Date()
  const year     = now.getFullYear()
  const quarter  = Math.ceil((now.getMonth() + 1) / 3)

  // BTW op basis van huidige kwartaal transacties
  const startDate = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`
  const endDate   = now.toISOString().split('T')[0]

  const { data: txs } = await supabase
    .from('cfo_transactions')
    .select('direction, amount_vat')
    .eq('company_id', companyId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)

  const btwIn  = (txs ?? []).filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount_vat, 0)
  const btwOut = (txs ?? []).filter(t => t.direction === 'debet').reduce((s, t) => s + t.amount_vat, 0)
  const btwRequired = Math.max(0, btwIn - btwOut)

  // BTW deadlines NL: Q1→30 apr, Q2→31 jul, Q3→31 okt, Q4→31 jan+1
  const deadlines: Record<number, string> = {
    1: `${year}-04-30`,
    2: `${year}-07-31`,
    3: `${year}-10-31`,
    4: `${year + 1}-01-31`,
  }

  await supabase.from('cfo_tax_reservations').upsert({
    company_id:      companyId,
    tax_type:        'btw',
    period_year:     year,
    period_quarter:  quarter,
    amount_required: btwRequired,
    deadline:        deadlines[quarter],
    status:          'open',
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'company_id,tax_type,period_year,period_quarter,period_month' })
}

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cfo_moneybird_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ logs: data ?? [] })
}
