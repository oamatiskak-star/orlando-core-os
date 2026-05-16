import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getRequisition,
  getAccountDetails,
  getAccountBalances,
  getAccountTransactions,
} from '@/lib/bank/gocardless'
import { categorize } from '@/lib/bank/categorizer'

// POST — sync transacties voor actieve bank connection
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  // Zoek actieve of pending connections
  const { data: connections } = await supabase
    .from('personal_bank_connections')
    .select('*')
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'Geen actieve bank koppeling. Verbind eerst ING.' }, { status: 400 })
  }

  let totalNew     = 0
  let totalFailed  = 0
  const errors: string[] = []

  for (const conn of connections) {
    try {
      // Haal requisition op en check of geautoriseerd
      const req = await getRequisition(conn.gocardless_req_id)

      if (req.status !== 'LN' || req.accounts.length === 0) {
        // LN = Linked = volledig geautoriseerd
        if (conn.status !== 'pending') continue
        // Nog niet geautoriseerd door gebruiker
        errors.push(`ING autorisatie nog niet voltooid — open de autorisatielink in het dashboard`)
        continue
      }

      const accountId = req.accounts[0]

      // Update connection met account info
      let iban = conn.iban
      if (!iban) {
        const details = await getAccountDetails(accountId)
        iban = details.iban
        await supabase.from('personal_bank_connections').update({
          gocardless_account_id: accountId,
          iban,
          status:               'active',
          updated_at:           new Date().toISOString(),
        }).eq('id', conn.id)
      }

      // Balans ophalen
      const balances = await getAccountBalances(accountId)
      const huidigSaldo = balances.find(b => b.balanceType === 'interimAvailable' || b.balanceType === 'closingBooked')
      if (huidigSaldo) {
        await supabase.from('personal_bank_connections').update({
          status:       'active',
          last_sync_at: new Date().toISOString(),
        }).eq('id', conn.id)
      }

      // Transacties ophalen — max 90 dagen of sinds laatste sync
      const dateFrom = conn.last_sync_at
        ? conn.last_sync_at.split('T')[0]
        : new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

      const { booked } = await getAccountTransactions(accountId, dateFrom)

      for (const tx of booked) {
        const amount    = parseFloat(tx.transactionAmount.amount)
        const direction = amount >= 0 ? 'credit' : 'debet'
        const absAmount = Math.abs(amount)
        const desc      = tx.remittanceInformationUnstructured ?? tx.remittanceInformationStructured ?? ''

        const cat = categorize(desc, tx.creditorName, tx.debtorName)

        const { error } = await supabase.from('personal_transactions').upsert({
          connection_id:   conn.id,
          external_id:     tx.transactionId,
          booking_date:    tx.bookingDate,
          value_date:      tx.valueDate ?? tx.bookingDate,
          amount:          absAmount,
          currency:        tx.transactionAmount.currency,
          description:     desc,
          creditor_name:   tx.creditorName ?? null,
          debtor_name:     tx.debtorName ?? null,
          creditor_iban:   tx.creditorAccount?.iban ?? null,
          debtor_iban:     tx.debtorAccount?.iban ?? null,
          reference:       tx.endToEndId ?? null,
          direction,
          category:        cat.category,
          subcategory:     cat.subcategory ?? null,
          ai_confidence:   cat.confidence,
          is_salary:       cat.is_salary,
          is_savings:      cat.is_savings,
          is_investment:   cat.is_investment,
          is_housing:      cat.is_housing,
          raw_data:        tx,
        }, { onConflict: 'external_id' })

        if (error) totalFailed++
        else totalNew++
      }

      // Update laatste sync tijd
      await supabase.from('personal_bank_connections').update({
        last_sync_at: new Date().toISOString(),
      }).eq('id', conn.id)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Onbekende fout'
      errors.push(msg)
      totalFailed++
    }
  }

  return NextResponse.json({
    ok:         totalFailed === 0,
    new_tx:     totalNew,
    failed:     totalFailed,
    errors,
    synced_at:  new Date().toISOString(),
  })
}

// GET — haal huidig sync status op
export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('personal_bank_connections')
    .select('*')
    .order('updated_at', { ascending: false })
  return NextResponse.json({ connections: data ?? [] })
}
