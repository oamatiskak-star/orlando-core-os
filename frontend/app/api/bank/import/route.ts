import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseMt940 } from '@/lib/bank/parsers/mt940'
import { parseCsv }   from '@/lib/bank/parsers/csv'
import { parsePdf }   from '@/lib/bank/parsers/pdf'
import { parseXlsx }  from '@/lib/bank/parsers/xlsx'
import { categorize } from '@/lib/bank/categorizer'
import type { ParsedTransaction } from '@/lib/bank/parsers/mt940'

export const maxDuration = 60
export const runtime     = 'nodejs'

async function upsertTransactions(
  supabase: ReturnType<typeof createAdminClient>,
  txList:   ParsedTransaction[],
  iban:     string | null,
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  let inserted = 0
  let skipped  = 0
  const errors: string[] = []

  // Zoek of maak een import-verbinding
  let connId: string | null = null
  const { data: existing } = await supabase
    .from('personal_bank_connections')
    .select('id')
    .eq('status', 'import')
    .single()

  if (existing) {
    connId = existing.id
  } else {
    const { data: newConn } = await supabase
      .from('personal_bank_connections')
      .insert({
        bank_id:   'IMPORT',
        bank_name: 'Import (MT940/CSV/PDF)',
        iban:      iban ?? null,
        status:    'import',
      })
      .select('id')
      .single()
    connId = newConn?.id ?? null
  }

  for (const tx of txList) {
    // Dyme heeft eigen categorisatie — gebruik die als de categorizer laag scoort
    const cat        = categorize(tx.description, tx.creditor_name, tx.debtor_name)
    const dymecat    = (tx as ParsedTransaction & { _dyme_cat?: string })._dyme_cat
    const finalCat   = dymecat && cat.confidence < 0.7 ? dymecat : cat.category

    const { error } = await supabase.from('personal_transactions').upsert({
      connection_id:  connId,
      external_id:    tx.external_id,
      booking_date:   tx.booking_date,
      value_date:     tx.value_date ?? tx.booking_date,
      amount:         tx.amount,
      currency:       tx.currency,
      description:    tx.description,
      creditor_name:  tx.creditor_name,
      debtor_name:    tx.debtor_name,
      creditor_iban:  tx.creditor_iban,
      debtor_iban:    tx.debtor_iban,
      direction:      tx.direction,
      category:       finalCat,
      subcategory:    cat.subcategory ?? null,
      ai_confidence:  cat.confidence,
      is_salary:      cat.is_salary,
      is_savings:     cat.is_savings,
      is_investment:  cat.is_investment,
      is_housing:     cat.is_housing,
      raw_data:       { raw: tx.raw },
    }, { onConflict: 'external_id', ignoreDuplicates: true })

    if (error) {
      if (error.code === '23505') skipped++
      else { errors.push(error.message); skipped++ }
    } else {
      inserted++
    }
  }

  return { inserted, skipped, errors }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const buffer   = Buffer.from(await file.arrayBuffer())
    const supabase = createAdminClient()

    let txList: ParsedTransaction[] = []
    let iban: string | null = null
    let format = 'onbekend'

    if (fileName.endsWith('.mt940') || fileName.endsWith('.mta') || fileName.endsWith('.sta') || fileName.endsWith('.mt9')) {
      const text   = buffer.toString('utf-8')
      const result = parseMt940(text)
      txList  = result.transactions
      iban    = result.iban
      format  = 'MT940'
    } else if (fileName.endsWith('.pdf')) {
      const result = await parsePdf(buffer)
      txList  = result.transactions
      iban    = result.iban
      format  = 'PDF'
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const result = parseXlsx(buffer)
      txList  = result.transactions
      iban    = result.iban
      format  = 'XLSX (Dyme)'
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      // Probeer UTF-8, dan latin1 (ING exporteert soms latin1)
      let text = buffer.toString('utf-8')
      if (text.includes('�')) text = buffer.toString('latin1')
      const result = parseCsv(text)
      txList  = result.transactions
      iban    = result.iban
      format  = `CSV (${result.format})`
    } else {
      return NextResponse.json({ error: `Niet-ondersteund bestandstype: ${fileName.split('.').pop()}. Gebruik MT940, CSV, XLSX of PDF.` }, { status: 400 })
    }

    if (txList.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Geen transacties gevonden in het bestand. Controleer het formaat.',
        format,
      }, { status: 422 })
    }

    const { inserted, skipped, errors } = await upsertTransactions(supabase, txList, iban)

    return NextResponse.json({
      ok:       true,
      format,
      iban,
      parsed:   txList.length,
      inserted,
      skipped,
      errors:   errors.slice(0, 5),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
