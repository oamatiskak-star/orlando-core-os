// CSV parser — ING, ABN AMRO, Dyme export en generiek NL formaat
import type { ParsedTransaction } from './mt940'

type CsvFormat = 'ing' | 'ing_new' | 'abn' | 'dyme' | 'generic'

function detectFormat(headers: string[]): CsvFormat {
  const h = headers.map(s => s.toLowerCase().replace(/['"]/g, '').trim())
  const joined = h.join(',')

  if (joined.includes('naam / omschrijving') || joined.includes('naam/omschrijving'))   return 'ing'
  if (joined.includes('omschrijving') && joined.includes('rekening') && joined.includes('bedrag (eur)')) return 'ing_new'
  if (joined.includes('transactiedatum') && joined.includes('debet') && joined.includes('credit')) return 'abn'
  if (joined.includes('category') || joined.includes('categorie') && joined.includes('merchant')) return 'dyme'
  return 'generic'
}

function parseNlAmount(raw: string): number {
  if (!raw) return 0
  // Verwijder valutasymbool, quotes
  const cleaned = raw.replace(/[€"']/g, '').trim()
  // NL format: 1.234,56 of 1234,56
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  return parseFloat(cleaned) || 0
}

function nlDateToIso(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0]
  const s = raw.trim().replace(/['"]/g, '')

  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return `${s.slice(6,10)}-${s.slice(3,5)}-${s.slice(0,2)}`
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return `${s.slice(6,10)}-${s.slice(3,5)}-${s.slice(0,2)}`
  // YYYY-MM-DD (al goed)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD-MM-YY
  if (/^\d{2}-\d{2}-\d{2}$/.test(s)) {
    const yy = parseInt(s.slice(6, 8))
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy
    return `${yyyy}-${s.slice(3,5)}-${s.slice(0,2)}`
  }
  return s.slice(0, 10)
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ; continue }
    if (c === sep && !inQ) { result.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  result.push(cur.trim())
  return result
}

function detectSep(firstLine: string): string {
  const commas    = (firstLine.match(/,/g) || []).length
  const semis     = (firstLine.match(/;/g) || []).length
  const tabs      = (firstLine.match(/\t/g) || []).length
  if (tabs > commas && tabs > semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseIng(rows: string[][], headers: string[], sep: string): ParsedTransaction[] {
  // ING: Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;Bedrag (EUR);Mutatiesoort;Mededelingen
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  const iDate   = idx('datum')
  const iName   = idx('naam')
  const iIban   = idx('rekening')
  const iCIban  = idx('tegenrekening')
  const iDir    = idx('af bij')
  const iAmt    = idx('bedrag')
  const iDesc   = idx('mededelingen')
  const iMut    = idx('mutatiesoort')

  return rows.map((cols, i) => {
    if (cols.length < 5) return null
    const date      = nlDateToIso(cols[iDate] ?? '')
    const name      = cols[iName]?.trim() ?? ''
    const afBij     = (cols[iDir] ?? '').trim().toLowerCase()
    const direction: 'credit' | 'debet' = afBij === 'bij' ? 'credit' : 'debet'
    const amount    = parseNlAmount(cols[iAmt] ?? '0')
    const desc      = cols[iDesc]?.trim() ?? cols[iMut]?.trim() ?? ''
    const cIban     = cols[iCIban]?.trim() ?? null
    const myIban    = cols[iIban]?.trim() ?? null

    return {
      external_id:   `ing-csv-${myIban ?? 'x'}-${date}-${i}-${amount}`,
      booking_date:  date,
      value_date:    null,
      amount,
      direction,
      description:   (desc || name).slice(0, 500),
      creditor_name: direction === 'debet' ? name || null : null,
      debtor_name:   direction === 'credit' ? name || null : null,
      creditor_iban: direction === 'debet' ? cIban : null,
      debtor_iban:   direction === 'credit' ? cIban : null,
      currency:      'EUR',
      raw:           cols.join(sep).slice(0, 500),
    } as ParsedTransaction
  }).filter(Boolean) as ParsedTransaction[]
}

function parseAbn(rows: string[][], headers: string[], sep: string): ParsedTransaction[] {
  // ABN AMRO: Transactiedatum;Valutacode;CreditDebet;Bedrag;Tegenrekening;Naam tegenpartij;...Omschrijving
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  const iDate  = idx('transactiedatum')
  const iDir   = idx('creditdebet')
  const iAmt   = idx('bedrag')
  const iCIban = idx('tegenrekening')
  const iName  = idx('naam tegenpartij')
  const iDesc  = idx('omschrijving')

  return rows.map((cols, i) => {
    if (cols.length < 4) return null
    const date      = nlDateToIso(cols[iDate] ?? '')
    const cdRaw     = (cols[iDir] ?? '').trim().toUpperCase()
    const direction: 'credit' | 'debet' = cdRaw === 'C' ? 'credit' : 'debet'
    const amount    = parseNlAmount(cols[iAmt] ?? '0')
    const name      = cols[iName]?.trim() ?? ''
    const desc      = cols[iDesc]?.trim() ?? ''
    const cIban     = cols[iCIban]?.trim() ?? null

    return {
      external_id:   `abn-csv-${date}-${i}-${amount}`,
      booking_date:  date,
      value_date:    null,
      amount,
      direction,
      description:   (desc || name).slice(0, 500),
      creditor_name: direction === 'debet' ? name || null : null,
      debtor_name:   direction === 'credit' ? name || null : null,
      creditor_iban: direction === 'debet' ? cIban : null,
      debtor_iban:   direction === 'credit' ? cIban : null,
      currency:      'EUR',
      raw:           cols.join(sep).slice(0, 500),
    } as ParsedTransaction
  }).filter(Boolean) as ParsedTransaction[]
}

function parseDyme(rows: string[][], headers: string[], sep: string): ParsedTransaction[] {
  // Dyme export: Date,Description,Amount,Category,Account,Merchant,...
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  const iDate  = idx('date') >= 0 ? idx('date') : idx('datum')
  const iDesc  = idx('description') >= 0 ? idx('description') : idx('omschrijving')
  const iAmt   = idx('amount') >= 0 ? idx('amount') : idx('bedrag')
  const iMer   = idx('merchant')
  const iCat   = idx('category') >= 0 ? idx('category') : idx('categorie')

  return rows.map((cols, i) => {
    if (cols.length < 3) return null
    const date   = nlDateToIso(cols[iDate] ?? '')
    const rawAmt = parseNlAmount(cols[iAmt] ?? '0')
    const amount = Math.abs(rawAmt)
    const direction: 'credit' | 'debet' = rawAmt >= 0 ? 'credit' : 'debet'
    const desc   = cols[iDesc]?.trim() ?? ''
    const merch  = iMer >= 0 ? (cols[iMer]?.trim() ?? null) : null

    return {
      external_id:   `dyme-${date}-${i}-${amount}`,
      booking_date:  date,
      value_date:    null,
      amount,
      direction,
      description:   (desc || merch || '').slice(0, 500),
      creditor_name: direction === 'debet' ? (merch ?? null) : null,
      debtor_name:   direction === 'credit' ? (merch ?? null) : null,
      creditor_iban: null,
      debtor_iban:   null,
      currency:      'EUR',
      raw:           cols.join(sep).slice(0, 500),
    } as ParsedTransaction
  }).filter(Boolean) as ParsedTransaction[]
}

function parseGeneric(rows: string[][], headers: string[], sep: string): ParsedTransaction[] {
  // Best-effort voor onbekende CSV formaten
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()))
      if (i >= 0) return i
    }
    return -1
  }
  const iDate = idx(['datum', 'date', 'boekingsdatum', 'transactiedatum'])
  const iAmt  = idx(['bedrag', 'amount', 'bedrag (eur)', 'bedrag(eur)'])
  const iDesc = idx(['omschrijving', 'description', 'mededelingen', 'naam'])
  const iDir  = idx(['af bij', 'creditdebet', 'debet/credit'])

  if (iDate < 0 || iAmt < 0) return []

  return rows.map((cols, i) => {
    if (cols.length < 2) return null
    const date   = nlDateToIso(cols[iDate] ?? '')
    const rawAmt = parseNlAmount(cols[iAmt] ?? '0')
    const dirRaw = iDir >= 0 ? cols[iDir]?.toLowerCase() : ''
    let direction: 'credit' | 'debet'
    if (dirRaw === 'bij' || dirRaw === 'c' || dirRaw === 'credit') direction = 'credit'
    else if (dirRaw === 'af' || dirRaw === 'd' || dirRaw === 'debet') direction = 'debet'
    else direction = rawAmt >= 0 ? 'credit' : 'debet'
    const amount = Math.abs(rawAmt)
    const desc   = iDesc >= 0 ? (cols[iDesc]?.trim() ?? '') : ''

    return {
      external_id:   `csv-${date}-${i}-${amount}`,
      booking_date:  date,
      value_date:    null,
      amount,
      direction,
      description:   desc.slice(0, 500),
      creditor_name: null,
      debtor_name:   null,
      creditor_iban: null,
      debtor_iban:   null,
      currency:      'EUR',
      raw:           cols.join(sep).slice(0, 500),
    } as ParsedTransaction
  }).filter(Boolean) as ParsedTransaction[]
}

export function parseCsv(content: string): { format: CsvFormat; transactions: ParsedTransaction[]; iban: string | null } {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { format: 'generic', transactions: [], iban: null }

  const sep     = detectSep(lines[0])
  const headers = splitCsvLine(lines[0], sep).map(h => h.replace(/^"|"$/g, '').trim())
  const format  = detectFormat(headers)

  const rows = lines.slice(1)
    .map(l => splitCsvLine(l, sep).map(c => c.replace(/^"|"$/g, '').trim()))
    .filter(r => r.some(c => c))

  // Probeer IBAN te extraheren uit ING header (rekening kolom van eerste rij)
  let iban: string | null = null
  if (rows.length > 0) {
    const ibanIdx = headers.findIndex(h => h.toLowerCase() === 'rekening')
    if (ibanIdx >= 0) iban = rows[0][ibanIdx] ?? null
  }

  let transactions: ParsedTransaction[] = []
  if (format === 'ing' || format === 'ing_new')  transactions = parseIng(rows, headers, sep)
  else if (format === 'abn')                      transactions = parseAbn(rows, headers, sep)
  else if (format === 'dyme')                     transactions = parseDyme(rows, headers, sep)
  else                                            transactions = parseGeneric(rows, headers, sep)

  return { format, transactions, iban }
}
