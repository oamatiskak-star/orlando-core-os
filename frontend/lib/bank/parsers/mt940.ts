// MT940 parser — ING / NL banken
// Standaard SWIFT MT940 formaat zoals geëxporteerd door ING internetbankieren

export type ParsedTransaction = {
  external_id:   string
  booking_date:  string        // YYYY-MM-DD
  value_date:    string | null
  amount:        number
  direction:     'credit' | 'debet'
  description:   string
  creditor_name: string | null
  debtor_name:   string | null
  creditor_iban: string | null
  debtor_iban:   string | null
  currency:      string
  raw:           string
}

function parseMt940Date(d: string, yearHint?: number): string {
  // YYMMDD → YYYY-MM-DD
  const yy = d.slice(0, 2)
  const mm = d.slice(2, 4)
  const dd = d.slice(4, 6)
  const year = yearHint ?? (parseInt(yy) > 50 ? 1900 + parseInt(yy) : 2000 + parseInt(yy))
  return `${year}-${mm}-${dd}`
}

function parseAmount(raw: string): number {
  // MT940: 1.234,56 → 1234.56
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

function extractField(details: string, keys: string[]): string | null {
  for (const key of keys) {
    const patterns = [
      new RegExp(`(?:^|\\n)${key}:\\s*(.+?)(?:\\n|$)`, 'i'),
      new RegExp(`/(?:NAME|NAM)/${key}[:/]\\s*(.+?)(?:/|$)`, 'i'),
    ]
    for (const p of patterns) {
      const m = details.match(p)
      if (m) return m[1].trim()
    }
  }
  return null
}

export function parseMt940(content: string): { iban: string | null; transactions: ParsedTransaction[] } {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const transactions: ParsedTransaction[] = []

  // IBAN uit :25:
  const ibanMatch = lines.match(/:25:\s*([A-Z]{2}\d{2}[A-Z0-9]{4,}(?:\/[A-Z]+)?)/i)
  const iban = ibanMatch ? ibanMatch[1].split('/')[0].trim() : null

  // Splits op :61: transactieregels
  const txBlocks = lines.split(/(?=^:61:)/m)

  let idx = 0
  for (const block of txBlocks) {
    if (!block.startsWith(':61:')) continue

    const line61Match = block.match(/:61:(\d{6})(\d{4})?(C|D|RC|RD)(\d[\d,]+)N(\w{3})([^\n]*)/)
    if (!line61Match) continue

    const [, dateRaw, valueDateRaw, cdMark, amountRaw, , refRaw] = line61Match
    const bookDate  = parseMt940Date(dateRaw)
    const valueDate = valueDateRaw ? parseMt940Date(valueDateRaw) : null
    const amount    = parseAmount(amountRaw)
    const direction: 'credit' | 'debet' = cdMark.startsWith('C') ? 'credit' : 'debet'

    // :86: details
    const details86Match = block.match(/:86:([\s\S]+?)(?=^:|$)/m)
    const rawDetails = details86Match ? details86Match[1].trim() : ''

    // ING specifieke :86: velden
    // /TRCD/..../NAME/..../REMI/.../CNTP/IBAN
    let description  = ''
    let creditorName: string | null = null
    let debtorName:   string | null = null
    let creditorIban: string | null = null
    let debtorIban:   string | null = null

    // Gestructureerde :86: parsing (ING formaat)
    const nameMatch  = rawDetails.match(/\/NAME\/([^/\n]+)/)
    const remiMatch  = rawDetails.match(/\/REMI\/([^/\n]+)/)
    const cntpMatch  = rawDetails.match(/\/CNTP\/([A-Z]{2}\d{2}[A-Z0-9]{10,})/)
    const csidMatch  = rawDetails.match(/\/CSID\/([^/\n]+)/)
    const erefMatch  = rawDetails.match(/\/EREF\/([^/\n]+)/)

    const counterName = nameMatch ? nameMatch[1].trim() : null
    description = remiMatch ? remiMatch[1].trim() : (csidMatch ? csidMatch[1].trim() : rawDetails.replace(/\/\w+\//g, ' ').trim())
    if (!description) description = erefMatch ? erefMatch[1].trim() : (refRaw?.trim() ?? '')

    const counterIban = cntpMatch ? cntpMatch[1].trim() : null

    if (direction === 'debet') {
      creditorName = counterName
      creditorIban = counterIban
    } else {
      debtorName = counterName
      debtorIban = counterIban
    }

    // Fallback: eerste niet-slash regel als omschrijving
    if (!description) {
      description = rawDetails.split('\n').find(l => !l.startsWith('/') && l.trim())?.trim() ?? ''
    }

    const externalId = `mt940-${iban ?? 'x'}-${bookDate}-${idx}-${amountRaw}`
    idx++

    transactions.push({
      external_id:   externalId,
      booking_date:  bookDate,
      value_date:    valueDate,
      amount,
      direction,
      description:   description.slice(0, 500),
      creditor_name: creditorName,
      debtor_name:   debtorName,
      creditor_iban: creditorIban,
      debtor_iban:   debtorIban,
      currency:      'EUR',
      raw:           block.slice(0, 500),
    })
  }

  return { iban, transactions }
}
