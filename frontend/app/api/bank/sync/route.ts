import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getTransactions,
  getAccounts,
  tinkAmount,
  updateConnectionIban,
} from '@/lib/bank/tink'
import { categorize } from '@/lib/bank/categorizer'

// POST — sync transacties voor actieve Tink bank connection
export async function POST() {
  const supabase = createAdminClient()

  const { data: connections } = await supabase
    .from('personal_bank_connections')
    .select('*')
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'Geen actieve bank koppeling. Verbind eerst ING via Tink.' }, { status: 400 })
  }

  let totalNew    = 0
  let totalFailed = 0
  const errors: string[] = []

  for (const conn of connections) {
    try {
      // Haal accounts op als IBAN nog niet bekend is
      if (!conn.iban) {
        const accounts = await getAccounts(conn.id)
        if (accounts.length > 0) {
          const iban = accounts[0].identifiers?.iban?.iban ?? null
          if (iban) {
            await updateConnectionIban(conn.id, iban)
            conn.iban = iban
          }
        }
      }

      // Transacties ophalen — max 90 dagen of sinds laatste sync
      const dateFrom = conn.last_sync_at
        ? conn.last_sync_at.split('T')[0]
        : new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

      const txList = await getTransactions(conn.id, undefined, dateFrom)

      for (const tx of txList) {
        const rawAmount = tinkAmount(tx.amount.value)
        const direction = rawAmount >= 0 ? 'credit' : 'debet'
        const absAmount = Math.abs(rawAmount)

        const desc         = tx.descriptions?.original ?? tx.descriptions?.display ?? ''
        const creditorName = tx.counterparties?.payee?.name?.unstructured ?? tx.merchantInformation?.merchantName ?? null
        const debtorName   = tx.counterparties?.payer?.name?.unstructured ?? null
        const creditorIban = null
        const debtorIban   = tx.counterparties?.payer?.identifiers?.financialInstitution?.accountNumber ?? null

        const cat = categorize(desc, creditorName, debtorName)

        const { error } = await supabase.from('personal_transactions').upsert({
          connection_id:  conn.id,
          external_id:    tx.id,
          booking_date:   tx.dates?.booked ?? new Date().toISOString().split('T')[0],
          value_date:     tx.dates?.value ?? tx.dates?.booked ?? null,
          amount:         absAmount,
          currency:       tx.amount.currencyCode ?? 'EUR',
          description:    desc,
          creditor_name:  creditorName,
          debtor_name:    debtorName,
          creditor_iban:  creditorIban,
          debtor_iban:    debtorIban,
          reference:      null,
          direction,
          category:       cat.category,
          subcategory:    cat.subcategory ?? null,
          ai_confidence:  cat.confidence,
          is_salary:      cat.is_salary,
          is_savings:     cat.is_savings,
          is_investment:  cat.is_investment,
          is_housing:     cat.is_housing,
          raw_data:       tx,
        }, { onConflict: 'external_id' })

        if (error) totalFailed++
        else totalNew++
      }

      await supabase.from('personal_bank_connections').update({
        status:       'active',
        last_sync_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq('id', conn.id)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Onbekende fout'
      errors.push(msg)
    }
  }

  return NextResponse.json({
    ok:        totalFailed === 0,
    new_tx:    totalNew,
    failed:    totalFailed,
    errors,
    synced_at: new Date().toISOString(),
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
