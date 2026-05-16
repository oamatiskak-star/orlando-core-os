// PDF bank statement parser — ING / NL banken
// Gebruikt pdf-parse voor tekstextractie, dan patroonherkenning

import type { ParsedTransaction } from './mt940'

// pdf-parse is server-only
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

function nlDateToIso(raw: string): string | null {
  // DD-MM-YYYY of DD/MM/YYYY of DD mmmm YYYY (NL)
  const NL_MONTHS: Record<string, string> = {
    januari:'01', februari:'02', maart:'03', april:'04',
    mei:'05', juni:'06', juli:'07', augustus:'08',
    september:'09', oktober:'10', november:'11', december:'12',
  }
  const s = raw.trim().toLowerCase()

  // DD-MM-YYYY
  let m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  // DD mmmm YYYY
  m = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (m && NL_MONTHS[m[2]]) return `${m[3]}-${NL_MONTHS[m[2]]}-${m[1].padStart(2,'0')}`

  // YYYY-MM-DD al goed
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  return null
}

function parseNlAmount(raw: string): number {
  return parseFloat(raw.replace(/[€\s.]/g, '').replace(',', '.')) || 0
}

export async function parsePdf(buffer: Buffer): Promise<{ transactions: ParsedTransaction[]; iban: string | null }> {
  const data = await pdfParse(buffer)
  const text: string = data.text

  const transactions: ParsedTransaction[] = []

  // IBAN detectie
  const ibanMatch = text.match(/([A-Z]{2}\d{2}[A-Z]{4}\d{10})/g)
  const iban = ibanMatch ? ibanMatch[0] : null

  // ING PDF rekeningafschrift patroon:
  // Datum        Omschrijving                    Bedrag Af/Bij    Saldo
  // 02-01-2025   ALBERT HEIJN                    50,00  Af        1.234,56
  const txPattern = /(\d{2}[/-]\d{2}[/-]\d{4})\s+(.+?)\s+([\d.]+,\d{2})\s+(Af|Bij|D|C)\s+([\d.]+,\d{2})/g
  let match: RegExpExecArray | null

  let idx = 0
  while ((match = txPattern.exec(text)) !== null) {
    const [, dateRaw, desc, amtRaw, dirRaw] = match
    const date = nlDateToIso(dateRaw)
    if (!date) continue

    const amount    = parseNlAmount(amtRaw)
    const direction: 'credit' | 'debet' = (dirRaw === 'Bij' || dirRaw === 'C') ? 'credit' : 'debet'

    transactions.push({
      external_id:   `pdf-${iban ?? 'x'}-${date}-${idx}-${amount}`,
      booking_date:  date,
      value_date:    null,
      amount,
      direction,
      description:   desc.trim().slice(0, 500),
      creditor_name: direction === 'debet' ? desc.trim() : null,
      debtor_name:   direction === 'credit' ? desc.trim() : null,
      creditor_iban: null,
      debtor_iban:   null,
      currency:      'EUR',
      raw:           match[0].slice(0, 500),
    })
    idx++
  }

  // Fallback: generiek patroon voor andere banken
  if (transactions.length === 0) {
    const fallback = /(\d{2}[/-]\d{2}[/-]\d{4})\s+([^\d\n]{5,60})\s+([-+]?\s*[\d.]+,\d{2})/g
    while ((match = fallback.exec(text)) !== null) {
      const [, dateRaw, desc, amtRaw] = match
      const date = nlDateToIso(dateRaw)
      if (!date) continue
      const rawAmt = parseNlAmount(amtRaw)
      const amount = Math.abs(rawAmt)
      const direction: 'credit' | 'debet' = rawAmt >= 0 ? 'credit' : 'debet'

      transactions.push({
        external_id:   `pdf-${iban ?? 'x'}-${date}-${idx}-${amount}`,
        booking_date:  date,
        value_date:    null,
        amount,
        direction,
        description:   desc.trim().slice(0, 500),
        creditor_name: direction === 'debet' ? desc.trim() : null,
        debtor_name:   null,
        creditor_iban: null,
        debtor_iban:   null,
        currency:      'EUR',
        raw:           match[0].slice(0, 500),
      })
      idx++
    }
  }

  return { transactions, iban }
}
