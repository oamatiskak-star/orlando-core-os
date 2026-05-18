import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTransactions } from '@/lib/ing/client'
import { categorize } from '@/lib/bank/categorizer'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Haal actieve ING verbinding op
  const { data: conn } = await supabase
    .from('personal_bank_connections')
    .select('id, iban, raw_data')
    .eq('bank_id', 'ING')
    .eq('status', 'active')
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Geen actieve ING verbinding' }, { status: 404 })
  }

  const rawData = conn.raw_data as {
    access_token?: string
    accounts?: Array<{ resourceId: string; iban?: string }>
  }

  if (!rawData.access_token) {
    return NextResponse.json({ error: 'Geen access token — verbind ING opnieuw' }, { status: 401 })
  }

  const accounts = rawData.accounts ?? []
  const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateTo   = new Date().toISOString().split('T')[0]

  let inserted = 0, skipped = 0

  for (const account of accounts) {
    const txList = await getTransactions(rawData.access_token, account.resourceId, dateFrom, dateTo) as Array<{
      transactionId?: string
      bookingDate?: string
      valueDate?: string
      transactionAmount?: { amount?: string; currency?: string }
      remittanceInformationUnstructured?: string
      creditorName?: string
      debtorName?: string
      creditorAccount?: { iban?: string }
      debtorAccount?: { iban?: string }
      creditDebitIndicator?: string
    }>

    for (const tx of txList) {
      const amount    = Math.abs(parseFloat(tx.transactionAmount?.amount ?? '0'))
      const direction = tx.creditDebitIndicator === 'CRDT' ? 'credit' : 'debet'
      const desc      = tx.remittanceInformationUnstructured ?? ''
      const creditor  = tx.creditorName ?? null
      const debtor    = tx.debtorName ?? null

      const cat = categorize(desc, creditor ?? undefined, debtor ?? undefined)

      const { error } = await admin.from('personal_transactions').upsert({
        connection_id:  conn.id,
        external_id:    tx.transactionId ?? `ing-${tx.bookingDate}-${amount}`,
        booking_date:   tx.bookingDate ?? dateTo,
        value_date:     tx.valueDate ?? tx.bookingDate ?? dateTo,
        amount,
        currency:       tx.transactionAmount?.currency ?? 'EUR',
        description:    desc,
        creditor_name:  creditor,
        debtor_name:    debtor,
        creditor_iban:  tx.creditorAccount?.iban ?? null,
        debtor_iban:    tx.debtorAccount?.iban ?? null,
        direction,
        category:       cat.category,
        subcategory:    cat.subcategory ?? null,
        ai_confidence:  cat.confidence,
        is_salary:      cat.is_salary,
        is_savings:     cat.is_savings,
        is_investment:  cat.is_investment,
        is_housing:     cat.is_housing,
        raw_data:       { raw: tx },
      }, { onConflict: 'external_id', ignoreDuplicates: true })

      if (error?.code === '23505') skipped++
      else if (error) skipped++
      else inserted++
    }
  }

  // Update last_sync_at
  await supabase
    .from('personal_bank_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', conn.id)

  return NextResponse.json({ ok: true, inserted, skipped, dateFrom, dateTo })
}
